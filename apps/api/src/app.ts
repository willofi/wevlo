import Fastify, { type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";

import {
  createIntegrationInstallationRequestSchema,
  createIntegrationProjectLinkRequestSchema,
  createIssueLabelRequestSchema,
  createCommentRequestSchema,
  handleAvailabilityQuerySchema,
  importIntegrationProjectIssuesRequestSchema,
  createIssueRequestSchema,
  notificationIdsRequestSchema,
  notificationListQuerySchema,
  notificationSummarySchema,
  notificationListResponseSchema,
  notificationPreferenceSchema,
  updateNotificationPreferencesRequestSchema,
  updateProfileRequestSchema,
  createProjectRequestSchema,
  projectInvitationRequestSchema,
  createWorkspaceRequestSchema,
  type ErrorEnvelopeDto,
  handleAvailabilitySchema,
  issueSubscriptionResponseSchema,
  workspaceSearchQuerySchema,
  meSchema,
  myIssuesQuerySchema,
  myIssuesResponseSchema,
  listIssuesQuerySchema,
  type ListIssueScope,
  transitionIssueRequestSchema,
  updateIssueReactionRequestSchema,
  upsertProjectMemberRequestSchema,
  updateIssueSubscriptionRequestSchema,
  updateProjectBoardConfigRequestSchema,
  updateIssueRequestSchema,
  sessionSchema,
  workspaceInvitationRequestSchema,
  workspaceSummarySchema
} from "@wevlo/contracts";
import type { Database, DatabaseExecutor } from "@wevlo/data-access";
import { healthcheckDatabase, runInTransaction } from "@wevlo/data-access";
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
  removeWorkspaceMemberUseCase,
  resolveCurrentUserUseCase,
  updateWorkspaceMemberUseCase,
  UserHandleTakenError,
  WorkspaceSlugGenerationFailedError,
  WorkspaceSlugTakenError
} from "@wevlo/identity-tenancy";
import {
  createProjectInvitationUseCase,
  createProjectMemberUseCase,
  createProjectUseCase,
  getProjectByKeyUseCase,
  getProjectBoardConfigUseCase,
  listProjectInvitationsUseCase,
  listProjectMembersUseCase,
  listWorkspaceProjectsUseCase,
  PostgresProjectBoardConfigRepository,
  PostgresProjectCollaborationRepository,
  PostgresProjectRepository,
  ProjectKeyGenerationFailedError,
  removeProjectMemberUseCase,
  revokeProjectInvitationUseCase,
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
  extractCommentMentions,
  extractIssueMentions,
  commentOnIssueUseCase,
  createIssueUseCase,
  getIssueUseCase,
  IssueAlreadyExistsError,
  IssueMutationNotAllowedError,
  IssueNotFoundError,
  IssueTransitionNotAllowedError,
  IssueTriageStatusError,
  listIssuesUseCase,
  PostgresIssueRepository,
  resolveProjectBoardViewUseCase,
  setCommentReactionUseCase,
  transitionIssueUseCase,
  triageIssueUseCase,
  updateIssueUseCase
} from "@wevlo/issues";
import { PostgresNotificationRepository } from "@wevlo/notifications";

import { getRequestIdentity } from "./dev-session.js";
import { sendError, UnauthorizedError } from "./errors.js";
import { createAttachmentStorageFromEnv } from "./attachment-storage-factory.js";
import {
  buildIssueAssignedEvent,
  buildIssueCommentEvent,
  buildIssueDescriptionMentionEvent,
  buildProjectAccessGrantedEvent,
  buildProjectInvitationAcceptedEvent,
  buildProjectInvitationReceivedEvent,
  buildProjectInvitationRevokedEvent,
  buildWorkspaceInvitationAcceptedEvent,
  buildWorkspaceInvitationReceivedEvent
} from "./notification-events.js";

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
  const notificationRepository = new PostgresNotificationRepository(database);
  const attachmentStorage = createAttachmentStorageFromEnv();

  const createScopedRepositories = (executor: DatabaseExecutor) => ({
    identityRepository: new PostgresIdentityRepository(executor),
    integrationRepository: new PostgresIntegrationRepository(executor),
    issueRepository: new PostgresIssueRepository(executor),
    notificationRepository: new PostgresNotificationRepository(executor),
    projectCollaborationRepository: new PostgresProjectCollaborationRepository(executor)
  });

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

  const resolvePersonalIssueFilters = async (
    userId: string,
    query: {
      projectKey?: string | undefined;
      workspaceSlug?: string | undefined;
    }
  ) => {
    if (!query.workspaceSlug) {
      return {
        project: null,
        workspace: null
      } as const;
    }

    const workspace = await getWorkspaceBySlugUseCase(workspaceRepository, userId, query.workspaceSlug);

    if (!workspace) {
      return {
        project: null,
        workspace: null
      } as const;
    }

    if (!query.projectKey) {
      return {
        project: null,
        workspace
      } as const;
    }

    const project = await getProjectByKeyUseCase(projectRepository, {
      projectKey: query.projectKey,
      userId,
      workspaceId: workspace.id
    });

    return {
      project,
      workspace
    } as const;
  };

  const formatIssueStateLabel = (state: string) => {
    switch (state) {
      case "backlog":
        return "Backlog";
      case "todo":
        return "Todo";
      case "in_progress":
        return "In progress";
      case "done":
        return "Done";
      case "canceled":
        return "Canceled";
      default:
        return state;
    }
  };

  const formatIssuePriorityLabel = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "Urgent";
      case "high":
        return "High";
      case "medium":
        return "Medium";
      case "low":
        return "Low";
      case "none":
      default:
        return "No priority";
    }
  };

  const buildIssueActivitySummary = (input: {
    action: string;
    labelNameById: Map<string, string>;
    payload: Record<string, unknown>;
  }) => {
    if (input.action.startsWith("issue.update.")) {
      const field = input.action.replace("issue.update.", "");
      switch (field) {
        case "title":
          return "updated title";
        case "description":
          return "updated description";
        case "priority":
          return `set priority to ${formatIssuePriorityLabel(String(input.payload.to ?? "none"))}`;
        case "dueDate":
          return input.payload.to ? `set due date to ${String(input.payload.to)}` : "cleared due date";
        case "assigneeUserId":
          return input.payload.to ? "changed assignee" : "cleared assignee";
        case "labels": {
          const labels = Array.isArray(input.payload.to) ? (input.payload.to as Array<{ name: string }>) : [];
          const labelNames = labels.map((l) => l.name);
          return labelNames.length > 0 ? `updated labels to ${labelNames.join(", ")}` : "updated labels";
        }
        default:
          return `updated ${field}`;
      }
    }

    switch (input.action) {
      case "issue.create":
        return "created the issue";
      case "issue.transition":
        return `moved status to ${formatIssueStateLabel(String(input.payload.state ?? ""))}`;
      case "issue.attachment.create":
        return `attached ${String(input.payload.fileName ?? "a file")}`;
      case "issue.attachment.delete":
        return `removed ${String(input.payload.fileName ?? "an attachment")}`;
      case "issue.update": {
        const changes: string[] = [];

        if ("title" in input.payload) {
          changes.push("updated title");
        }

        if ("description" in input.payload) {
          changes.push("updated description");
        }

        if ("priority" in input.payload) {
          changes.push(`set priority to ${formatIssuePriorityLabel(String(input.payload.priority ?? "none"))}`);
        }

        if ("dueDate" in input.payload) {
          changes.push(input.payload.dueDate ? `set due date to ${String(input.payload.dueDate)}` : "cleared due date");
        }

        if ("assigneeUserId" in input.payload) {
          changes.push(input.payload.assigneeUserId ? "changed assignee" : "cleared assignee");
        }

        if ("labelIds" in input.payload) {
          const labelIds = Array.isArray(input.payload.labelIds) ? (input.payload.labelIds as string[]) : [];
          const labelNames = labelIds
            .map((labelId) => input.labelNameById.get(labelId))
            .filter((labelName): labelName is string => Boolean(labelName));
          changes.push(labelNames.length > 0 ? `updated labels to ${labelNames.join(", ")}` : "updated labels");
        }

        return changes.length > 0 ? changes.join(", ") : "updated the issue";
      }
      default:
        return null;
    }
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

  const getProjectIdentity = async (projectId: string) => {
    return database
      .selectFrom("projects")
      .select(["id", "project_key", "workspace_id"])
      .where("id", "=", projectId)
      .executeTakeFirst();
  };

  const resolveProjectLabels = async (projectId: string, labelIds: string[] | undefined) => {
    const labels = await issueRepository.listLabels(projectId);
    const requested = new Set(labelIds ?? []);

    if (requested.size === 0) {
      return [] as typeof labels;
    }

    const selected = labels.filter((label) => requested.has(label.id));

    if (selected.length !== requested.size) {
      throw new Error("One or more labels do not belong to this project.");
    }

    return selected;
  };

  app.register(cors, {
    allowedHeaders: ["content-type", "x-dev-user-id"],
    origin: true
  });
  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1
    }
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

  app.get("/me/handle-availability", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    const query = handleAvailabilityQuerySchema.parse(request.query);
    const available = await identityRepository.isHandleAvailable(query.handle, currentUser.id);

    return reply.send(
      handleAvailabilitySchema.parse({
        available,
        handle: query.handle
      })
    );
  });

  app.patch("/me/profile", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    const payload = updateProfileRequestSchema.parse(request.body);

    try {
      const updatedUser = await identityRepository.updateProfile({
        ...(payload.handle !== undefined ? { handle: payload.handle } : {}),
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        userId: currentUser.id
      });

      return reply.send(updatedUser);
    } catch (error) {
      if (error instanceof UserHandleTakenError) {
        return sendError(reply, 409, "me.handle_taken", error.message);
      }

      throw error;
    }
  });

  app.get("/me/issues", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    const query = myIssuesQuerySchema.parse(request.query);
    const { project, workspace } = await resolvePersonalIssueFilters(currentUser.id, query);

    if (query.workspaceSlug && !workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (query.projectKey && !project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    const items = await issueRepository.listPersonalIssues({
      ...(project ? { projectId: project.id } : {}),
      tab: query.tab,
      userId: currentUser.id,
      ...(workspace ? { workspaceId: workspace.id } : {})
    });

    return reply.send(myIssuesResponseSchema.parse({ items }));
  });

  app.get("/notification-preferences", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    const preferences = await notificationRepository.getPreferences(currentUser.id);
    return reply.send(notificationPreferenceSchema.parse(preferences));
  });

  app.put("/notification-preferences", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    const payload = updateNotificationPreferencesRequestSchema.parse(request.body);
    const preferences = await notificationRepository.savePreferences(currentUser.id, payload);
    return reply.send(notificationPreferenceSchema.parse(preferences));
  });

  app.get("/notifications/summary", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    const summary = await notificationRepository.listSummary(currentUser.id);
    return reply.send(notificationSummarySchema.parse(summary));
  });

  app.get("/notifications", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    const query = notificationListQuerySchema.parse(request.query);
    const notifications = await notificationRepository.listNotifications({
      ...(query.category ? { category: query.category } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      status: query.status,
      userId: currentUser.id,
      ...(query.workspaceId ? { workspaceId: query.workspaceId } : {})
    });

    return reply.send(notificationListResponseSchema.parse(notifications));
  });

  app.post("/notifications/seen", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    const payload = notificationIdsRequestSchema.parse(request.body);
    await notificationRepository.markSeen(currentUser.id, payload.ids);
    return reply.status(204).send();
  });

  app.post("/notifications/read", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    const payload = notificationIdsRequestSchema.parse(request.body);
    await notificationRepository.markRead(currentUser.id, payload.ids);
    return reply.status(204).send();
  });

  app.post("/notifications/archive", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    const payload = notificationIdsRequestSchema.parse(request.body);
    await notificationRepository.archive(currentUser.id, payload.ids);
    return reply.status(204).send();
  });

  app.post("/notifications/read-all", async (request, reply) => {
    const currentUser = await resolveCurrentUser(request);
    await notificationRepository.markAllRead(currentUser.id);
    return reply.status(204).send();
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

  app.get("/workspaces/:workspaceSlug/search", async (request, reply) => {
    const params = request.params as {
      workspaceSlug: string;
    };
    const query = workspaceSearchQuerySchema.parse(request.query);
    const currentUser = await resolveCurrentUser(request);
    const { membership, workspace } = await resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!membership || !canWorkspace(membership.role, "workspace.view")) {
      return sendError(reply, 403, "workspace.forbidden", "Workspace access denied");
    }

    const needle = query.q.trim();

    if (needle.length === 0) {
      return reply.send({
        documents: [],
        issues: [],
        projects: []
      });
    }

    const pattern = `%${needle}%`;
    const shouldSearchIssues = query.scope === "all" || query.scope === "issues";
    const shouldSearchProjects = query.scope === "all" || query.scope === "projects";

    const [issues, projects] = await Promise.all([
      shouldSearchIssues
        ? database
            .selectFrom("issues")
            .innerJoin("projects", "projects.id", "issues.project_id")
            .innerJoin("project_memberships", "project_memberships.project_id", "projects.id")
            .select([
              "issues.id as id",
              "issues.issue_key as issueKey",
              "issues.title as title",
              "projects.id as projectId",
              "projects.project_key as projectKey",
              "issues.state as state",
              "issues.priority as priority",
              "issues.updated_at as updatedAt"
            ])
            .where("projects.workspace_id", "=", workspace.id)
            .where("project_memberships.user_id", "=", currentUser.id)
            .where((expressionBuilder) =>
              expressionBuilder.or([
                expressionBuilder("issues.issue_key", "ilike", pattern),
                expressionBuilder("issues.title", "ilike", pattern)
              ])
            )
            .orderBy("issues.updated_at", "desc")
            .limit(8)
            .execute()
        : Promise.resolve([]),
      shouldSearchProjects
        ? database
            .selectFrom("projects")
            .innerJoin("project_memberships", "project_memberships.project_id", "projects.id")
            .select([
              "projects.id as id",
              "projects.project_key as key",
              "projects.name as name",
              "projects.workspace_id as workspaceId"
            ])
            .where("projects.workspace_id", "=", workspace.id)
            .where("project_memberships.user_id", "=", currentUser.id)
            .where((expressionBuilder) =>
              expressionBuilder.or([
                expressionBuilder("projects.project_key", "ilike", pattern),
                expressionBuilder("projects.name", "ilike", pattern)
              ])
            )
            .orderBy("projects.updated_at", "desc")
            .limit(8)
            .execute()
        : Promise.resolve([])
    ]);

    return reply.send({
      documents: [],
      issues,
      projects
    });
  });

  app.get("/workspaces/:workspaceSlug/projects/:projectKey/labels", async (request, reply) => {
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

    const labels = await issueRepository.listLabels(project.id);
    return reply.send(labels);
  });

  app.post("/workspaces/:workspaceSlug/projects/:projectKey/labels", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = createIssueLabelRequestSchema.parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.edit")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const label = await issueRepository.createLabel({
      color: payload.color ?? "slate",
      name: payload.name,
      projectId: project.id
    });

    return reply.status(201).send(label);
  });

  app.post("/workspaces/:workspaceSlug/projects/:projectKey/issues", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = createIssueRequestSchema.parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const userId = currentUser.id;
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.create")) {
      return sendError(reply, 403, "issue.forbidden", "Issue creation denied");
    }

    const workspaceMembers = await listWorkspaceMembersUseCase(identityRepository, workspace.id);
    const descriptionMentions = extractIssueMentions(
      payload.description,
      workspaceMembers.map((member) => ({
        handle: member.user.handle,
        userId: member.userId
      }))
    );
    let labels: Awaited<ReturnType<typeof resolveProjectLabels>>;
    let parentIssueId: string | null = null;

    try {
      labels = await resolveProjectLabels(project.id, payload.labelIds);
    } catch (error) {
      return sendError(reply, 400, "issue.invalid_labels", error instanceof Error ? error.message : "Invalid labels");
    }

    if (payload.parentIssueKey) {
      const parentIssue = await getIssueUseCase(issueRepository, {
        issueKey: payload.parentIssueKey,
        projectId: project.id
      });

      if (!parentIssue) {
        return sendError(reply, 400, "issue.parent_not_found", "Parent issue not found");
      }

      parentIssueId = parentIssue.id;
    }

    const issue = await runInTransaction(database, async (trx) => {
      const scoped = createScopedRepositories(trx);
      const createdIssue = await createIssueUseCase(scoped.issueRepository, {
        description: payload.description,
        descriptionMentions,
        dueDate: payload.dueDate ?? null,
        labels,
        parentIssueId,
        projectId: project.id,
        projectKey: project.key,
        ...(payload.assigneeUserId !== undefined ? { assigneeUserId: payload.assigneeUserId } : {}),
        ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
        reporterUserId: userId,
        ...(payload.state !== undefined ? { state: payload.state } : {}),
        title: payload.title
      });

      await scoped.issueRepository.ensureSubscriptions({
        issueId: createdIssue.id,
        userIds: [
          userId,
          ...(createdIssue.assigneeUserId ? [createdIssue.assigneeUserId] : []),
          ...descriptionMentions.map((mention) => mention.userId)
        ]
      });

      const descriptionEvent = buildIssueDescriptionMentionEvent({
        actorName: currentUser.name,
        actorUserId: currentUser.id,
        issue: createdIssue,
        previousMentions: [],
        projectKey: project.key,
        workspaceMembers,
        workspaceSlug: workspace.slug
      });

      if (descriptionEvent) {
        await scoped.notificationRepository.enqueueEvent(descriptionEvent);
      }

      return createdIssue;
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

  app.put("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/comments/:commentId/reactions", async (request, reply) => {
    const params = request.params as {
      commentId: string;
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = updateIssueReactionRequestSchema.parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "issue.forbidden", "Issue reaction denied");
    }

    const issue = await setCommentReactionUseCase(issueRepository, {
      active: payload.active ?? true,
      commentId: params.commentId,
      emoji: payload.emoji,
      issueKey: params.issueKey,
      projectId: project.id,
      userId: currentUser.id
    });

    return reply.send(issue);
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

  app.get("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/activity", async (request, reply) => {
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

    const [auditRows, labelRows] = await Promise.all([
      database
        .selectFrom("audit_events")
        .select(["action", "actor_id", "id", "occurred_at", "payload"])
        .where("issue_id", "=", issue.id)
        .orderBy("occurred_at", "asc")
        .execute(),
      database
        .selectFrom("project_issue_labels")
        .select(["id", "name"])
        .where("project_id", "=", project.id)
        .execute()
    ]);

    const labelNameById = new Map(labelRows.map((row) => [row.id, row.name]));
    const items = auditRows
      .filter((row) => !["issue.comment.add", "issue.reaction.add", "issue.reaction.remove"].includes(row.action))
      .map((row) => {
        let payload: Record<string, unknown> = {};

        if (row.payload) {
          try {
            payload = JSON.parse(row.payload) as Record<string, unknown>;
          } catch {
            payload = {};
          }
        }

        const summary = buildIssueActivitySummary({
          action: row.action,
          labelNameById,
          payload
        });

        if (!summary) {
          return null;
        }

        return {
          actorUserId: row.actor_id,
          createdAt: row.occurred_at,
          id: row.id,
          summary
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return reply.send(items);
  });

  app.post("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/attachments", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
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

    if (!can(project.currentUserRole, "issue.edit")) {
      return sendError(reply, 403, "issue.forbidden", "Issue attachment upload denied");
    }

    const issue = await getIssueUseCase(issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!issue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    const upload = await request.file();

    if (!upload) {
      return sendError(reply, 400, "attachment.required", "Attachment file is required");
    }

    const fileName = upload.filename.trim();
    const contentType = upload.mimetype.trim();

    if (fileName.length === 0) {
      return sendError(reply, 400, "attachment.invalid_name", "Attachment file name is required");
    }

    if (contentType.length === 0) {
      return sendError(reply, 400, "attachment.invalid_type", "Attachment content type is required");
    }

    const buffer = await upload.toBuffer();

    if (buffer.byteLength === 0) {
      return sendError(reply, 400, "attachment.empty", "Attachment file is empty");
    }

    const stored = await attachmentStorage.put({
      buffer,
      contentType
    });

    try {
      const attachment = await issueRepository.createAttachment({
        byteSize: stored.byteSize,
        checksum: stored.checksum,
        contentType,
        fileName,
        id: `attachment_${randomUUID()}`,
        issueId: issue.id,
        storageKey: stored.storageKey,
        uploadedByUserId: currentUser.id
      });

      await recordAudit({
        action: "issue.attachment.create",
        actorId: currentUser.id,
        issueId: issue.id,
        payload: {
          attachmentId: attachment.id,
          fileName
        },
        projectId: project.id,
        resourceId: attachment.id,
        workspaceId: workspace.id
      });

      return reply.status(201).send({
        ...attachment,
        url: `/api/bff/workspaces/${workspace.slug}/projects/${project.key}/issues/${issue.issueKey}/attachments/${attachment.id}`
      });
    } catch (error) {
      await attachmentStorage.delete(stored.storageKey);
      throw error;
    }
  });

  app.get("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/attachments/:attachmentId", async (request, reply) => {
    const params = request.params as {
      attachmentId: string;
      issueKey: string;
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

    const issue = await getIssueUseCase(issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!issue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    const attachment = await issueRepository.findAttachment(params.attachmentId, issue.id);

    if (!attachment) {
      return sendError(reply, 404, "attachment.not_found", "Attachment not found");
    }

    const fileName = attachment.fileName.replace(/"/g, "");

    reply.header("content-type", attachment.contentType);
    reply.header("content-length", String(attachment.byteSize));
    reply.header("content-disposition", `inline; filename="${fileName}"`);

    const attachmentStream = await attachmentStorage.stream(attachment.storageKey);
    return reply.send(attachmentStream);
  });

  app.delete("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/attachments/:attachmentId", async (request, reply) => {
    const params = request.params as {
      attachmentId: string;
      issueKey: string;
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

    if (!can(project.currentUserRole, "issue.edit")) {
      return sendError(reply, 403, "issue.forbidden", "Issue attachment deletion denied");
    }

    const issue = await getIssueUseCase(issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!issue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    app.log.info({ attachmentId: params.attachmentId, issueId: issue.id, issueKey: issue.issueKey }, "Attempting to delete attachment");
    const attachment = await issueRepository.findAttachment(params.attachmentId, issue.id);

    if (!attachment) {
      return sendError(reply, 404, "attachment.not_found", "Attachment not found");
    }

    await issueRepository.deleteAttachment(attachment.id, issue.id);
    await attachmentStorage.delete(attachment.storageKey);

    await recordAudit({
      action: "issue.attachment.delete",
      actorId: currentUser.id,
      issueId: issue.id,
      payload: {
        attachmentId: attachment.id,
        fileName: attachment.fileName
      },
      projectId: project.id,
      resourceId: attachment.id,
      workspaceId: workspace.id
    });

    return reply.status(204).send();
  });

  app.put("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/reactions", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = updateIssueReactionRequestSchema.parse(request.body);
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

    const existingIssue = await getIssueUseCase(issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!existingIssue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    const hasExistingReaction = existingIssue.reactions.some(
      (reaction) => reaction.emoji === payload.emoji && reaction.userIds.includes(currentUser.id)
    );
    const shouldActivate = payload.active ?? !hasExistingReaction;

    const issue = await runInTransaction(database, async (trx) => {
      const scoped = createScopedRepositories(trx);

      if (shouldActivate) {
        await scoped.issueRepository.addReaction({
          emoji: payload.emoji,
          issueId: existingIssue.id,
          userId: currentUser.id
        });
      } else {
        await scoped.issueRepository.removeReaction({
          emoji: payload.emoji,
          issueId: existingIssue.id,
          userId: currentUser.id
        });
      }

      const updatedIssue = await getIssueUseCase(scoped.issueRepository, {
        issueKey: params.issueKey,
        projectId: project.id
      });

      if (!updatedIssue) {
        throw new IssueNotFoundError(project.id, params.issueKey);
      }

      return updatedIssue;
    });

    await recordAudit({
      action: shouldActivate ? "issue.reaction.add" : "issue.reaction.remove",
      actorId: currentUser.id,
      issueId: issue.id,
      payload: {
        active: shouldActivate,
        emoji: payload.emoji
      },
      projectId: project.id,
      resourceId: issue.id,
      workspaceId: workspace.id
    });

    return reply.send(issue);
  });

  app.get("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/subscription", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
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

    const issue = await getIssueUseCase(issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!issue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    const subscription = await issueRepository.getSubscriptionState(issue.id, currentUser.id);
    return reply.send(issueSubscriptionResponseSchema.parse(subscription));
  });

  app.patch("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const body = request.body as any;
    const labelIds = body.labelIds ?? (Array.isArray(body.labels) ? body.labels.map((l: any) => l.id).filter(Boolean) : undefined);
    const payload = updateIssueRequestSchema.parse({ ...body, labelIds });
    const currentUser = await resolveCurrentUser(request);
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.edit")) {
      return sendError(reply, 403, "issue.forbidden", "Issue editing denied");
    }

    const previousIssue = await getIssueUseCase(issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!previousIssue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    const workspaceMembers =
      payload.description !== undefined
        ? await listWorkspaceMembersUseCase(identityRepository, workspace.id)
        : [];

    const mentionableUsers = workspaceMembers.map((member) => ({
      handle: member.user.handle,
      userId: member.userId
    }));

    const descriptionMentions =
      payload.description !== undefined
        ? extractIssueMentions(payload.description, mentionableUsers)
        : undefined;

    const previousDescriptionMentions =
      payload.description !== undefined
        ? extractIssueMentions(previousIssue.description, mentionableUsers)
        : [];

    let labels: Awaited<ReturnType<typeof resolveProjectLabels>> | undefined;

    if (payload.labelIds !== undefined) {
      labels = await resolveProjectLabels(project.id, payload.labelIds);
    }

    const changes = {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(descriptionMentions !== undefined ? { descriptionMentions } : {}),
      ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
      ...(labels !== undefined ? { labels } : {}),
      ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
      ...(payload.assigneeUserId !== undefined ? { assigneeUserId: payload.assigneeUserId } : {})
    };

    app.log.info({ changes, issueKey: params.issueKey }, "Applying changes to issue");

    if (Object.keys(changes).length === 0) {
      app.log.info("No changes detected in request payload after parsing");
      return reply.send(previousIssue);
    }

    const issue = await runInTransaction(database, async (trx) => {
      const scoped = createScopedRepositories(trx);
      const updatedIssue = await updateIssueUseCase(scoped.issueRepository, {
        actor: "local",
        changes,
        issueKey: params.issueKey,
        projectId: project.id
      });

      app.log.info({ updatedDescription: updatedIssue.description }, "Issue updated in use case");
      if (
        payload.assigneeUserId !== undefined &&
        updatedIssue.assigneeUserId &&
        updatedIssue.assigneeUserId !== previousIssue.assigneeUserId
      ) {
        const event = buildIssueAssignedEvent({
          actorName: currentUser.name,
          actorUserId: currentUser.id,
          assigneeUserId: updatedIssue.assigneeUserId,
          issue: updatedIssue,
          projectKey: project.key,
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug
        });

        if (event) {
          await scoped.notificationRepository.enqueueEvent(event);
        }
      }

      if (updatedIssue.assigneeUserId) {
        await scoped.issueRepository.ensureSubscriptions({
          issueId: updatedIssue.id,
          userIds: [updatedIssue.assigneeUserId]
        });
      }

      if (descriptionMentions !== undefined && descriptionMentions.length > 0) {
        await scoped.issueRepository.ensureSubscriptions({
          issueId: updatedIssue.id,
          userIds: descriptionMentions.map((mention) => mention.userId)
        });

        const descriptionEvent = buildIssueDescriptionMentionEvent({
          actorName: currentUser.name,
          actorUserId: currentUser.id,
          issue: updatedIssue,
          previousMentions: previousDescriptionMentions,
          projectKey: project.key,
          workspaceMembers,
          workspaceSlug: workspace.slug
        });

        if (descriptionEvent) {
          await scoped.notificationRepository.enqueueEvent(descriptionEvent);
        }
      }

      return updatedIssue;
    });

    // Record audit for specific changes
    const actions = Object.keys(changes).filter(key => key !== "descriptionMentions");
    for (const actionKey of actions) {
      await recordAudit({
        action: `issue.update.${actionKey}`,
        actorId: currentUser.id,
        issueId: issue.id,
        payload: {
          from: (previousIssue as any)[actionKey],
          to: (issue as any)[actionKey]
        },
        projectId: project.id,
        resourceId: issue.id,
        workspaceId: workspace.id
      });
    }

    return reply.send(issue);
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
    const currentUser = await resolveCurrentUser(request);
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

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
      const previousIssue = await getIssueUseCase(issueRepository, {
        issueKey: params.issueKey,
        projectId: project.id
      });

      if (!previousIssue) {
        return sendError(reply, 404, "issue.not_found", "Issue not found");
      }

      const workspaceMembers = await listWorkspaceMembersUseCase(identityRepository, workspace.id);
      const mentions = extractCommentMentions(
        payload.body,
        workspaceMembers.map((member) => ({
          handle: member.user.handle,
          userId: member.userId
        }))
      );

      const issue = await runInTransaction(database, async (trx) => {
        const scoped = createScopedRepositories(trx);
        const updatedIssue = await commentOnIssueUseCase(scoped.issueRepository, {
          authorUserId: currentUser.id,
          body: payload.body,
          issueKey: params.issueKey,
          mentions,
          parentCommentId: payload.parentCommentId ?? null,
          projectId: project.id
        });
        const previousCommentIds = new Set(previousIssue.comments.map((comment) => comment.id));
        const createdComment =
          updatedIssue.comments.find((comment) => !previousCommentIds.has(comment.id)) ??
          updatedIssue.comments[updatedIssue.comments.length - 1];

        if (createdComment) {
          await scoped.issueRepository.ensureSubscriptions({
            issueId: updatedIssue.id,
            userIds: [
              currentUser.id,
              ...(updatedIssue.assigneeUserId ? [updatedIssue.assigneeUserId] : []),
              ...updatedIssue.comments.map((comment) => comment.authorUserId),
              ...createdComment.mentions.map((mention) => mention.userId)
            ]
          });

          const event = buildIssueCommentEvent({
            actorName: currentUser.name,
            actorUserId: currentUser.id,
            comment: createdComment,
            issue: updatedIssue,
            previousIssue,
            projectKey: project.key,
            workspaceMembers,
            workspaceSlug: workspace.slug
          });

          if (event) {
            await scoped.notificationRepository.enqueueEvent(event);
          }
        }

        return updatedIssue;
      });

      await recordAudit({
        action: "issue.comment.add",
        actorId: currentUser.id,
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

  app.put("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/subscription", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = updateIssueSubscriptionRequestSchema.parse(request.body);
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

    const issue = await getIssueUseCase(issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!issue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    const subscription = await issueRepository.setSubscription({
      issueId: issue.id,
      subscribed: payload.subscribed,
      userId: currentUser.id
    });

    return reply.send(issueSubscriptionResponseSchema.parse(subscription));
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
    const currentUser = await resolveCurrentUser(request);
    const userId = currentUser.id;
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

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
      const previousIssue = await getIssueUseCase(issueRepository, {
        issueKey: params.issueKey,
        projectId: project.id
      });

      if (!previousIssue) {
        return sendError(reply, 404, "issue.not_found", "Issue not found");
      }

      const triageInput = {
        actor: "local" as const,
        issueKey: params.issueKey,
        projectId: project.id,
        ...(payload.assigneeUserId !== undefined ? { assigneeUserId: payload.assigneeUserId } : {}),
        ...(payload.priority !== undefined ? { priority: payload.priority } : {})
      };

      const issue = await runInTransaction(database, async (trx) => {
        const scoped = createScopedRepositories(trx);
        const updatedIssue = await triageIssueUseCase(scoped.issueRepository, {
          ...triageInput
        });

        if (
          payload.assigneeUserId !== undefined &&
          updatedIssue.assigneeUserId &&
          updatedIssue.assigneeUserId !== previousIssue.assigneeUserId
        ) {
          await scoped.issueRepository.ensureSubscriptions({
            issueId: updatedIssue.id,
            userIds: [updatedIssue.assigneeUserId]
          });

          const event = buildIssueAssignedEvent({
            actorName: currentUser.name,
            actorUserId: currentUser.id,
            assigneeUserId: updatedIssue.assigneeUserId,
            issue: updatedIssue,
            projectKey: project.key,
            workspaceId: workspace.id,
            workspaceSlug: workspace.slug
          });

          if (event) {
            await scoped.notificationRepository.enqueueEvent(event);
          }
        }

        return updatedIssue;
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

    const invitation = await runInTransaction(database, async (trx) => {
      const scoped = createScopedRepositories(trx);
      const createdInvitation = await createWorkspaceInvitationUseCase(scoped.identityRepository, {
        inviteeEmail: payload.email ?? null,
        inviteeUserId: payload.userId ?? null,
        invitedByUserId: currentUser.id,
        role: payload.role,
        workspaceId: workspace.id
      });
      const recipientUserId =
        createdInvitation.inviteeUserId ??
        (createdInvitation.inviteeEmail
          ? (await scoped.identityRepository.findUserByEmail(createdInvitation.inviteeEmail))?.id ?? null
          : null);

      if (recipientUserId) {
        await scoped.notificationRepository.enqueueEvent(
          buildWorkspaceInvitationReceivedEvent({
            invitation: createdInvitation,
            recipientUserId,
            workspaceName: workspace.name,
            workspaceSlug: workspace.slug
          })
        );
      }

      return createdInvitation;
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

  app.put("/workspaces/:workspaceSlug/members/:userId", async (request, reply) => {
    const params = request.params as { userId: string; workspaceSlug: string };
    const payload = z.object({ role: z.enum(["Owner", "Member"]) }).parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const { membership, workspace } = await resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (requireWorkspaceAction(reply, membership, "workspace.manage", "Workspace management denied")) {
      return;
    }

    await updateWorkspaceMemberUseCase(identityRepository, {
      role: payload.role,
      userId: params.userId,
      workspaceId: workspace.id
    });

    const members = await listWorkspaceMembersUseCase(identityRepository, workspace.id);
    const updatedMember = members.find((m) => m.userId === params.userId);
    return reply.send(updatedMember);
  });

  app.delete("/workspaces/:workspaceSlug/members/:userId", async (request, reply) => {
    const params = request.params as { userId: string; workspaceSlug: string };
    const currentUser = await resolveCurrentUser(request);
    const { membership, workspace } = await resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (requireWorkspaceAction(reply, membership, "workspace.manage", "Workspace management denied")) {
      return;
    }

    const projectRoleHierarchy: Record<ProjectRole, number> = {
      Owner: 0,
      Maintainer: 1,
      Developer: 2,
      Planner: 3,
      Guest: 4
    };

    const existingMembers = await listProjectMembersUseCase(projectCollaborationRepository, project.id);
    const targetMember = existingMembers.find((m) => m.userId === params.userId);

    // Enforcement: Cannot remove a member with a role higher or equal to your own (except Owners)
    if (
      targetMember &&
      project.currentUserRole !== "Owner" &&
      projectRoleHierarchy[targetMember.role] <= projectRoleHierarchy[project.currentUserRole]
    ) {
      return sendError(reply, 403, "project.forbidden", "Cannot remove a member with a role higher or equal to your own");
    }

    if (params.userId === currentUser.id) {
      return sendError(reply, 400, "workspace.cannot_remove_self", "You cannot remove yourself from the workspace");
    }

    await removeWorkspaceMemberUseCase(identityRepository, {
      userId: params.userId,
      workspaceId: workspace.id
    });

    return reply.status(204).send();
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

    const accepted = await runInTransaction(database, async (trx) => {
      const scoped = createScopedRepositories(trx);
      const nextInvitation = await scoped.identityRepository.acceptInvitation(invitation.id, currentUser.id);

      if (!nextInvitation) {
        return null;
      }

      const event = nextInvitation.projectId
        ? (() => {
            const projectPromise = getProjectIdentity(nextInvitation.projectId);
            return projectPromise.then((projectIdentity) =>
              projectIdentity
                ? buildProjectInvitationAcceptedEvent({
                    acceptedByName: currentUser.name,
                    actorUserId: currentUser.id,
                    invitation: nextInvitation,
                    projectKey: projectIdentity.project_key,
                    workspaceSlug: params.workspaceSlug
                  })
                : null
            );
          })()
        : Promise.resolve(
            buildWorkspaceInvitationAcceptedEvent({
              acceptedByName: currentUser.name,
              actorUserId: currentUser.id,
              invitation: nextInvitation,
              workspaceName: workspace.name,
              workspaceSlug: params.workspaceSlug
            })
          );

      const resolvedEvent = await event;

      if (resolvedEvent) {
        await scoped.notificationRepository.enqueueEvent(resolvedEvent);
      }

      return nextInvitation;
    });

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

    const workspaceRecord = await database
      .selectFrom("workspaces")
      .select(["name", "slug"])
      .where("id", "=", invitation.workspaceId)
      .executeTakeFirst();
    const accepted = await runInTransaction(database, async (trx) => {
      const scoped = createScopedRepositories(trx);
      const nextInvitation = await scoped.identityRepository.acceptInvitation(invitation.id, currentUser.id);

      if (!nextInvitation) {
        return null;
      }

      const resolvedEvent = nextInvitation.projectId
        ? (() => {
            const projectPromise = getProjectIdentity(nextInvitation.projectId);
            return projectPromise.then((projectIdentity) =>
              projectIdentity
                ? buildProjectInvitationAcceptedEvent({
                    acceptedByName: currentUser.name,
                    actorUserId: currentUser.id,
                    invitation: nextInvitation,
                    projectKey: projectIdentity.project_key,
                    workspaceSlug: workspaceRecord?.slug ?? ""
                  })
                : null
            );
          })()
        : Promise.resolve(
            buildWorkspaceInvitationAcceptedEvent({
              acceptedByName: currentUser.name,
              actorUserId: currentUser.id,
              invitation: nextInvitation,
              workspaceName: workspaceRecord?.name ?? "Workspace",
              workspaceSlug: workspaceRecord?.slug ?? ""
            })
          );

      const event = await resolvedEvent;

      if (event) {
        await scoped.notificationRepository.enqueueEvent(event);
      }

      return nextInvitation;
    });

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

  app.get("/workspaces/:workspaceSlug/projects/:projectKey/invitations", async (request, reply) => {
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

    const invitations = await listProjectInvitationsUseCase(projectCollaborationRepository, project.id);
    return reply.send(invitations);
  });

  app.post("/workspaces/:workspaceSlug/projects/:projectKey/invitations", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = projectInvitationRequestSchema.parse(request.body);
    const currentUser = await resolveCurrentUser(request);
    const { project, workspace } = await resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.manage")) {
      return sendError(reply, 403, "project.forbidden", "Project invite denied");
    }

    const invitation = await runInTransaction(database, async (trx) => {
      const scoped = createScopedRepositories(trx);
      const createdInvitation = await createProjectInvitationUseCase(scoped.projectCollaborationRepository, {
        inviteeEmail: payload.email ?? null,
        inviteeUserId: payload.userId ?? null,
        invitedByUserId: currentUser.id,
        projectId: project.id,
        role: payload.role,
        workspaceId: workspace.id
      });
      const recipientUserId =
        createdInvitation.inviteeUserId ??
        (createdInvitation.inviteeEmail
          ? (await scoped.identityRepository.findUserByEmail(createdInvitation.inviteeEmail))?.id ?? null
          : null);

      if (recipientUserId) {
        await scoped.notificationRepository.enqueueEvent(
          buildProjectInvitationReceivedEvent({
            invitation: createdInvitation,
            projectKey: project.key,
            recipientUserId,
            workspaceSlug: workspace.slug
          })
        );
      }

      return createdInvitation;
    });

    await recordAudit({
      action: "project.invite",
      actorId: currentUser.id,
      payload: {
        invitationId: invitation.id,
        inviteeEmail: invitation.inviteeEmail,
        inviteeUserId: invitation.inviteeUserId,
        role: invitation.role
      },
      projectId: project.id,
      resourceId: invitation.id,
      workspaceId: workspace.id
    });

    return reply.status(201).send(invitation);
  });

  app.delete("/workspaces/:workspaceSlug/projects/:projectKey/invitations/:invitationId", async (request, reply) => {
    const params = request.params as {
      invitationId: string;
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

    if (!can(project.currentUserRole, "project.manage")) {
      return sendError(reply, 403, "project.forbidden", "Project invite revoke denied");
    }

    const invitation = await identityRepository.findInvitationById(params.invitationId);

    if (!invitation || invitation.projectId !== project.id) {
      return sendError(reply, 404, "project.invitation_not_found", "Project invitation not found");
    }

    await runInTransaction(database, async (trx) => {
      const scoped = createScopedRepositories(trx);
      await revokeProjectInvitationUseCase(scoped.projectCollaborationRepository, {
        invitationId: invitation.id,
        projectId: project.id
      });
      const event = buildProjectInvitationRevokedEvent({
        actorName: currentUser.name,
        actorUserId: currentUser.id,
        invitation,
        projectKey: project.key,
        workspaceSlug: workspace.slug
      });

      if (event) {
        await scoped.notificationRepository.enqueueEvent(event);
      }
    });

    await recordAudit({
      action: "project.invite.revoke",
      actorId: currentUser.id,
      payload: {
        invitationId: invitation.id
      },
      projectId: project.id,
      resourceId: invitation.id,
      workspaceId: workspace.id
    });

    return reply.status(204).send();
  });

  app.post("/workspaces/:workspaceSlug/projects/:projectKey/invitations/:invitationId/accept", async (request, reply) => {
    const params = request.params as {
      invitationId: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const currentUser = await resolveCurrentUser(request);
    const invitation = await identityRepository.findInvitationById(params.invitationId);

    if (!invitation || !invitation.projectId) {
      return sendError(reply, 404, "project.invitation_not_found", "Project invitation not found");
    }

    const projectIdentity = await getProjectIdentity(invitation.projectId);

    if (!projectIdentity || projectIdentity.project_key !== params.projectKey.toUpperCase()) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    const workspace = await workspaceRepository.findBySlug(params.workspaceSlug);

    if (!workspace || workspace.id !== invitation.workspaceId) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (invitation.acceptedAt) {
      return reply.send(invitation);
    }

    if (invitation.status !== "pending") {
      return sendError(reply, 409, "project.invitation_not_pending", "Invitation is not pending");
    }

    if (invitation.inviteeEmail && currentUser.email && invitation.inviteeEmail !== currentUser.email) {
      return sendError(reply, 403, "project.invitation_email_mismatch", "Invitation email does not match current user");
    }

    const accepted = await runInTransaction(database, async (trx) => {
      const scoped = createScopedRepositories(trx);
      const nextInvitation = await scoped.identityRepository.acceptInvitation(invitation.id, currentUser.id);

      if (!nextInvitation) {
        return null;
      }

      const event = buildProjectInvitationAcceptedEvent({
        acceptedByName: currentUser.name,
        actorUserId: currentUser.id,
        invitation: nextInvitation,
        projectKey: params.projectKey.toUpperCase(),
        workspaceSlug: params.workspaceSlug
      });

      if (event) {
        await scoped.notificationRepository.enqueueEvent(event);
      }

      return nextInvitation;
    });

    if (!accepted) {
      return sendError(reply, 404, "project.invitation_not_found", "Project invitation not found");
    }

    await recordAudit({
      action: "project.invite.accept",
      actorId: currentUser.id,
      payload: {
        invitationId: accepted.id
      },
      resourceId: accepted.id,
      workspaceId: accepted.workspaceId,
      ...(accepted.projectId ? { projectId: accepted.projectId } : {})
    });

    return reply.send(accepted);
  });

  app.post("/project-invitations/:acceptToken/accept", async (request, reply) => {
    const params = request.params as { acceptToken: string };
    const currentUser = await resolveCurrentUser(request);
    const invitation = await identityRepository.findInvitationByToken(params.acceptToken);

    if (!invitation || !invitation.projectId) {
      return sendError(reply, 404, "project.invitation_not_found", "Project invitation not found");
    }

    if (invitation.status !== "pending") {
      return sendError(reply, 409, "project.invitation_not_pending", "Invitation is not pending");
    }

    if (invitation.inviteeEmail && currentUser.email && invitation.inviteeEmail !== currentUser.email) {
      return sendError(reply, 403, "project.invitation_email_mismatch", "Invitation email does not match current user");
    }

    const workspaceRecord = await database
      .selectFrom("workspaces")
      .select(["slug"])
      .where("id", "=", invitation.workspaceId)
      .executeTakeFirst();
    const projectIdentity = await getProjectIdentity(invitation.projectId);
    const accepted = await runInTransaction(database, async (trx) => {
      const scoped = createScopedRepositories(trx);
      const nextInvitation = await scoped.identityRepository.acceptInvitation(invitation.id, currentUser.id);

      if (!nextInvitation) {
        return null;
      }

      const event = projectIdentity
        ? buildProjectInvitationAcceptedEvent({
            acceptedByName: currentUser.name,
            actorUserId: currentUser.id,
            invitation: nextInvitation,
            projectKey: projectIdentity.project_key,
            workspaceSlug: workspaceRecord?.slug ?? ""
          })
        : null;

      if (event) {
        await scoped.notificationRepository.enqueueEvent(event);
      }

      return nextInvitation;
    });

    if (!accepted) {
      return sendError(reply, 404, "project.invitation_not_found", "Project invitation not found");
    }

    await recordAudit({
      action: "project.invite.accept",
      actorId: currentUser.id,
      payload: {
        invitationId: accepted.id
      },
      resourceId: accepted.id,
      workspaceId: accepted.workspaceId,
      ...(accepted.projectId ? { projectId: accepted.projectId } : {})
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

    const projectRoleHierarchy: Record<ProjectRole, number> = {
      Owner: 0,
      Maintainer: 1,
      Developer: 2,
      Planner: 3,
      Guest: 4
    };

    // Enforcement: Cannot assign a role higher or equal to your own (except Owners)
    if (
      project.currentUserRole !== "Owner" &&
      projectRoleHierarchy[payload.role] <= projectRoleHierarchy[project.currentUserRole]
    ) {
      return sendError(reply, 403, "project.forbidden", "Cannot assign a role higher or equal to your own");
    }

    if (!(await projectRepository.isWorkspaceMember(workspace.id, params.userId))) {
      return sendError(reply, 403, "workspace.membership_required", "Workspace membership required");
    }

    const existingMembers = await listProjectMembersUseCase(projectCollaborationRepository, project.id);
    const targetMember = existingMembers.find((m) => m.userId === params.userId);

    // Enforcement: Cannot modify a member with a role higher or equal to your own (except Owners)
    if (
      targetMember &&
      project.currentUserRole !== "Owner" &&
      projectRoleHierarchy[targetMember.role] <= projectRoleHierarchy[project.currentUserRole]
    ) {
      return sendError(reply, 403, "project.forbidden", "Cannot modify a member with a role higher or equal to your own");
    }

    const member = await runInTransaction(database, async (trx) => {
      const scoped = createScopedRepositories(trx);
      const createdMember = await createProjectMemberUseCase(scoped.projectCollaborationRepository, {
        projectId: project.id,
        role: payload.role,
        userId: params.userId
      });
      const event = existingMembers.some((candidate) => candidate.userId === params.userId)
        ? null
        : buildProjectAccessGrantedEvent({
            actorName: currentUser.name,
            actorUserId: currentUser.id,
            projectId: project.id,
            projectKey: project.key,
            recipientUserId: params.userId,
            workspaceId: workspace.id,
            workspaceSlug: workspace.slug
          });

      if (event) {
        await scoped.notificationRepository.enqueueEvent(event);
      }

      return createdMember;
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

    if (error instanceof IssueNotFoundError) {
      return reply.status(404).send({
        code: "issue.not_found",
        message: error.message
      } satisfies ErrorEnvelopeDto);
    }

    if (error instanceof IssueMutationNotAllowedError) {
      return reply.status(409).send({
        code: "issue.mutation_not_allowed",
        message: error.message
      } satisfies ErrorEnvelopeDto);
    }

    if (error instanceof IssueAlreadyExistsError) {
      return reply.status(409).send({
        code: "issue.already_exists",
        message: error.message
      } satisfies ErrorEnvelopeDto);
    }

    if (error instanceof IssueTransitionNotAllowedError) {
      return reply.status(400).send({
        code: "issue.transition_not_allowed",
        message: error.message
      } satisfies ErrorEnvelopeDto);
    }

    if (error instanceof IssueTriageStatusError) {
      return reply.status(400).send({
        code: "issue.invalid_triage_status",
        message: error.message
      } satisfies ErrorEnvelopeDto);
    }

    app.log.error(error);

    return reply.status(500).send({
      code: "internal_error",
      message: error instanceof Error ? error.message : "Unexpected server error",
      stack: error instanceof Error ? error.stack : undefined
    } as any);
  });

  return app;
};
