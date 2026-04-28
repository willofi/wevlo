import type { FastifyPluginAsync } from "fastify";

import { buildWorkspaceInvitationAcceptedEvent } from "../notification-events.js";
import { sendError } from "../errors.js";

const workspaceInvitationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/workspace-invitations/:acceptToken", async (request, reply) => {
    const params = request.params as { acceptToken: string };
    const invitation = await fastify.identityRepository.findInvitationByToken(params.acceptToken);

    if (!invitation || invitation.projectId) {
      return sendError(reply, 404, "workspace.invitation_not_found", "Invitation not found");
    }

    return reply.send(invitation);
  });

  fastify.post("/workspace-invitations/:acceptToken/accept", async (request, reply) => {
    const params = request.params as { acceptToken: string };
    const currentUser = await fastify.resolveCurrentUser(request);
    const invitation = await fastify.identityRepository.findInvitationByToken(params.acceptToken);

    if (!invitation || invitation.projectId) {
      return sendError(reply, 404, "workspace.invitation_not_found", "Invitation not found");
    }

    if (invitation.status !== "pending") {
      return sendError(reply, 409, "workspace.invitation_not_pending", "Invitation is not pending");
    }

    if (invitation.inviteeEmail && currentUser.email && invitation.inviteeEmail !== currentUser.email) {
      return sendError(reply, 403, "workspace.invitation_email_mismatch", "Invitation email does not match current user");
    }

    const workspace = await fastify.database
      .selectFrom("workspaces")
      .select(["id", "name", "slug"])
      .where("id", "=", invitation.workspaceId)
      .executeTakeFirst();

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    const accepted = await fastify.database.transaction().execute(async (trx) => {
      const scoped = fastify.createScopedRepositories(trx);
      const nextInvitation = await scoped.identityRepository.acceptInvitation(invitation.id, currentUser.id);

      if (!nextInvitation) {
        return null;
      }

      const event = buildWorkspaceInvitationAcceptedEvent({
        acceptedByName: currentUser.name,
        actorUserId: currentUser.id,
        invitation: nextInvitation,
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug
      });

      if (event) {
        await scoped.notificationRepository.enqueueEvent(event);
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

export default workspaceInvitationRoutes;
