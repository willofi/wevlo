import type { FastifyPluginAsync } from "fastify";
import {
  createProjectRequestSchema,
  projectInvitationRequestSchema,
  upsertProjectMemberRequestSchema,
  updateProjectBoardConfigRequestSchema,
  type ProjectRole,
} from "@wevlo/contracts";
import {
  createProjectUseCase,
  getProjectByKeyUseCase,
  getProjectBoardConfigUseCase,
  listProjectMembersUseCase,
  listWorkspaceProjectsUseCase,
  listProjectInvitationsUseCase,
  createProjectInvitationUseCase,
  revokeProjectInvitationUseCase,
  createProjectMemberUseCase,
  removeProjectMemberUseCase,
  updateProjectBoardConfigUseCase,
  ProjectAlreadyExistsError,
  ProjectKeyGenerationFailedError,
  WorkspaceMembershipRequiredError,
} from "@wevlo/projects";
import {
  resolveProjectBoardViewUseCase,
} from "@wevlo/issues";
import {
  buildProjectAccessGrantedEvent,
  buildProjectInvitationAcceptedEvent,
  buildProjectInvitationReceivedEvent,
  buildProjectInvitationRevokedEvent,
} from "../notification-events.js";
import { sendError } from "../errors.js";
import { can } from "@wevlo/authz";

const projectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/workspaces/:workspaceSlug/projects", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const userId = (await fastify.resolveCurrentUser(request)).id;
    const { workspace } = await fastify.resolveWorkspaceAccess(userId, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    const projects = await listWorkspaceProjectsUseCase(fastify.projectRepository, {
      userId,
      workspaceId: workspace.id
    });

    return reply.send(projects);
  });

  fastify.post("/workspaces/:workspaceSlug/projects", async (request, reply) => {
    const params = request.params as { workspaceSlug: string };
    const payload = createProjectRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const userId = currentUser.id;
    const { workspace } = await fastify.resolveWorkspaceAccess(userId, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    try {
      const project = await createProjectUseCase(fastify.projectRepository, {
        key: payload.key,
        name: payload.name,
        ownerUserId: userId,
        workspaceId: workspace.id
      });
      const readableProject = await getProjectByKeyUseCase(fastify.projectRepository, {
        projectKey: project.key,
        userId,
        workspaceId: workspace.id
      });
      await fastify.recordAudit({
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

  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const userId = (await fastify.resolveCurrentUser(request)).id;
    const { workspace } = await fastify.resolveWorkspaceAccess(userId, params.workspaceSlug);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    const project = await getProjectByKeyUseCase(fastify.projectRepository, {
      projectKey: params.projectKey,
      userId,
      workspaceId: workspace.id
    });

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    return reply.send(project);
  });

  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey/board", async (request, reply) => {
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

    const [boardConfig, issues] = await Promise.all([
      getProjectBoardConfigUseCase(fastify.projectBoardConfigRepository, {
        projectId: project.id
      }),
      fastify.issueRepository.listByProject(project.id)
    ]);

    const board = resolveProjectBoardViewUseCase(issues, boardConfig);

    return reply.send(board);
  });

  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey/board-config", async (request, reply) => {
    const params = request.params as {
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

    const config = await getProjectBoardConfigUseCase(fastify.projectBoardConfigRepository, {
      projectId: project.id
    });

    return reply.send(config);
  });

  fastify.patch("/workspaces/:workspaceSlug/projects/:projectKey/board-config", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = updateProjectBoardConfigRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.manage")) {
      return sendError(reply, 403, "project.forbidden", "Project board settings denied");
    }

    const config = await updateProjectBoardConfigUseCase(fastify.projectBoardConfigRepository, {
      projectId: project.id,
      columns: payload.columns
    });

    await fastify.recordAudit({
      action: "project.board.update",
      actorId: currentUser.id,
      payload,
      projectId: project.id,
      resourceId: project.id,
      workspaceId: workspace.id
    });

    return reply.send(config);
  });

  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey/invitations", async (request, reply) => {
    const params = request.params as {
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

    const invitations = await listProjectInvitationsUseCase(fastify.projectCollaborationRepository, project.id);
    return reply.send(invitations);
  });

  fastify.post("/workspaces/:workspaceSlug/projects/:projectKey/invitations", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const payload = projectInvitationRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

    if (!workspace) {
      return sendError(reply, 404, "workspace.not_found", "Workspace not found");
    }

    if (!project) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    if (!can(project.currentUserRole, "project.manage")) {
      return sendError(reply, 403, "project.forbidden", "Project invite denied");
    }

    const invitation = await fastify.database.transaction().execute(async (trx) => {
      const scoped = fastify.createScopedRepositories(trx);
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

    await fastify.recordAudit({
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

  fastify.delete("/workspaces/:workspaceSlug/projects/:projectKey/invitations/:invitationId", async (request, reply) => {
    const params = request.params as {
      invitationId: string;
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

    if (!can(project.currentUserRole, "project.manage")) {
      return sendError(reply, 403, "project.forbidden", "Project invite revoke denied");
    }

    const invitation = await fastify.identityRepository.findInvitationById(params.invitationId);

    if (!invitation || invitation.projectId !== project.id) {
      return sendError(reply, 404, "project.invitation_not_found", "Project invitation not found");
    }

    await fastify.database.transaction().execute(async (trx) => {
      const scoped = fastify.createScopedRepositories(trx);
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

    await fastify.recordAudit({
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

  fastify.post("/workspaces/:workspaceSlug/projects/:projectKey/invitations/:invitationId/accept", async (request, reply) => {
    const params = request.params as {
      invitationId: string;
      projectKey: string;
      workspaceSlug: string;
    };
    const currentUser = await fastify.resolveCurrentUser(request);
    const invitation = await fastify.identityRepository.findInvitationById(params.invitationId);

    if (!invitation || !invitation.projectId) {
      return sendError(reply, 404, "project.invitation_not_found", "Project invitation not found");
    }

    const projectIdentity = await fastify.getProjectIdentity(invitation.projectId);

    if (!projectIdentity || projectIdentity.project_key !== params.projectKey.toUpperCase()) {
      return sendError(reply, 404, "project.not_found", "Project not found");
    }

    const workspace = await fastify.workspaceRepository.findBySlug(params.workspaceSlug);

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

    const accepted = await fastify.database.transaction().execute(async (trx) => {
      const scoped = fastify.createScopedRepositories(trx);
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

    await fastify.recordAudit({
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

  fastify.post("/project-invitations/:acceptToken/accept", async (request, reply) => {
    const params = request.params as { acceptToken: string };
    const currentUser = await fastify.resolveCurrentUser(request);
    const invitation = await fastify.identityRepository.findInvitationByToken(params.acceptToken);

    if (!invitation || !invitation.projectId) {
      return sendError(reply, 404, "project.invitation_not_found", "Project invitation not found");
    }

    if (invitation.status !== "pending") {
      return sendError(reply, 409, "project.invitation_not_pending", "Invitation is not pending");
    }

    if (invitation.inviteeEmail && currentUser.email && invitation.inviteeEmail !== currentUser.email) {
      return sendError(reply, 403, "project.invitation_email_mismatch", "Invitation email does not match current user");
    }

    const workspaceRecord = await fastify.database
      .selectFrom("workspaces")
      .select(["slug"])
      .where("id", "=", invitation.workspaceId)
      .executeTakeFirst();
    const projectIdentity = await fastify.getProjectIdentity(invitation.projectId);
    const accepted = await fastify.database.transaction().execute(async (trx) => {
      const scoped = fastify.createScopedRepositories(trx);
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

    await fastify.recordAudit({
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

  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey/members", async (request, reply) => {
    const params = request.params as {
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

    const members = await listProjectMembersUseCase(fastify.projectCollaborationRepository, project.id);
    return reply.send(members);
  });

  fastify.put("/workspaces/:workspaceSlug/projects/:projectKey/members/:userId", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      userId: string;
      workspaceSlug: string;
    };
    const payload = upsertProjectMemberRequestSchema.parse(request.body);
    const currentUser = await fastify.resolveCurrentUser(request);
    const { project, workspace } = await fastify.resolveProjectAccess(currentUser.id, params);

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

    if (
      project.currentUserRole !== "Owner" &&
      projectRoleHierarchy[payload.role as ProjectRole] <= projectRoleHierarchy[project.currentUserRole as ProjectRole]
    ) {
      return sendError(reply, 403, "project.forbidden", "Cannot assign a role higher or equal to your own");
    }

    if (!(await fastify.projectRepository.isWorkspaceMember(workspace.id, params.userId))) {
      return sendError(reply, 403, "workspace.membership_required", "Workspace membership required");
    }

    const existingMembers = await listProjectMembersUseCase(fastify.projectCollaborationRepository, project.id);
    const targetMember = existingMembers.find((m) => m.userId === params.userId);

    if (
      targetMember &&
      project.currentUserRole !== "Owner" &&
      projectRoleHierarchy[targetMember.role as ProjectRole] <= projectRoleHierarchy[project.currentUserRole as ProjectRole]
    ) {
      return sendError(reply, 403, "project.forbidden", "Cannot modify a member with a role higher or equal to your own");
    }

    const member = await fastify.database.transaction().execute(async (trx) => {
      const scoped = fastify.createScopedRepositories(trx);
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

    await fastify.recordAudit({
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

  fastify.delete("/workspaces/:workspaceSlug/projects/:projectKey/members/:userId", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      userId: string;
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

    const existingMembers = await listProjectMembersUseCase(fastify.projectCollaborationRepository, project.id);
    const targetMember = existingMembers.find((m) => m.userId === params.userId);

    if (
      targetMember &&
      project.currentUserRole !== "Owner" &&
      projectRoleHierarchy[targetMember.role as ProjectRole] <= projectRoleHierarchy[project.currentUserRole as ProjectRole]
    ) {
      return sendError(reply, 403, "project.forbidden", "Cannot remove a member with a role higher or equal to your own");
    }

    await removeProjectMemberUseCase(fastify.projectCollaborationRepository, {
      projectId: project.id,
      userId: params.userId
    });

    await fastify.recordAudit({
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

  fastify.get("/workspaces/:workspaceSlug/projects/:projectKey/triage", async (request, reply) => {
    const params = request.params as {
      projectKey: string;
      workspaceSlug: string;
    };
    const { listIssuesUseCase } = await import("@wevlo/issues");
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

    return reply.send(issues.filter((issue) => issue.triageStatus === "pending"));
  });
};

export default projectRoutes;
