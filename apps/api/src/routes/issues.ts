import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import {
  createIssueLabelRequestSchema,
  createCommentRequestSchema,
  createIssueRequestSchema,
  listIssuesQuerySchema,
  transitionIssueRequestSchema,
  updateIssueReactionRequestSchema,
  updateIssueSubscriptionRequestSchema,
  updateIssueRequestSchema,
  issueSubscriptionResponseSchema,
} from "@wevlo/contracts";
import {
  listWorkspaceMembersUseCase,
} from "@wevlo/identity-tenancy";
import {
  acceptTriageUseCase,
  extractCommentMentions,
  extractIssueMentions,
  commentOnIssueUseCase,
  createIssueUseCase,
  getIssueUseCase,
  IssueMutationNotAllowedError,
  IssueNotFoundError,
  IssueTransitionNotAllowedError,
  IssueTriageStatusError,
  listIssuesUseCase,
  setCommentReactionUseCase,
  transitionIssueUseCase,
  triageIssueUseCase,
  updateIssueUseCase,
} from "@wevlo/issues";
import {
  buildIssueAssignedEvent,
  buildIssueCommentEvent,
  buildIssueDescriptionMentionEvent,
} from "../notification-events.js";
import { sendError } from "../errors.js";
import { can } from "@wevlo/authz";

const issueRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey/labels", async (request, reply) => {
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

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const labels = await fastify.issueRepository.listLabels(project.id);
    return reply.send(labels);
  });

  fastify.post("/workspaces/:workspaceSlug/projects/:projectKey/labels", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = createIssueLabelRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.edit")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const label = await fastify.issueRepository.createLabel({
      color: payload.color ?? "slate",
      name: payload.name,
      projectId: project.id
    });

    return reply.status(201).send(label);
  });

  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey/issues", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const query = listIssuesQuerySchema.parse(request.query);
    const userId = (await fastify.resolveCurrentUser(request)).id;
    const { project, workspace } = await fastify.resolveProjectAccess(userId, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const issues = await listIssuesUseCase(fastify.issueRepository, {
      projectId: project.id
    });

    return reply.send(fastify.filterIssuesByScope(issues, userId, query.scope ?? "all"));
  });

  fastify.post("/workspaces/:workspaceSlug/projects/:projectKey/issues", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = createIssueRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const userId = currentUser.id;
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.create")) {
      return sendError(reply, 403, "issue.forbidden", "Issue creation denied");
    }

    const workspaceMembers = await listWorkspaceMembersUseCase(fastify.identityRepository, workspace.id);
    const descriptionMentions = extractIssueMentions(
      payload.description,
      workspaceMembers.map((member) => ({
        handle: member.user.handle,
        userId: member.userId
      }))
    );
    let labels: any[];
    let parentIssueId: string | null = null;

    try {
      labels = await fastify.resolveProjectLabels(project.id, payload.labelIds);
    } catch (error) {
      return sendError(reply, 400, "issue.invalid_labels", error instanceof Error ? error.message : "Invalid labels");
    }

    if (payload.parentIssueKey) {
      const parentIssue = await getIssueUseCase(fastify.issueRepository, {
        issueKey: payload.parentIssueKey,
        projectId: project.id
      });

      if (!parentIssue) {
        return sendError(reply, 400, "issue.parent_not_found", "Parent issue not found");
      }

      parentIssueId = parentIssue.id;
    }

    const issue = await fastify.database.transaction().execute(async (trx) => {
      const scoped = fastify.createScopedRepositories(trx);
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

    await fastify.recordAudit({
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

  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
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

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const issue = await getIssueUseCase(fastify.issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!issue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    return reply.send(issue);
  });

  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/activity", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
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

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const issue = await getIssueUseCase(fastify.issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!issue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    const [auditRows, labelRows] = await Promise.all([
      fastify.database
        .selectFrom("audit_events")
        .select(["action", "actor_id", "id", "occurred_at", "payload"])
        .where("issue_id", "=", issue.id)
        .orderBy("occurred_at", "asc")
        .execute(),
      fastify.database
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

        const summary = fastify.buildIssueActivitySummary({
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

  fastify.patch("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const body = request.body as any;
    const labelIds = body.labelIds ?? (Array.isArray(body.labels) ? body.labels.map((l: any) => l.id).filter(Boolean) : undefined);
    const payload = updateIssueRequestSchema.parse({ ...body, labelIds });
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.edit")) {
      return sendError(reply, 403, "issue.forbidden", "Issue editing denied");
    }

    const previousIssue = await getIssueUseCase(fastify.issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!previousIssue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    const workspaceMembers =
      payload.description !== undefined
        ? await listWorkspaceMembersUseCase(fastify.identityRepository, workspace.id)
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

    let labels: any[] | undefined;

    if (payload.labelIds !== undefined) {
      labels = await fastify.resolveProjectLabels(project.id, payload.labelIds);
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

    if (Object.keys(changes).length === 0) {
      return reply.send(previousIssue);
    }

    const issue = await fastify.database.transaction().execute(async (trx) => {
      const scoped = fastify.createScopedRepositories(trx);
      const updatedIssue = await updateIssueUseCase(scoped.issueRepository, {
        actor: "local",
        changes,
        issueKey: params.issueKey,
        projectId: project.id
      });

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

    const actions = Object.keys(changes).filter(key => key !== "descriptionMentions");
    for (const actionKey of actions) {
      await fastify.recordAudit({
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

  fastify.post("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/transition", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = transitionIssueRequestSchema.parse(request.body);
    const userId = (await fastify.resolveCurrentUser(request)).id;
    const { project, workspace } = await fastify.resolveProjectAccess(userId, params);

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
      const issue = await transitionIssueUseCase(fastify.issueRepository, {
        actor: "local",
        issueKey: params.issueKey,
        nextState: payload.state,
        projectId: project.id
      });

      await fastify.recordAudit({
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

  fastify.post("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/comments", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = createCommentRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

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
      const previousIssue = await getIssueUseCase(fastify.issueRepository, {
        issueKey: params.issueKey,
        projectId: project.id
      });

      if (!previousIssue) {
        return sendError(reply, 404, "issue.not_found", "Issue not found");
      }

      const workspaceMembers = await listWorkspaceMembersUseCase(fastify.identityRepository, workspace.id);
      const mentions = extractCommentMentions(
        payload.body,
        workspaceMembers.map((member) => ({
          handle: member.user.handle,
          userId: member.userId
        }))
      );

      const issue = await fastify.database.transaction().execute(async (trx) => {
        const scoped = fastify.createScopedRepositories(trx);
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

      await fastify.recordAudit({
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

  fastify.put("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/comments/:commentId/reactions", async (request, reply) => {
    const params = request.params as {
      commentId: string;
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = updateIssueReactionRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "issue.forbidden", "Issue reaction denied");
    }

    const issue = await setCommentReactionUseCase(fastify.issueRepository, {
      active: payload.active ?? true,
      commentId: params.commentId,
      emoji: payload.emoji,
      issueKey: params.issueKey,
      projectId: project.id,
      userId: currentUser.id
    });

    return reply.send(issue);
  });

  fastify.post("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/attachments", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.edit")) {
      return sendError(reply, 403, "issue.forbidden", "Issue attachment upload denied");
    }

    const issue = await getIssueUseCase(fastify.issueRepository, {
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

    const stored = await fastify.attachmentStorage.put({
      buffer,
      contentType
    });

    try {
      const attachment = await fastify.issueRepository.createAttachment({
        byteSize: stored.byteSize,
        checksum: stored.checksum,
        contentType,
        fileName,
        id: `attachment_${randomUUID()}`,
        issueId: issue.id,
        storageKey: stored.storageKey,
        uploadedByUserId: currentUser.id
      });

      await fastify.recordAudit({
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
      await fastify.attachmentStorage.delete(stored.storageKey);
      throw error;
    }
  });

  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/attachments/:attachmentId", async (request, reply) => {
    const params = request.params as {
      attachmentId: string;
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const issue = await getIssueUseCase(fastify.issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!issue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    const attachment = await fastify.issueRepository.findAttachment(params.attachmentId, issue.id);

    if (!attachment) {
      return sendError(reply, 404, "attachment.not_found", "Attachment not found");
    }

    const fileName = attachment.fileName.replace(/"/g, "");

    reply.header("content-type", attachment.contentType);
    reply.header("content-length", String(attachment.byteSize));
    reply.header("content-disposition", `inline; filename="${fileName}"`);

    const attachmentStream = await fastify.attachmentStorage.stream(attachment.storageKey);
    return reply.send(attachmentStream);
  });

  fastify.delete("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/attachments/:attachmentId", async (request, reply) => {
    const params = request.params as {
      attachmentId: string;
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "issue.edit")) {
      return sendError(reply, 403, "issue.forbidden", "Issue attachment deletion denied");
    }

    const issue = await getIssueUseCase(fastify.issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!issue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    const attachment = await fastify.issueRepository.findAttachment(params.attachmentId, issue.id);

    if (!attachment) {
      return sendError(reply, 404, "attachment.not_found", "Attachment not found");
    }

    await fastify.issueRepository.deleteAttachment(attachment.id, issue.id);
    await fastify.attachmentStorage.delete(attachment.storageKey);

    await fastify.recordAudit({
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

  fastify.put("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/reactions", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = updateIssueReactionRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const existingIssue = await getIssueUseCase(fastify.issueRepository, {
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

    const issue = await fastify.database.transaction().execute(async (trx) => {
      const scoped = fastify.createScopedRepositories(trx);

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

    await fastify.recordAudit({
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

  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/subscription", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const issue = await getIssueUseCase(fastify.issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!issue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    const subscription = await fastify.issueRepository.getSubscriptionState(issue.id, currentUser.id);
    return reply.send(issueSubscriptionResponseSchema.parse(subscription));
  });

  fastify.put("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/subscription", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = updateIssueSubscriptionRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.view")) {
      return sendError(reply, 403, "project.forbidden", "Project access denied");
    }

    const issue = await getIssueUseCase(fastify.issueRepository, {
      issueKey: params.issueKey,
      projectId: project.id
    });

    if (!issue) {
      return sendError(reply, 404, "issue.not_found", "Issue not found");
    }

    const subscription = await fastify.issueRepository.setSubscription({
      issueId: issue.id,
      subscribed: payload.subscribed,
      userId: currentUser.id
    });

    return reply.send(issueSubscriptionResponseSchema.parse(subscription));
  });

  fastify.post("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/triage", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = updateIssueRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const userId = currentUser.id;
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

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
      const previousIssue = await getIssueUseCase(fastify.issueRepository, {
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

      const issue = await fastify.database.transaction().execute(async (trx) => {
        const scoped = fastify.createScopedRepositories(trx);
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

      await fastify.recordAudit({
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

  fastify.post("/workspaces/:workspaceSlug/projects/:projectKey/issues/:issueKey/triage/accept", async (request, reply) => {
    const params = request.params as {
      issueKey: string;
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

    if (!can(project.currentUserRole, "issue.prioritize")) {
      return sendError(reply, 403, "issue.forbidden", "Issue triage denied");
    }

    try {
      const issue = await acceptTriageUseCase(fastify.issueRepository, {
        actor: "local",
        issueKey: params.issueKey,
        projectId: project.id
      });

      await fastify.recordAudit({
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
};

export default issueRoutes;
