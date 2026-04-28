import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createWorkspaceRequestSchema,
  workspaceSummarySchema,
  workspaceInvitationRequestSchema,
  workspaceRoleSchema,
  createWorkspaceInvitationsResponseSchema,
  type WorkspaceRole,
  type WorkspaceInvitationResult,
} from "@wevlo/contracts";
import {
  createWorkspaceUseCase,
  listVisibleWorkspacesUseCase,
  listWorkspaceMembersUseCase,
  listWorkspaceInvitationsUseCase,
  createWorkspaceInvitationUseCase,
  updateWorkspaceMemberUseCase,
  removeWorkspaceMemberUseCase,
  WorkspaceSlugTakenError,
  WorkspaceSlugGenerationFailedError,
} from "@wevlo/identity-tenancy";
import {
  buildProjectInvitationAcceptedEvent,
  buildWorkspaceInvitationAcceptedEvent,
  buildWorkspaceInvitationReceivedEvent,
} from "../notification-events.js";
import { sendWorkspaceInviteEmail } from "../invite-email.js";
import { sendError } from "../errors.js";

const workspaceRoutes: FastifyPluginAsync = async (fastify) => {
  const webAppBaseUrl = (process.env.NEXTAUTH_URL ?? process.env.WEVLO_WEB_BASE_URL ?? "http://localhost:3000").trim();

  fastify.get("/", async (request, reply) => {
    const userId = (await fastify.resolveCurrentUser(request)).id;
    const workspaces = await listVisibleWorkspacesUseCase(fastify.workspaceRepository, userId);
    return reply.send(workspaces.map((workspace) => workspaceSummarySchema.parse(workspace)));
  });

  fastify.post("/", async (request, reply) => {
    const payload = createWorkspaceRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const userId = currentUser.id;

    try {
      const workspace = await createWorkspaceUseCase(fastify.workspaceRepository, {
        name: payload.name,
        ownerUserId: userId,
        slug: payload.slug
      });
      await fastify.recordAudit({
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

  fastify.get("/:workspaceSlug", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const userId = (await fastify.resolveCurrentUser(request)).id;
    const { workspace } = await fastify.resolveWorkspaceAccess(userId, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    return reply.send(workspace);
  });

  fastify.get("/:workspaceSlug/search", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const { workspaceSearchQuerySchema } = await import("@wevlo/contracts");
    const query = workspaceSearchQuerySchema.parse(request.query);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { membership, workspace } = await fastify.resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!membership || !fastify.canWorkspace(membership.role, "workspace.view")) {
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
        ? fastify.database
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
        ? fastify.database
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

  fastify.get("/:workspaceSlug/members", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const currentUser = await fastify.resolveCurrentUser(request);
    const { membership, workspace } = await fastify.resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (fastify.requireWorkspaceAction(reply, membership, "workspace.view", "Workspace access denied")) {
      return;
    }

    const members = await listWorkspaceMembersUseCase(fastify.identityRepository, workspace.id);
    return reply.send(members);
  });

  fastify.get("/:workspaceSlug/invitations", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const currentUser = await fastify.resolveCurrentUser(request);
    const { membership, workspace } = await fastify.resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (fastify.requireWorkspaceAction(reply, membership, "workspace.view", "Workspace access denied")) {
      return;
    }

    const invitations = await listWorkspaceInvitationsUseCase(fastify.identityRepository, workspace.id);
    return reply.send(invitations);
  });

  fastify.post("/:workspaceSlug/invitations", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const payload = workspaceInvitationRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { membership, workspace } = await fastify.resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (fastify.requireWorkspaceAction(reply, membership, "workspace.invite", "Workspace invite denied")) {
      return;
    }
    const inviteEmails = fastify.normalizeInviteEmails({
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.emails ? { emails: payload.emails } : {})
    });
    if (inviteEmails.length === 0 && payload.userId) {
      const invitedUser = await fastify.identityRepository.findUserById(payload.userId);
      if (invitedUser?.email) {
        inviteEmails.push(invitedUser.email.trim().toLowerCase());
      }
    }
    if (inviteEmails.length === 0) {
      return sendError(reply, 400, "workspace.invite_invalid_target", "No valid invite targets were provided");
    }
    const emailSchema = z.string().email();
    const results: WorkspaceInvitationResult[] = [];

    for (const email of inviteEmails) {
      if (!emailSchema.safeParse(email).success) {
        results.push({
          email,
          invitationId: null,
          reason: "invalid_email",
          status: "failed"
        });
        continue;
      }

      try {
        const inviteResult = await fastify.database.transaction().execute(async (trx) => {
          const scoped = fastify.createScopedRepositories(trx);
          const existingUser = await scoped.identityRepository.findUserByEmail(email);

          if (existingUser) {
            await scoped.identityRepository.createMember({
              role: payload.role,
              userId: existingUser.id,
              workspaceId: workspace.id
            });

            return {
              email,
              expiresAt: null as string | null,
              invitationId: null as string | null,
              inviteToken: null as string | null,
              status: "already_member" as const
            };
          }

          const createdInvitation = await createWorkspaceInvitationUseCase(scoped.identityRepository, {
            inviteeEmail: email,
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

          await fastify.recordAudit({
            action: "workspace.invite",
            actorId: currentUser.id,
            payload: {
              inviteeEmail: createdInvitation.inviteeEmail,
              invitationId: createdInvitation.id,
              role: createdInvitation.role
            },
            resourceId: createdInvitation.id,
            workspaceId: workspace.id
          });

          return {
            email,
            expiresAt: createdInvitation.expiresAt,
            invitationId: createdInvitation.id,
            inviteToken: createdInvitation.acceptToken,
            status: "created" as const
          };
        });

        const invitePathToken = inviteResult.inviteToken ?? inviteResult.invitationId;
        const inviteUrl = invitePathToken ? `${webAppBaseUrl}/invite/${encodeURIComponent(invitePathToken)}` : `${webAppBaseUrl}/`;

        try {
          await sendWorkspaceInviteEmail({
            expiresAt: inviteResult.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            inviteUrl,
            role: payload.role,
            to: email,
            workspaceName: workspace.name
          });
        } catch (emailError) {
          request.log.error(
            { email, error: emailError instanceof Error ? emailError.message : String(emailError) },
            "workspace invite email send failed"
          );
          results.push({
            email,
            invitationId: inviteResult.invitationId,
            reason: "email_send_failed",
            status: inviteResult.status
          });
          continue;
        }

        results.push({
          email,
          invitationId: inviteResult.invitationId,
          reason: null,
          status: inviteResult.status
        });
      } catch (error) {
        request.log.error(
          { email, error: error instanceof Error ? error.message : String(error) },
          "workspace invite creation failed"
        );
        results.push({
          email,
          invitationId: null,
          reason: "invite_create_failed",
          status: "failed"
        });
      }
    }

    return reply.status(201).send(createWorkspaceInvitationsResponseSchema.parse({ results }));
  });

  fastify.put("/:workspaceSlug/members/:userId", async (request, reply) => {
    const params = request.params as { userId: string; workspaceSlug: string };
    const payload = z.object({ role: workspaceRoleSchema }).parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { membership, workspace } = await fastify.resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!membership || fastify.requireWorkspaceAction(reply, membership, "workspace.manage", "Workspace management denied")) {
      return;
    }

    const workspaceRoleHierarchy: Record<WorkspaceRole, number> = {
      Owner: 0,
      Maintainer: 1,
      Member: 2,
      Developer: 3,
      Guest: 4
    };

    const members = await listWorkspaceMembersUseCase(fastify.identityRepository, workspace.id);
    const targetMember = members.find((m) => m.userId === params.userId);

    if (!targetMember) {
      return sendError(reply, 404, "member.not_found", "Member not found");
    }

    if (payload.role === "Owner" && targetMember.role !== "Owner") {
      return sendError(reply, 403, "workspace.forbidden", "Owner role is restricted and cannot be granted manually");
    }

    if (targetMember.role === "Owner" && payload.role !== "Owner") {
      return sendError(reply, 403, "workspace.forbidden", "The workspace owner cannot be demoted");
    }

    if (
      membership.role !== "Owner" &&
      workspaceRoleHierarchy[targetMember.role as WorkspaceRole] <= workspaceRoleHierarchy[membership.role as WorkspaceRole]
    ) {
      return sendError(reply, 403, "workspace.forbidden", "You cannot modify a member with a role higher or equal to your own");
    }

    if (
      membership.role !== "Owner" &&
      workspaceRoleHierarchy[payload.role as WorkspaceRole] <= workspaceRoleHierarchy[membership.role as WorkspaceRole]
    ) {
      return sendError(reply, 403, "workspace.forbidden", "You cannot grant a role higher or equal to your own");
    }

    await updateWorkspaceMemberUseCase(fastify.identityRepository, {
      role: payload.role,
      userId: params.userId,
      workspaceId: workspace.id
    });

    const updatedMembers = await listWorkspaceMembersUseCase(fastify.identityRepository, workspace.id);
    const updatedMember = updatedMembers.find((m) => m.userId === params.userId);
    return reply.send(updatedMember);
  });

  fastify.delete("/:workspaceSlug/members/:userId", async (request, reply) => {
    const params = request.params as { userId: string; workspaceSlug: string };
    const currentUser = await fastify.resolveCurrentUser(request);
    const { membership, workspace } = await fastify.resolveWorkspaceAccess(currentUser.id, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!membership || fastify.requireWorkspaceAction(reply, membership, "workspace.manage", "Workspace management denied")) {
      return;
    }

    const workspaceRoleHierarchy: Record<WorkspaceRole, number> = {
      Owner: 0,
      Maintainer: 1,
      Member: 2,
      Developer: 3,
      Guest: 4
    };

    const members = await listWorkspaceMembersUseCase(fastify.identityRepository, workspace.id);
    const targetMember = members.find((m) => m.userId === params.userId);

    if (!targetMember) {
      return sendError(reply, 404, "member.not_found", "Member not found");
    }

    if (targetMember.role === "Owner") {
      return sendError(reply, 403, "workspace.forbidden", "The workspace owner cannot be removed");
    }

    if (
      membership.role !== "Owner" &&
      workspaceRoleHierarchy[targetMember.role as WorkspaceRole] <= workspaceRoleHierarchy[membership.role as WorkspaceRole]
    ) {
      return sendError(reply, 403, "workspace.forbidden", "You cannot remove a member with a role higher or equal to your own");
    }

    if (params.userId === currentUser.id) {
      return sendError(reply, 400, "workspace.cannot_remove_self", "You cannot remove yourself from the workspace");
    }

    await removeWorkspaceMemberUseCase(fastify.identityRepository, {
      userId: params.userId,
      workspaceId: workspace.id
    });

    return reply.status(204).send();
  });

  fastify.post("/:workspaceSlug/invitations/:invitationId/accept", async (request, reply) => {
    const params = request.params as {
      invitationId: string;
      workspaceSlug: string;
    };
    const currentUser = await fastify.resolveCurrentUser(request);
    const invitation = await fastify.identityRepository.findInvitationById(params.invitationId);

    if (!invitation) {
      return sendError(reply, 404, "workspace.invitation_not_found", "Invitation not found");
    }

    if (invitation.workspaceId && invitation.acceptedAt) {
      return reply.send(invitation);
    }

    const workspace = await fastify.workspaceRepository.findBySlug(params.workspaceSlug);

    if (!workspace || workspace.id !== invitation.workspaceId) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (invitation.status !== "pending") {
      return sendError(reply, 409, "workspace.invitation_not_pending", "Invitation is not pending");
    }

    if (invitation.inviteeEmail && currentUser.email && invitation.inviteeEmail !== currentUser.email) {
      return sendError(reply, 403, "workspace.invitation_email_mismatch", "Invitation email does not match current user");
    }

    const accepted = await fastify.database.transaction().execute(async (trx) => {
      const scoped = fastify.createScopedRepositories(trx);
      const nextInvitation = await scoped.identityRepository.acceptInvitation(invitation.id, currentUser.id);

      if (!nextInvitation) {
        return null;
      }

      const event = nextInvitation.projectId
        ? (() => {
            const projectPromise = fastify.getProjectIdentity(nextInvitation.projectId);
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

    await fastify.recordAudit({
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
};

export default workspaceRoutes;
