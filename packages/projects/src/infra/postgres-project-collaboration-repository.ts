import type { ProjectMemberDto, ProjectRole, WorkspaceInvitationDto } from "@wevlo/contracts";
import { createEntityId } from "@wevlo/core";
import type { DatabaseExecutor } from "@wevlo/data-access";

const hydrateUser = async (
  database: DatabaseExecutor,
  userId: string
): Promise<ProjectMemberDto["user"] | null> => {
  const userRow = await database
    .selectFrom("users")
    .selectAll()
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!userRow) {
    return null;
  }

  const identities = await database
    .selectFrom("user_identities")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "asc")
    .execute();

  return {
    avatarUrl: userRow.avatar_url,
    createdAt: userRow.created_at,
    email: userRow.email,
    handle: userRow.handle,
    id: userRow.id,
    identities: identities.map((identity) => ({
      createdAt: identity.created_at,
      email: identity.email,
      id: identity.id,
      provider: identity.provider,
      providerUserId: identity.provider_user_id,
      userId: identity.user_id
    })),
    name: userRow.name,
    updatedAt: userRow.updated_at
  };
};

const mapInvitationRow = (row: {
  accept_token: string | null;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  created_at: string;
  expires_at: string;
  id: string;
  invitee_email: string | null;
  invitee_user_id: string | null;
  invited_by_user_id: string;
  project_id: string | null;
  role: WorkspaceInvitationDto["role"];
  status: WorkspaceInvitationDto["status"];
  updated_at: string;
  workspace_id: string;
}): WorkspaceInvitationDto => ({
  acceptToken: row.accept_token,
  acceptedAt: row.accepted_at,
  acceptedByUserId: row.accepted_by_user_id,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  id: row.id,
  inviteeEmail: row.invitee_email,
  inviteeUserId: row.invitee_user_id,
  invitedByUserId: row.invited_by_user_id,
  projectId: row.project_id,
  role: row.role,
  status: row.status,
  updatedAt: row.updated_at,
  workspaceId: row.workspace_id
});

export class PostgresProjectCollaborationRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async listMembers(projectId: string): Promise<ProjectMemberDto[]> {
    const projectRow = await this.database
      .selectFrom("projects")
      .select(["workspace_id"])
      .where("id", "=", projectId)
      .executeTakeFirst();

    if (!projectRow) {
      return [];
    }

    const rows = await this.database
      .selectFrom("project_memberships")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("created_at", "asc")
      .execute();

    const members = await Promise.all(
      rows.map(async (row) => {
        const user = await hydrateUser(this.database, row.user_id);

        if (!user) {
          return null;
        }

        return {
          createdAt: row.created_at,
          projectId: row.project_id,
          role: row.role,
          user,
          userId: row.user_id,
          workspaceId: projectRow.workspace_id
        };
      })
    );

    return members.filter((member): member is NonNullable<typeof member> => member !== null);
  }

  async listMembershipsForUser(userId: string): Promise<ProjectMemberDto[]> {
    const rows = await this.database
      .selectFrom("project_memberships")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "asc")
      .execute();

    const user = await hydrateUser(this.database, userId);

    if (!user || rows.length === 0) {
      return [];
    }

    const projectRows = await this.database
      .selectFrom("projects")
      .select(["id", "workspace_id"])
      .where("id", "in", rows.map((row) => row.project_id))
      .execute();

    const projectWorkspaceIds = new Map(projectRows.map((row) => [row.id, row.workspace_id]));

    return rows.flatMap((row) => {
      const workspaceId = projectWorkspaceIds.get(row.project_id);

      if (!workspaceId) {
        return [];
      }

      return [
        {
          createdAt: row.created_at,
          projectId: row.project_id,
          role: row.role,
          user,
          userId: row.user_id,
          workspaceId
        }
      ];
    });
  }

  async createMember(input: {
    projectId: string;
    role: ProjectRole;
    userId: string;
  }): Promise<ProjectMemberDto> {
    const user = await hydrateUser(this.database, input.userId);

    if (!user) {
      throw new Error(`User not found: ${input.userId}`);
    }

    const projectRow = await this.database
      .selectFrom("projects")
      .select(["workspace_id"])
      .where("id", "=", input.projectId)
      .executeTakeFirst();

    if (!projectRow) {
      throw new Error(`Project not found: ${input.projectId}`);
    }

    const createdAt = new Date().toISOString();

    await this.database
      .insertInto("project_memberships")
      .values({
        created_at: createdAt,
        project_id: input.projectId,
        role: input.role,
        user_id: input.userId
      })
      .onConflict((conflict) =>
        conflict.columns(["project_id", "user_id"]).doUpdateSet({
          role: input.role
        })
      )
      .execute();

    return {
      createdAt,
      projectId: input.projectId,
      role: input.role,
      user,
      userId: input.userId,
      workspaceId: projectRow.workspace_id
    };
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.database
      .deleteFrom("project_memberships")
      .where("project_id", "=", projectId)
      .where("user_id", "=", userId)
      .execute();
  }

  async listInvitations(projectId: string): Promise<WorkspaceInvitationDto[]> {
    const rows = await this.database
      .selectFrom("workspace_invitations")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("created_at", "asc")
      .execute();

    return rows.map(mapInvitationRow);
  }

  async createInvitation(input: {
    inviteeEmail?: string | null;
    inviteeUserId?: string | null;
    invitedByUserId: string;
    projectId: string;
    role: ProjectRole;
    workspaceId: string;
  }): Promise<WorkspaceInvitationDto> {
    const createdAt = new Date().toISOString();
    const invitationId = createEntityId("workspace_invitation");
    const invitation: WorkspaceInvitationDto = {
      acceptToken: createEntityId("invite_token"),
      acceptedAt: null,
      acceptedByUserId: null,
      createdAt,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      id: invitationId,
      inviteeEmail: input.inviteeEmail ?? null,
      inviteeUserId: input.inviteeUserId ?? null,
      invitedByUserId: input.invitedByUserId,
      projectId: input.projectId,
      role: input.role,
      status: "pending",
      updatedAt: createdAt,
      workspaceId: input.workspaceId
    };

    await this.database
      .insertInto("workspace_invitations")
      .values({
        accept_token: invitation.acceptToken,
        accepted_at: invitation.acceptedAt,
        accepted_by_user_id: invitation.acceptedByUserId,
        created_at: invitation.createdAt,
        expires_at: invitation.expiresAt,
        id: invitation.id,
        invitee_email: invitation.inviteeEmail,
        invitee_user_id: invitation.inviteeUserId,
        invited_by_user_id: invitation.invitedByUserId,
        project_id: invitation.projectId,
        role: invitation.role,
        status: invitation.status,
        updated_at: invitation.updatedAt,
        workspace_id: invitation.workspaceId
      })
      .execute();

    return invitation;
  }

  async revokeInvitation(projectId: string, invitationId: string): Promise<void> {
    await this.database
      .updateTable("workspace_invitations")
      .set({
        status: "revoked",
        updated_at: new Date().toISOString()
      })
      .where("project_id", "=", projectId)
      .where("id", "=", invitationId)
      .execute();
  }
}
