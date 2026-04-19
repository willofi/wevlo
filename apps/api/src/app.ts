import Fastify, { type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";

import {
  createIntegrationInstallationRequestSchema,
  createIntegrationProjectLinkRequestSchema,
  createCommentRequestSchema,
  importIntegrationProjectIssuesRequestSchema,
  createIssueRequestSchema,
  createProjectRequestSchema,
  createWorkspaceRequestSchema,
  type ErrorEnvelopeDto,
  meSchema,
  listIssuesQuerySchema,
  type ListIssueScope,
  transitionIssueRequestSchema,
  upsertProjectMemberRequestSchema,
  updateProjectBoardConfigRequestSchema,
  updateIssueRequestSchema,
  sessionSchema,
  workspaceInvitationRequestSchema,
  workspaceSummarySchema
} from "@wevlo/contracts";
import type { Database } from "@wevlo/data-access";
import { healthcheckDatabase } from "@wevlo/data-access";
import { recordAuditEvent } from "@wevlo/audit-activity";
import { can, canWorkspace } from "@wevlo/authz";
import {
  createWorkspaceInvitationUseCase,
  createWorkspaceUseCase,
  getWorkspaceBySlugUseCase,
  listWorkspaceInvitationsUseCase,
  listWorkspaceMembersUseCase,
  listVisibleWorkspacesUseCase,
  PostgresIdentityRepository,
  PostgresWorkspaceRepository,
  resolveCurrentUserUseCase,
  WorkspaceSlugGenerationFailedError,
  WorkspaceSlugTakenError
} from "@wevlo/identity-tenancy";
import {
  createProjectMemberUseCase,
  createProjectUseCase,
  getProjectByKeyUseCase,
  getProjectBoardConfigUseCase,
  listProjectMembersUseCase,
  listWorkspaceProjectsUseCase,
  PostgresProjectBoardConfigRepository,
  PostgresProjectCollaborationRepository,
  PostgresProjectRepository,
  ProjectKeyGenerationFailedError,
  removeProjectMemberUseCase,
  ProjectAlreadyExistsError,
  updateProjectBoardConfigUseCase,
  WorkspaceMembershipRequiredError
} from "@wevlo/projects";
import {
  createInstallationUseCase,
  createProjectLinkUseCase,
  importRemoteIssuesUseCase,
  listProjectLinksUseCase,
  listProjectSyncStatusesUseCase,
  listWorkspaceInstallationsUseCase,
  PostgresIntegrationRepository,
  receiveWebhookDeliveryUseCase
} from "@wevlo/integrations";
import {
  acceptTriageUseCase,
  commentOnIssueUseCase,
  createIssueUseCase,
  getIssueBoardUseCase,
  getIssueUseCase,
  IssueMutationNotAllowedError,
  IssueNotFoundError,
  IssueTransitionNotAllowedError,
  IssueTriageStatusError,
  listIssuesUseCase,
  PostgresIssueRepository,
  resolveProjectBoardViewUseCase,
  transitionIssueUseCase,
  triageIssueUseCase,
  updateIssueUseCase
} from "@wevlo/issues";

import { getRequestIdentity } from "./dev-session";
import { sendError, UnauthorizedError } from "./errors";

export type ApiDependencies = {
  database: Database;
};

export const buildApi = ({ database }: ApiDependencies) => {
  const app = Fastify({
    logger: true
  });

  const identityRepository = new PostgresIdentityRepository(database);
  const workspaceRepository = new PostgresWorkspaceRepository(database);
  const projectRepository = new PostgresProjectRepository(database);
  const projectBoardConfigRepository = new PostgresProjectBoardConfigRepository(database);
  const projectCollaborationRepository = new PostgresProjectCollaborationRepository(database);
  const issueRepository = new PostgresIssueRepository(database);
  const integrationRepository = new PostgresIntegrationRepository(database);

  const resolveCurrentUser = async (request: Parameters<typeof getRequestIdentity>[0]) => {
    const identity = getRequestIdentity(request);
    return resolveCurrentUserUseCase(identityRepository, {
      email: identity.email,
      name: identity.name,
      provider: identity.provider,
      providerUserId: identity.providerUserId
    });
  };

  const recordAudit = async (input: {
    action: string;
    actorId: string;
    resourceId: string;
    workspaceId?: string;
    projectId?: string;
    issueId?: string;
    payload?: Record<string, unknown>;
  }) => {
    const auditEvent = recordAuditEvent({
      action: input.action,
      actorId: input.actorId,
      resourceId: input.resourceId
    });

    await database
      .insertInto("audit_events")
      .values({
        action: auditEvent.action,
        actor_id: auditEvent.actorId,
        id: auditEvent.id,
        issue_id: input.issueId ?? null,
        occurred_at: auditEvent.occurredAt,
        payload: input.payload ? JSON.stringify(input.payload) : null,
        project_id: input.projectId ?? null,
        resource_id: auditEvent.resourceId,
        workspace_id: input.workspaceId ?? null
      })
      .execute();
  };

  const filterIssuesByScope = <TIssue extends {
    assigneeUserId: string | null;
    reporterUserId: string;
  }>(issues: TIssue[], userId: string, scope: ListIssueScope) => {
    switch (scope) {
      case "assigned":
        return issues.filter((issue) => issue.assigneeUserId === userId);
      case "created":
        return issues.filter((issue) => issue.reporterUserId === userId);
      case "all":
      default:
        return issues;
    }
  };

  const resolveProjectAccess = async (
    userId: string,
    params: {
      projectKey: string;
      workspaceSlug: string;
    }
  ) => {
    const workspace = await getWorkspaceBySlugUseCase(workspaceRepository, userId, params.workspaceSlug);

    if (!workspace) {
      return {
        project: null,
        workspace: null
      } as const;
    }

    const project = await getProjectByKeyUseCase(projectRepository, {
      projectKey: params.projectKey,
      userId,
      workspaceId: workspace.id
    });

    return {
      project,
      workspace
    } as const;
  };

  const resolveWorkspaceAccess = async (
    userId: string,
    workspaceSlug: string
  ) => {
    const workspace = await getWorkspaceBySlugUseCase(workspaceRepository, userId, workspaceSlug);

    if (!workspace) {
      return {
        membership: null,
        workspace: null
      } as const;
    }

    const memberships = await listWorkspaceMembersUseCase(identityRepository, workspace.id);
    const membership = memberships.find((candidate) => candidate.userId === userId) ?? null;

    return {
      membership,
      workspace
    } as const;
  };

  const requireWorkspaceAction = (
    reply: FastifyReply,
    membership: { role: "Owner" | "Member" } | null,
    action: "workspace.view" | "workspace.invite" | "workspace.manage",
    deniedMessage: string
  ) => {
    if (!membership || !canWorkspace(membership.role, action)) {
      return sendError(reply, 403, "workspace.forbidden", deniedMessage);
    }

    return null;
  };

  app.register(cors, {
    allowedHeaders: ["content-type", "x-dev-user-id"],
    origin: true
  });

  app.get("/health", async (_request, reply) => {
    await healthcheckDatabase(database);
    return reply.send({ status: "ok" });
  });

  app.post("/integrations/github/webhooks", async (request, reply) => {
    try {
      const delivery = await receiveWebhookDeliveryUseCase({
        body: typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {}),
        eventType: String(request.headers["x-github-event"] ?? "unknown"),
        headers: Object.fromEntries(
          Object.entries(request.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
        ),
        provider: "github",
        repository: integrationRepository
      });

      return reply.status(202).send(delivery);
    } catch (error) {
      return sendError(
        reply,
        401,
        "integration.webhook_invalid",
        error instanceof Error ? error.message : "Webhook rejected"
      );
    }
  });

  app.post("/integrations/gitlab/webhooks", async (request, reply) => {
    try {
      const delivery = await receiveWebhookDeliveryUseCase({
        body: typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {}),
        eventType: String(request.headers["x-gitlab-event"] ?? "unknown"),
        headers: Object.fromEntries(
          Object.entries(request.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
        ),
        provider: "gitlab",
        repository: integrationRepository
      });

      return reply.status(202).send(delivery);
    } catch (error) {
      return sendError(
        reply,
        401,
        "integration.webhook_invalid",
        error instanceof Error ? error.message : "Webhook rejected"
      );
    }
  });

  app.get("/session", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    const userId = currentUser.id;
    const workspaces = await listVisibleWorkspacesUseCase(workspaceRepository, userId);
    const payload = sessionSchema.parse({
      defaultWorkspaceSlug: workspaces[0]?.slug ?? null,
      email: currentUser.email,
      name: currentUser.name,
      userId,
      workspaceIds: workspaces.map((workspace) => workspace.id)
    });

    return reply.send(payload);
  });

  app.get("/me", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    const workspaceMemberships = await identityRepository.listMembershipsForUser(currentUser.id);
    const projectMemberships = await projectCollaborationRepository.listMembershipsForUser(currentUser.id);

    return reply.send(
      meSchema.parse({
        projectMemberships,
        user: currentUser,
        workspaceMemberships
      })
    );
  });

  app.get("/workspaces", async (request, reply) => {
    const userId = (await resolveCurrentUser(request)).id;
    const workspaces = await listVisibleWorkspacesUseCase(workspaceRepository, userId);
    return reply.send(workspaces.map((workspace) => workspaceSummarySchema.parse(workspace)));
  });

  app.post("/workspaces", async (request, reply) => {
    const payload = createWorkspaceRequestSchema.parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const userId = currentUser.id;

    try {
      const workspace = await createWorkspaceUseCase(workspaceRepository, {
        name: payload.name,
        ownerUserId: userId,
        slug: payload.slug
      });
      await recordAudit({
        action: "workspace.create",
        actorId: userId,
        resourceId: workspace.id,
        workspaceId: workspace.id
      });

      return reply.status(201).send(workspace);
    } catch (error) {
      if (error instanceof WorkspaceSlugTakenError) {
        return sendError(reply, 409, "workspace.slug_conflict", error.message);
      }

      if (error instanceof WorkspaceSlugGenerationFailedError) {
        return sendError(reply, 409, "workspace.slug_unavailable", error.message);
      }

      throw error;
    }
  });

  app.get("/workspaces/:workspaceSlug", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const userId = (await resolveCurrentUser(request)).id;
    const workspace = await getWorkspaceBySlugUseCase(workspaceRepository, userId, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    return reply.send(workspace);
  });

  app.get("/workspaces/:workspaceSlug/integrations/installations", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const userId = (await resolveCurrentUser(request)).id;
    const { membership, workspace } = await resolveWorkspaceAccess(userId, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!membership || !canWorkspace(membership.role, "workspace.view")) {
      return sendError(reply, 403, "workspace.forbidden", "Workspace access denied");
    }

    const installations = await listWorkspaceInstallationsUseCase(integrationRepository, workspace.id);
    return reply.send(installations);
  });

  app.post("/workspaces/:workspaceSlug/integrations/:provider/installations", async (request, reply) => {
    const params = request.params as {
      provider: "github" | "gitlab";
      workspaceSlug: string;
    };
    const payload = createIntegrationInstallationRequestSchema.parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const { membership, workspace } = await resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!membership || !canWorkspace(membership.role, "workspace.manage")) {
      return sendError(reply, 403, "workspace.forbidden", "Workspace integration management denied");
    }

    const installation = await createInstallationUseCase(integrationRepository, {
      ...payload,
      createdByUserId: currentUser.id,
      provider: params.provider,
      workspaceId: workspace.id
    });

    await recordAudit({
      action: "integration.installation.create",
      actorId: currentUser.id,
      payload: {
        installationId: installation.id,
        provider: installation.provider
      },
      resourceId: installation.id,
      workspaceId: workspace.id
    });

    return reply.status(201).send(installation);
  });

  app.get("/workspaces/:workspaceSlug/projects", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const userId = (await resolveCurrentUser(request)).id;
    const workspace = await getWorkspaceBySlugUseCase(workspaceRepository, userId, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    const projects = await listWorkspaceProjectsUseCase(projectRepository, {
      userId,
      workspaceId: workspace.id
    });

    return reply.send(projects);
  });

  app.post("/workspaces/:workspaceSlug/projects", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const payload = createProjectRequestSchema.parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const userId = currentUser.id;
    const workspace = await getWorkspaceBySlugUseCase(workspaceRepository, userId, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    try {
      const project = await createProjectUseCase(projectRepository, {
        key: payload.key,
        name: payload.name,
        ownerUserId: userId,
        workspaceId: workspace.id
      });
      const readableProject = await getProjectByKeyUseCase(projectRepository, {
        projectKey: project.key,
        userId,
        workspaceId: workspace.id
      });
      await recordAudit({
        action: "project.create",
        actorId: userId,
        projectId: project.id,
        resourceId: project.id,
        workspaceId: workspace.id
      });

      return reply.status(201).send(readableProject ?? project);
    } catch (error) {
      if (error instanceof WorkspaceMembershipRequiredError) {
        return sendError(reply, 403, "workspace.membership_required", error.message);
      }

      if (error instanceof ProjectAlreadyExistsError) {
        return sendError(reply, 409, "project.key_conflict", error.message);
      }

      if (error instanceof ProjectKeyGenerationFailedError) {
        return sendError(reply, 409, "project.key_unavailable", error.message);
      }

      throw error;
    }
  });

  app.get("/workspaces/:workspaceSlug/projects/:projectKey", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const userId = (await resolveCurrentUser(request)).id;
    const workspace = await getWorkspaceBySlugUseCase(workspaceRepository, userId, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    const project = await getProjectByKeyUseCase(projectRepository, {
      projectKey: params.projectKey,
      userId,
      workspaceId: workspace.id
    });

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    return reply.send(project);
  });

  app.get("/workspaces/:workspaceSlug/projects/:projectKey/integrations/links", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const userId = (await resolveCurrentUser(request)).id;
    const { project, workspace } = await resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const [links, syncStatuses] = await Promise.all([
      listProjectLinksUseCase(integrationRepository, project.id),
      listProjectSyncStatusesUseCase(integrationRepository, project.id)
    ]);

    return reply.send({
      links,
      syncStatuses
    });
  });

  app.post("/workspaces/:workspaceSlug/projects/:projectKey/integrations/:provider/links", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      provider: "github" | "gitlab";
      workspaceSlug: string;
    };
    const payload = createIntegrationProjectLinkRequestSchema.parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "integration.manage")) {
      return sendError(reply, 403, "project.forbidden", "Project integration management denied");
    }

    const installation = await integrationRepository.findInstallationById(payload.installationId);

    if (!installation || installation.workspaceId !== workspace.id || installation.provider !== params.provider) {
      return sendError(reply, 404, "integration.installation_not_found", "Integration installation not found");
    }

    const projectLink = await createProjectLinkUseCase(integrationRepository, {
      ...payload,
      projectId: project.id,
      provider: params.provider
    });

    await recordAudit({
      action: "integration.project_link.create",
      actorId: currentUser.id,
      payload: {
        projectLinkId: projectLink.id,
        provider: projectLink.provider
      },
      projectId: project.id,
      resourceId: projectLink.id,
      workspaceId: workspace.id
    });

    return reply.status(201).send(projectLink);
  });

  app.post("/workspaces/:workspaceSlug/projects/:projectKey/integrations/:provider/import", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      provider: "github" | "gitlab";
      workspaceSlug: string;
    };
    const payload = importIntegrationProjectIssuesRequestSchema.parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "integration.manage")) {
      return sendError(reply, 403, "project.forbidden", "Project integration management denied");
    }

    const result = await importRemoteIssuesUseCase({
      issueRepository,
      issues: payload.issues,
      projectId: project.id,
      provider: params.provider,
      repository: integrationRepository
    });

    await recordAudit({
      action: "integration.project_import",
      actorId: currentUser.id,
      payload: {
        importedCount: result.importedCount,
        provider: params.provider
      },
      projectId: project.id,
      resourceId: result.projectLink.id,
      workspaceId: workspace.id
    });

    return reply.send(result);
  });

  app.get("/workspaces/:workspaceSlug/projects/:projectKey/issues", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const query = listIssuesQuerySchema.parse(request.query);
    const userId = (await resolveCurrentUser(request)).id;
    const { project, workspace } = await resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const issues = await listIssuesUseCase(issueRepository, {
      projectId: project.id
    });

    return reply.send(filterIssuesByScope(issues, userId, query.scope ?? "all"));
  });

  app.post("/workspaces/:workspaceSlug/projects/:projectKey/issues", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = createIssueRequestSchema.parse(request.body);
    const userId = (await resolveCurrentUser(request)).id;
    const { project, workspace } = await resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.create")) {
      return sendError(reply, 403, "issue.forbidden", "Issue creation denied");
    }

    const issue = await createIssueUseCase(issueRepository, {
      description: payload.description,
      projectId: project.id,
      projectKey: project.key,
      reporterUserId: userId,
      title: payload.title
    });

    await recordAudit({
      action: "issue.create",
      actorId: userId,
      issueId: issue.id,
      payload: {
        issueKey: issue.issueKey
      },
      projectId: project.id,
      resourceId: issue.id,
      workspaceId: workspace.id
    });

    return reply.status(201).send(issue);
  });

  app.get("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const userId = (await resolveCurrentUser(request)).id;
    const { project, workspace } = await resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const issue = await getIssueUseCase(issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!issue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    return reply.send(issue);
  });

  app.patch("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = updateIssueRequestSchema.parse(request.body);
    const userId = (await resolveCurrentUser(request)).id;
    const { project, workspace } = await resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.edit")) {
      return sendError(reply, 403, "issue.forbidden", "Issue editing denied");
    }

    try {
      const changes = {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
        ...(payload.assigneeUserId !== undefined ? { assigneeUserId: payload.assigneeUserId } : {})
      };

      const issue = await updateIssueUseCase(issueRepository, {
        actor: "local",
        changes,
        issueKey: params.issueKey,
        projectId: project.id
      });

      await recordAudit({
        action: "issue.update",
        actorId: userId,
        issueId: issue.id,
        payload,
        projectId: project.id,
        resourceId: issue.id,
        workspaceId: workspace.id
      });

      return reply.send(issue);
    } catch (error) {
      if (error instanceof IssueNotFoundError) {
        return sendError(reply, 404, "issue.not_found", error.message);
      }

      if (error instanceof IssueMutationNotAllowedError) {
        return sendError(reply, 409, "issue.mutation_not_allowed", error.message);
      }

      throw error;
    }
  });

  app.post("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/transition", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = transitionIssueRequestSchema.parse(request.body);
    const userId = (await resolveCurrentUser(request)).id;
    const { project, workspace } = await resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.transition")) {
      return sendError(reply, 403, "issue.forbidden", "Issue transition denied");
    }

    try {
      const issue = await transitionIssueUseCase(issueRepository, {
        actor: "local",
        issueKey: params.issueKey,
        nextState: payload.state,
        projectId: project.id
      });

      await recordAudit({
        action: "issue.transition",
        actorId: userId,
        issueId: issue.id,
        payload,
        projectId: project.id,
        resourceId: issue.id,
        workspaceId: workspace.id
      });

      return reply.send(issue);
    } catch (error) {
      if (error instanceof IssueNotFoundError) {
        return sendError(reply, 404, "issue.not_found", error.message);
      }

      if (error instanceof IssueTransitionNotAllowedError || error instanceof IssueMutationNotAllowedError) {
        return sendError(reply, 409, "issue.transition_not_allowed", error.message);
      }

      throw error;
    }
  });

  app.post("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/comments", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = createCommentRequestSchema.parse(request.body);
    const userId = (await resolveCurrentUser(request)).id;
    const { project, workspace } = await resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "issue.forbidden", "Issue comment denied");
    }

    try {
      const issue = await commentOnIssueUseCase(issueRepository, {
        authorUserId: userId,
        body: payload.body,
        issueKey: params.issueKey,
        projectId: project.id
      });

      await recordAudit({
        action: "issue.comment.add",
        actorId: userId,
        issueId: issue.id,
        payload,
        projectId: project.id,
        resourceId: issue.id,
        workspaceId: workspace.id
      });

      return reply.status(201).send(issue);
    } catch (error) {
      if (error instanceof IssueNotFoundError) {
        return sendError(reply, 404, "issue.not_found", error.message);
      }

      throw error;
    }
  });

  app.get("/workspaces/:workspaceSlug/projects/:projectKey/board", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const userId = (await resolveCurrentUser(request)).id;
    const { project, workspace } = await resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const [boardConfig, issues] = await Promise.all([
      getProjectBoardConfigUseCase(projectBoardConfigRepository, {
        projectId: project.id
      }),
      issueRepository.listByProject(project.id)
    ]);

    const board = resolveProjectBoardViewUseCase(issues, boardConfig);

    return reply.send(board);
  });

  app.get("/workspaces/:workspaceSlug/projects/:projectKey/board-config", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const currentUser = await resolveCurrentUser(request);
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const config = await getProjectBoardConfigUseCase(projectBoardConfigRepository, {
      projectId: project.id
    });

    return reply.send(config);
  });

  app.patch("/workspaces/:workspaceSlug/projects/:projectKey/board-config", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = updateProjectBoardConfigRequestSchema.parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.manage")) {
      return sendError(reply, 403, "project.forbidden", "Project board settings denied");
    }

    const config = await updateProjectBoardConfigUseCase(projectBoardConfigRepository, {
      projectId: project.id,
      columns: payload.columns
    });

    await recordAudit({
      action: "project.board.update",
      actorId: currentUser.id,
      payload,
      projectId: project.id,
      resourceId: project.id,
      workspaceId: workspace.id
    });

    return reply.send(config);
  });

  app.get("/workspaces/:workspaceSlug/projects/:projectKey/triage", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const userId = (await resolveCurrentUser(request)).id;
    const { project, workspace } = await resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const issues = await listIssuesUseCase(issueRepository, {
      projectId: project.id
    });

    return reply.send(issues.filter((issue) => issue.triageStatus === "pending"));
  });

  app.post("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/triage", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = updateIssueRequestSchema.parse(request.body);
    const userId = (await resolveCurrentUser(request)).id;
    const { project, workspace } = await resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.prioritize")) {
      return sendError(reply, 403, "issue.forbidden", "Issue triage denied");
    }

    try {
      const triageInput = {
        actor: "local" as const,
        issueKey: params.issueKey,
        projectId: project.id,
        ...(payload.assigneeUserId !== undefined ? { assigneeUserId: payload.assigneeUserId } : {}),
        ...(payload.priority !== undefined ? { priority: payload.priority } : {})
      };

      const issue = await triageIssueUseCase(issueRepository, {
        ...triageInput
      });

      await recordAudit({
        action: "issue.triage",
        actorId: userId,
        issueId: issue.id,
        payload,
        projectId: project.id,
        resourceId: issue.id,
        workspaceId: workspace.id
      });

      return reply.send(issue);
    } catch (error) {
      if (error instanceof IssueNotFoundError) {
        return sendError(reply, 404, "issue.not_found", error.message);
      }

      if (error instanceof IssueMutationNotAllowedError || error instanceof IssueTriageStatusError) {
        return sendError(reply, 409, "issue.triage_not_allowed", error.message);
      }

      throw error;
    }
  });

  app.post("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/triage/accept", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const userId = (await resolveCurrentUser(request)).id;
    const { project, workspace } = await resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.prioritize")) {
      return sendError(reply, 403, "issue.forbidden", "Issue triage denied");
    }

    try {
      const issue = await acceptTriageUseCase(issueRepository, {
        actor: "local",
        issueKey: params.issueKey,
        projectId: project.id
      });

      await recordAudit({
        action: "issue.triage.accept",
        actorId: userId,
        issueId: issue.id,
        projectId: project.id,
        resourceId: issue.id,
        workspaceId: workspace.id
      });

      return reply.send(issue);
    } catch (error) {
      if (error instanceof IssueNotFoundError) {
        return sendError(reply, 404, "issue.not_found", error.message);
      }

      if (error instanceof IssueMutationNotAllowedError || error instanceof IssueTriageStatusError) {
        return sendError(reply, 409, "issue.triage_not_allowed", error.message);
      }

      throw error;
    }
  });

  app.get("/workspaces/:workspaceSlug/members", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const currentUser = await resolveCurrentUser(request);
    const { membership, workspace } = await resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (requireWorkspaceAction(reply, membership, "workspace.view", "Workspace access denied")) {
      return;
    }

    const members = await listWorkspaceMembersUseCase(identityRepository, workspace.id);
    return reply.send(members);
  });

  app.get("/workspaces/:workspaceSlug/invitations", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const currentUser = await resolveCurrentUser(request);
    const { membership, workspace } = await resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (requireWorkspaceAction(reply, membership, "workspace.view", "Workspace access denied")) {
      return;
    }

    const invitations = await listWorkspaceInvitationsUseCase(identityRepository, workspace.id);
    return reply.send(invitations);
  });

  app.post("/workspaces/:workspaceSlug/invitations", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const payload = workspaceInvitationRequestSchema.parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const { membership, workspace } = await resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (requireWorkspaceAction(reply, membership, "workspace.invite", "Workspace invite denied")) {
      return;
    }

    const invitation = await createWorkspaceInvitationUseCase(identityRepository, {
      inviteeEmail: payload.email ?? null,
      inviteeUserId: payload.userId ?? null,
      invitedByUserId: currentUser.id,
      role: payload.role,
      workspaceId: workspace.id
    });

    await recordAudit({
      action: "workspace.invite",
      actorId: currentUser.id,
      payload: {
        inviteeEmail: invitation.inviteeEmail,
        invitationId: invitation.id,
        role: invitation.role
      },
      resourceId: invitation.id,
      workspaceId: workspace.id
    });

    return reply.status(201).send(invitation);
  });

  app.get("/workspace-invitations/:acceptToken", async (request, reply) => {
    const params = request.params as { acceptToken: string };
    const invitation = await identityRepository.findInvitationByToken(params.acceptToken);

    if (!invitation) {
      return sendError(reply, 404, "workspace.invitation_not_found", "Invitation not found");
    }

    return reply.send(invitation);
  });

  app.post("/workspaces/:workspaceSlug/invitations/:invitationId/accept", async (request, reply) => {
    const params = request.params as {
      invitationId: string;
      workspaceSlug: string;
    };
    const currentUser = await resolveCurrentUser(request);
    const invitation = await identityRepository.findInvitationById(params.invitationId);

    if (!invitation) {
      return sendError(reply, 404, "workspace.invitation_not_found", "Invitation not found");
    }

    if (invitation.workspaceId && invitation.acceptedAt) {
      return reply.send(invitation);
    }

    const workspace = await getWorkspaceBySlugUseCase(workspaceRepository, currentUser.id, params.workspaceSlug)
      ?? await workspaceRepository.findBySlug(params.workspaceSlug);

    if (!workspace || workspace.id !== invitation.workspaceId) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (invitation.status !== "pending") {
      return sendError(reply, 409, "workspace.invitation_not_pending", "Invitation is not pending");
    }

    if (invitation.inviteeEmail && currentUser.email && invitation.inviteeEmail !== currentUser.email) {
      return sendError(reply, 403, "workspace.invitation_email_mismatch", "Invitation email does not match current user");
    }

    const accepted = await identityRepository.acceptInvitation(invitation.id, currentUser.id);

    if (!accepted) {
      return sendError(reply, 404, "workspace.invitation_not_found", "Invitation not found");
    }

    await recordAudit({
      action: "workspace.invite.accept",
      actorId: currentUser.id,
      payload: {
        invitationId: accepted.id
      },
      resourceId: accepted.id,
      workspaceId: accepted.workspaceId
    });

    return reply.send(accepted);
  });

  app.post("/workspace-invitations/:acceptToken/accept", async (request, reply) => {
    const params = request.params as { acceptToken: string };
    const currentUser = await resolveCurrentUser(request);
    const invitation = await identityRepository.findInvitationByToken(params.acceptToken);

    if (!invitation) {
      return sendError(reply, 404, "workspace.invitation_not_found", "Invitation not found");
    }

    if (invitation.status !== "pending") {
      return sendError(reply, 409, "workspace.invitation_not_pending", "Invitation is not pending");
    }

    if (invitation.inviteeEmail && currentUser.email && invitation.inviteeEmail !== currentUser.email) {
      return sendError(reply, 403, "workspace.invitation_email_mismatch", "Invitation email does not match current user");
    }

    const accepted = await identityRepository.acceptInvitation(invitation.id, currentUser.id);

    if (!accepted) {
      return sendError(reply, 404, "workspace.invitation_not_found", "Invitation not found");
    }

    await recordAudit({
      action: "workspace.invite.accept",
      actorId: currentUser.id,
      payload: {
        invitationId: accepted.id
      },
      resourceId: accepted.id,
      workspaceId: accepted.workspaceId
    });

    return reply.send(accepted);
  });

  app.get("/workspaces/:workspaceSlug/projects/:projectKey/members", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const currentUser = await resolveCurrentUser(request);
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const members = await listProjectMembersUseCase(projectCollaborationRepository, project.id);
    return reply.send(members);
  });

  app.put("/workspaces/:workspaceSlug/projects/:projectKey/members/:userId", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      userId: string;
      workspaceSlug: string;
    };
    const payload = upsertProjectMemberRequestSchema.parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.manage")) {
      return sendError(reply, 403, "project.forbidden", "Project member management denied");
    }

    if (!(await projectRepository.isWorkspaceMember(workspace.id, params.userId))) {
      return sendError(reply, 403, "workspace.membership_required", "Workspace membership required");
    }

    const member = await createProjectMemberUseCase(projectCollaborationRepository, {
      projectId: project.id,
      role: payload.role,
      userId: params.userId
    });

    await recordAudit({
      action: "project.member.upsert",
      actorId: currentUser.id,
      payload: {
        role: member.role,
        userId: member.userId
      },
      projectId: project.id,
      resourceId: member.userId,
      workspaceId: workspace.id
    });

    return reply.send(member);
  });

  app.delete("/workspaces/:workspaceSlug/projects/:projectKey/members/:userId", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      userId: string;
      workspaceSlug: string;
    };
    const currentUser = await resolveCurrentUser(request);
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.manage")) {
      return sendError(reply, 403, "project.forbidden", "Project member management denied");
    }

    await removeProjectMemberUseCase(projectCollaborationRepository, {
      projectId: project.id,
      userId: params.userId
    });

    await recordAudit({
      action: "project.member.remove",
      actorId: currentUser.id,
      payload: {
        userId: params.userId
      },
      projectId: project.id,
      resourceId: params.userId,
      workspaceId: workspace.id
    });

    return reply.status(204).send();
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof UnauthorizedError) {
      return reply.status(401).send({
        code: "auth.unauthorized",
        message: error.message
      } satisfies ErrorEnvelopeDto);
    }

    if (error instanceof ZodError) {
      const message = error.message || "Validation failed";
      return reply.status(400).send({
        code: "validation.failed",
        message
      } satisfies ErrorEnvelopeDto);
    }

    app.log.error(error);

    return reply.status(500).send({
      code: "internal_error",
      message: "Unexpected server error"
    } satisfies ErrorEnvelopeDto);
  });

  return app;
};
