import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import {
  type Database,
  type DatabaseExecutor,
} from "@wevlo/data-access";
import { recordAuditEvent } from "@wevlo/audit-activity";
import { can, canWorkspace } from "@wevlo/authz";
import {
  getWorkspaceBySlugUseCase,
  listWorkspaceMembersUseCase,
  PostgresIdentityRepository,
  PostgresWorkspaceRepository,
  PostgresAuthRepository,
  resolveCurrentUserUseCase,
} from "@wevlo/identity-tenancy";
import {
  getProjectByKeyUseCase,
  PostgresProjectBoardConfigRepository,
  PostgresProjectCollaborationRepository,
  PostgresProjectRepository,
} from "@wevlo/projects";
import { PostgresIntegrationRepository } from "@wevlo/integrations";
import {
  PostgresIssueRepository,
} from "@wevlo/issues";
import { PostgresNotificationRepository } from "@wevlo/notifications";
import { type ListIssueScope, type WorkspaceRole, type ProjectRole } from "@wevlo/contracts";

import { getRequestIdentity } from "../dev-session.js";
import { sendError } from "../errors.js";
import { createAttachmentStorageFromEnv } from "../attachment-storage-factory.js";
import type { AttachmentStorage } from "../attachment-storage.js";

declare module "fastify" {
  interface FastifyInstance {
    database: Database;
    identityRepository: PostgresIdentityRepository;
    workspaceRepository: PostgresWorkspaceRepository;
    projectRepository: PostgresProjectRepository;
    projectBoardConfigRepository: PostgresProjectBoardConfigRepository;
    projectCollaborationRepository: PostgresProjectCollaborationRepository;
    issueRepository: PostgresIssueRepository;
    integrationRepository: PostgresIntegrationRepository;
    notificationRepository: PostgresNotificationRepository;
    authRepository: PostgresAuthRepository;
    attachmentStorage: AttachmentStorage;
    
    // Helpers
    can(role: ProjectRole, action: string): boolean;
    canWorkspace(role: WorkspaceRole, action: string): boolean;
    normalizeInviteEmails(input: { email?: string; emails?: string[] }): string[];
    createScopedRepositories(executor: DatabaseExecutor): {
      identityRepository: PostgresIdentityRepository;
      authRepository: PostgresAuthRepository;
      integrationRepository: PostgresIntegrationRepository;
      issueRepository: PostgresIssueRepository;
      notificationRepository: PostgresNotificationRepository;
      projectCollaborationRepository: PostgresProjectCollaborationRepository;
    };
    resolveCurrentUser(request: FastifyRequest): Promise<any>;
    recordAudit(input: {
      action: string;
      actorId: string;
      resourceId: string;
      workspaceId?: string;
      projectId?: string;
      issueId?: string;
      payload?: Record<string, unknown>;
    }): Promise<void>;
    filterIssuesByScope<TIssue extends { assigneeUserId: string | null; reporterUserId: string }>(
      issues: TIssue[],
      userId: string,
      scope: ListIssueScope
    ): TIssue[];
    resolveProjectAccess(
      userId: string,
      params: { projectKey: string; workspaceSlug: string }
    ): Promise<{ project: any; workspace: any }>;
    resolveWorkspaceAccess(
      userId: string,
      workspaceSlug: string
    ): Promise<{ membership: any; workspace: any }>;
    resolvePersonalIssueFilters(
      userId: string,
      query: { projectKey?: string | undefined; workspaceSlug?: string | undefined }
    ): Promise<{ project: any; workspace: any }>;
    formatIssueStateLabel(state: string): string;
    formatIssuePriorityLabel(priority: string): string;
    buildIssueActivitySummary(input: {
      action: string;
      labelNameById: Map<string, string>;
      payload: Record<string, unknown>;
    }): string | null;
    requireWorkspaceAction(
      reply: FastifyReply,
      membership: { role: WorkspaceRole } | null,
      action: "workspace.view" | "workspace.invite" | "workspace.manage",
      deniedMessage: string
    ): FastifyReply | null;
    getProjectIdentity(projectId: string): Promise<any>;
    resolveProjectLabels(projectId: string, labelIds: string[] | undefined): Promise<any[]>;
  }
}

interface ContextOptions {
  database: Database;
}

const contextPlugin: FastifyPluginAsync<ContextOptions> = async (fastify, options) => {
  const { database } = options;

  const identityRepository = new PostgresIdentityRepository(database);
  const workspaceRepository = new PostgresWorkspaceRepository(database);
  const projectRepository = new PostgresProjectRepository(database);
  const projectBoardConfigRepository = new PostgresProjectBoardConfigRepository(database);
  const projectCollaborationRepository = new PostgresProjectCollaborationRepository(database);
  const issueRepository = new PostgresIssueRepository(database);
  const integrationRepository = new PostgresIntegrationRepository(database);
  const notificationRepository = new PostgresNotificationRepository(database);
  const authRepository = new PostgresAuthRepository(database);
  const attachmentStorage = createAttachmentStorageFromEnv();

  fastify.decorate("database", database);
  fastify.decorate("identityRepository", identityRepository);
  fastify.decorate("workspaceRepository", workspaceRepository);
  fastify.decorate("projectRepository", projectRepository);
  fastify.decorate("projectBoardConfigRepository", projectBoardConfigRepository);
  fastify.decorate("projectCollaborationRepository", projectCollaborationRepository);
  fastify.decorate("issueRepository", issueRepository);
  fastify.decorate("integrationRepository", integrationRepository);
  fastify.decorate("notificationRepository", notificationRepository);
  fastify.decorate("authRepository", authRepository);
  fastify.decorate("attachmentStorage", attachmentStorage);

  fastify.decorate("can", can);
  fastify.decorate("canWorkspace", canWorkspace);

  fastify.decorate("normalizeInviteEmails", (input: { email?: string; emails?: string[] }): string[] => {
    const candidates = [
      ...(input.email ? input.email.split(",") : []),
      ...(input.emails ?? []).flatMap((value) => value.split(","))
    ];

    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const value of candidates) {
      const trimmed = value.trim().toLowerCase();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      normalized.push(trimmed);
    }

    return normalized;
  });

  fastify.decorate("createScopedRepositories", (executor: DatabaseExecutor) => ({
    identityRepository: new PostgresIdentityRepository(executor),
    authRepository: new PostgresAuthRepository(executor),
    integrationRepository: new PostgresIntegrationRepository(executor),
    issueRepository: new PostgresIssueRepository(executor),
    notificationRepository: new PostgresNotificationRepository(executor),
    projectCollaborationRepository: new PostgresProjectCollaborationRepository(executor)
  }));

  fastify.decorate("resolveCurrentUser", async (request: FastifyRequest) => {
    const identity = getRequestIdentity(request);
    return resolveCurrentUserUseCase(identityRepository, {
      ...(identity.avatarUrl !== undefined ? { avatarUrl: identity.avatarUrl } : {}),
      ...(identity.email !== undefined ? { email: identity.email } : {}),
      name: identity.name,
      provider: identity.provider,
      providerUserId: identity.providerUserId
    });
  });

  fastify.decorate("recordAudit", async (input: {
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
  });

  fastify.decorate("filterIssuesByScope", <TIssue extends {
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
  });

  fastify.decorate("resolveProjectAccess", async (
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
  });

  fastify.decorate("resolveWorkspaceAccess", async (
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
  });

  fastify.decorate("resolvePersonalIssueFilters", async (
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
  });

  fastify.decorate("formatIssueStateLabel", (state: string) => {
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
  });

  fastify.decorate("formatIssuePriorityLabel", (priority: string) => {
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
  });

  fastify.decorate("buildIssueActivitySummary", (input: {
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
          return `set priority to ${fastify.formatIssuePriorityLabel(String(input.payload.to ?? "none"))}`;
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
        return `moved status to ${fastify.formatIssueStateLabel(String(input.payload.state ?? ""))}`;
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
          changes.push(`set priority to ${fastify.formatIssuePriorityLabel(String(input.payload.priority ?? "none"))}`);
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
  });

  fastify.decorate("requireWorkspaceAction", (
    reply: FastifyReply,
    membership: { role: WorkspaceRole } | null,
    action: "workspace.view" | "workspace.invite" | "workspace.manage",
    deniedMessage: string
  ) => {
    if (!membership || !canWorkspace(membership.role, action)) {
      return sendError(reply, 403, "workspace.forbidden", deniedMessage);
    }

    return null;
  });

  fastify.decorate("getProjectIdentity", async (projectId: string) => {
    return database
      .selectFrom("projects")
      .select(["id", "project_key", "workspace_id"])
      .where("id", "=", projectId)
      .executeTakeFirst();
  });

  fastify.decorate("resolveProjectLabels", async (projectId: string, labelIds: string[] | undefined) => {
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
  });
};

export default fp(contextPlugin);
