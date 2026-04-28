import type { FastifyPluginAsync } from "fastify";
import {
  createIntegrationInstallationRequestSchema,
  createIntegrationProjectLinkRequestSchema,
  importIntegrationProjectIssuesRequestSchema,
} from "@wevlo/contracts";
import {
  createInstallationUseCase,
  createProjectLinkUseCase,
  importRemoteIssuesUseCase,
  listProjectLinksUseCase,
  listProjectSyncStatusesUseCase,
  listWorkspaceInstallationsUseCase,
  receiveWebhookDeliveryUseCase,
} from "@wevlo/integrations";
import { sendError } from "../errors.js";

const integrationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/github/webhooks", async (request, reply) => {
    try {
      const delivery = await receiveWebhookDeliveryUseCase({
        body: typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {}),
        eventType: String(request.headers["x-github-event"] ?? "unknown"),
        headers: Object.fromEntries(
          Object.entries(request.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
        ),
        provider: "github",
        repository: fastify.integrationRepository
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

  fastify.post("/gitlab/webhooks", async (request, reply) => {
    try {
      const delivery = await receiveWebhookDeliveryUseCase({
        body: typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {}),
        eventType: String(request.headers["x-gitlab-event"] ?? "unknown"),
        headers: Object.fromEntries(
          Object.entries(request.headers).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
        ),
        provider: "gitlab",
        repository: fastify.integrationRepository
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

  // Workspace-level integrations
  fastify.get("/workspaces/:workspaceSlug/installations", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const userId = (await fastify.resolveCurrentUser(request)).id;
    const { membership, workspace } = await fastify.resolveWorkspaceAccess(userId, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!membership || !fastify.canWorkspace(membership.role, "workspace.view")) {
      return sendError(reply, 403, "workspace.forbidden", "Workspace access denied");
    }

    const installations = await listWorkspaceInstallationsUseCase(fastify.integrationRepository, workspace.id);
    return reply.send(installations);
  });

  fastify.post("/workspaces/:workspaceSlug/:provider/installations", async (request, reply) => {
    const params = request.params as {
      provider: "github" | "gitlab";
      workspaceSlug: string;
    };
    const payload = createIntegrationInstallationRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { membership, workspace } = await fastify.resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!membership || !fastify.canWorkspace(membership.role, "workspace.manage")) {
      return sendError(reply, 403, "workspace.forbidden", "Workspace integration management denied");
    }

    const installation = await createInstallationUseCase(fastify.integrationRepository, {
      ...payload,
      createdByUserId: currentUser.id,
      provider: params.provider,
      workspaceId: workspace.id
    });

    await fastify.recordAudit({
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

  // Project-level integration links
  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey/links", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const userId = (await fastify.resolveCurrentUser(request)).id;
    const { project, workspace } = await fastify.resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!fastify.can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const [links, syncStatuses] = await Promise.all([
      listProjectLinksUseCase(fastify.integrationRepository, project.id),
      listProjectSyncStatusesUseCase(fastify.integrationRepository, project.id)
    ]);

    return reply.send({
      links,
      syncStatuses
    });
  });

  fastify.post("/workspaces/:workspaceSlug/projects/:projectKey/:provider/links", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      provider: "github" | "gitlab";
      workspaceSlug: string;
    };
    const payload = createIntegrationProjectLinkRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!fastify.can(project.currentUserRole, "integration.manage")) {
      return sendError(reply, 403, "project.forbidden", "Project integration management denied");
    }

    const installation = await fastify.integrationRepository.findInstallationById(payload.installationId);

    if (!installation || installation.workspaceId !== workspace.id || installation.provider !== params.provider) {
      return sendError(reply, 404, "integration.installation_not_found", "Integration installation not found");
    }

    const projectLink = await createProjectLinkUseCase(fastify.integrationRepository, {
      ...payload,
      projectId: project.id,
      provider: params.provider
    });

    await fastify.recordAudit({
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

  fastify.post("/workspaces/:workspaceSlug/projects/:projectKey/:provider/import", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      provider: "github" | "gitlab";
      workspaceSlug: string;
    };
    const payload = importIntegrationProjectIssuesRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!fastify.can(project.currentUserRole, "integration.manage")) {
      return sendError(reply, 403, "project.forbidden", "Project integration management denied");
    }

    const result = await importRemoteIssuesUseCase({
      issueRepository: fastify.issueRepository,
      issues: payload.issues,
      projectId: project.id,
      provider: params.provider,
      repository: fastify.integrationRepository
    });

    await fastify.recordAudit({
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
};

export default integrationRoutes;
