import type { UserDto, WorkspaceInvitationDto, WorkspaceMemberDto } from "@wevlo/contracts";
import type { WorkspaceId } from "@wevlo/core";
import { sql, type DatabaseExecutor } from "@wevlo/data-access";

import {
  createUser,
  createUserIdentity,
  isUserHandleValid,
  normalizeUserHandle,
  UserHandleTakenError,
  type User
} from "../domain/user";
import type { WorkspaceMembership } from "../domain/workspace-membership";
import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  isWorkspaceInvitationExpired,
  revokeWorkspaceInvitation,
  type WorkspaceInvitation
} from "../domain/workspace-invitation";

const mapUserRow = (row: {
  created_at: string;
  email: string | null;
  handle: string;
  id: string;
  name: string;
  updated_at: string;
}): Omit<UserDto, "identities"> => ({
  createdAt: row.created_at,
  email: row.email,
  handle: row.handle,
  id: row.id,
  name: row.name,
  updatedAt: row.updated_at
});

const mapIdentityRow = (row: {
  created_at: string;
  email: string | null;
  id: string;
  provider: UserDto["identities"][number]["provider"];
  provider_user_id: string;
  user_id: string;
}): UserDto["identities"][number] => ({
  createdAt: row.created_at,
  email: row.email,
  id: row.id,
  provider: row.provider,
  providerUserId: row.provider_user_id,
  userId: row.user_id
});

const hydrateUser = async (database: DatabaseExecutor, userId: string): Promise<User | null> => {
  const userRow = await database
    .selectFrom("users")
    .selectAll()
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!userRow) {
    return null;
  }

  const identityRows = await database
    .selectFrom("user_identities")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "asc")
    .execute();

  return {
    ...mapUserRow(userRow),
    identities: identityRows.map(mapIdentityRow)
  };
};

const mapWorkspaceInvitationRow = (row: {
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

const toWorkspaceMembershipRole = (role: WorkspaceRole): WorkspaceRole => {
  return role;
};

export class PostgresIdentityRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async isHandleAvailable(handle: string, excludeUserId?: string): Promise<boolean> {
    const normalizedHandle = normalizeUserHandle(handle);
    const result = excludeUserId
      ? await sql<{ id: string }>`
          select id
          from users
          where lower(handle) = ${normalizedHandle}
            and id <> ${excludeUserId}
          limit 1
        `.execute(this.database)
      : await sql<{ id: string }>`
          select id
          from users
          where lower(handle) = ${normalizedHandle}
          limit 1
        `.execute(this.database);

    return result.rows.length === 0;
  }

  private async generateAvailableHandle(seed: string, excludeUserId?: string): Promise<string> {
    const baseHandle = normalizeUserHandle(seed);
    let candidate = baseHandle;
    let suffix = 0;

    while (!(await this.isHandleAvailable(candidate, excludeUserId))) {
      suffix += 1;
      const suffixText = String(suffix);
      const prefixLength = Math.max(3, 32 - suffixText.length);
      candidate = `${baseHandle.slice(0, prefixLength)}${suffixText}`;
    }

    return candidate;
  }

  async findUserById(userId: string): Promise<User | null> {
    return hydrateUser(this.database, userId);
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const row = await this.database
      .selectFrom("users")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return hydrateUser(this.database, row.id);
  }

  async findUserByIdentity(
    provider: UserDto["identities"][number]["provider"],
    providerUserId: string
  ): Promise<User | null> {
    const identityRow = await this.database
      .selectFrom("user_identities")
      .selectAll()
      .where("provider", "=", provider)
      .where("provider_user_id", "=", providerUserId)
      .executeTakeFirst();

    if (!identityRow) {
      return null;
    }

    return hydrateUser(this.database, identityRow.user_id);
  }

  async createUserWithIdentity(input: {
    email?: string | null;
    name: string;
    provider: UserDto["identities"][number]["provider"];
    providerUserId: string;
  }): Promise<User> {
    const handle = await this.generateAvailableHandle(input.name);
    const user = createUser({
      email: input.email ?? null,
      handle,
      name: input.name
    });
    const identity = createUserIdentity({
      email: input.email ?? null,
      provider: input.provider,
      providerUserId: input.providerUserId,
      userId: user.id
    });

    try {
      await this.database.transaction().execute(async (trx) => {
        await trx
          .insertInto("users")
          .values({
            created_at: user.createdAt,
            email: user.email,
            handle: user.handle,
            id: user.id,
            name: user.name,
            updated_at: user.updatedAt
          })
          .execute();

        await trx
          .insertInto("user_identities")
          .values({
            created_at: identity.createdAt,
            email: identity.email,
            id: identity.id,
            provider: identity.provider,
            provider_user_id: identity.providerUserId,
            user_id: identity.userId
          })
          .execute();
      });

      return {
        ...user,
        identities: [identity]
      };
    } catch (error) {
      // Handle race condition where another request created the user concurrently
      if (
        error instanceof Error &&
        (error.message.includes("duplicate key") || (error as { code?: string }).code === "23505")
      ) {
        const existing = await this.findUserByIdentity(input.provider, input.providerUserId);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  async updateUser(user: Pick<User, "email" | "handle" | "id" | "name">): Promise<User> {
    const nextHandle = user.handle ?? normalizeUserHandle(user.name);

    if (!isUserHandleValid(nextHandle)) {
      throw new Error(`Invalid handle: ${nextHandle}`);
    }

    if (!(await this.isHandleAvailable(nextHandle, user.id))) {
      throw new UserHandleTakenError(nextHandle);
    }

    await this.database
      .updateTable("users")
      .set({
        email: user.email,
        handle: nextHandle,
        name: user.name,
        updated_at: new Date().toISOString()
      })
      .where("id", "=", user.id)
      .execute();

    const hydrated = await hydrateUser(this.database, user.id);

    if (!hydrated) {
      throw new Error(`User not found after update: ${user.id}`);
    }

    return hydrated;
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMemberDto[]> {
    const rows = await this.database
      .selectFrom("workspace_memberships")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
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
          role: row.role,
          user,
          userId: row.user_id,
          workspaceId: row.workspace_id
        };
      })
    );

    return members.filter((member): member is WorkspaceMemberDto => member !== null);
  }

  async listMembershipsForUser(userId: string): Promise<WorkspaceMemberDto[]> {
    const rows = await this.database
      .selectFrom("workspace_memberships")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "asc")
      .execute();

    const user = await hydrateUser(this.database, userId);

    if (!user) {
      return [];
    }

    return rows.map((row) => ({
      createdAt: row.created_at,
      role: row.role,
      user,
      userId: row.user_id,
      workspaceId: row.workspace_id
    }));
  }

  async createMember(input: {
    role: WorkspaceMembership["role"];
    userId: string;
    workspaceId: string;
  }): Promise<WorkspaceMemberDto> {
    const user = await hydrateUser(this.database, input.userId);

    if (!user) {
      throw new Error(`User not found: ${input.userId}`);
    }

    const membership: WorkspaceMembership = {
      createdAt: new Date().toISOString(),
      role: input.role,
      userId: input.userId,
      workspaceId: input.workspaceId as WorkspaceId
    };

    await this.database
      .insertInto("workspace_memberships")
      .values({
        created_at: membership.createdAt,
        role: membership.role,
        user_id: membership.userId,
        workspace_id: membership.workspaceId
      })
      .onConflict((conflict) =>
        conflict.columns(["workspace_id", "user_id"]).doUpdateSet({
          role: membership.role
        })
      )
      .execute();

    return {
      createdAt: membership.createdAt,
      role: membership.role,
      user,
      userId: membership.userId,
      workspaceId: membership.workspaceId
    };
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    await this.database
      .deleteFrom("workspace_memberships")
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", userId)
      .execute();
  }

  async listInvitations(workspaceId: string): Promise<WorkspaceInvitationDto[]> {
    const rows = await this.database
      .selectFrom("workspace_invitations")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("project_id", "is", null)
      .orderBy("created_at", "asc")
      .execute();

    return rows.map(mapWorkspaceInvitationRow);
  }

  async findInvitationByToken(token: string): Promise<WorkspaceInvitationDto | null> {
    const row = await this.database
      .selectFrom("workspace_invitations")
      .selectAll()
      .where("accept_token", "=", token)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const invitation = mapWorkspaceInvitationRow(row);

    if (invitation.status === "pending" && isWorkspaceInvitationExpired(invitation)) {
      await this.database
        .updateTable("workspace_invitations")
        .set({
          status: "expired",
          updated_at: new Date().toISOString()
        })
        .where("id", "=", invitation.id)
        .execute();

      return {
        ...invitation,
        status: "expired",
        updatedAt: new Date().toISOString()
      };
    }

    return invitation;
  }

  async findInvitationById(invitationId: string): Promise<WorkspaceInvitationDto | null> {
    const row = await this.database
      .selectFrom("workspace_invitations")
      .selectAll()
      .where("id", "=", invitationId)
      .executeTakeFirst();

    return row ? mapWorkspaceInvitationRow(row) : null;
  }

  async createInvitation(input: {
    inviteeEmail?: string | null;
    inviteeUserId?: string | null;
    invitedByUserId: string;
    role: WorkspaceInvitation["role"];
    workspaceId: string;
  }): Promise<WorkspaceInvitationDto> {
    const invitation = createWorkspaceInvitation({
      inviteeEmail: input.inviteeEmail ?? null,
      inviteeUserId: input.inviteeUserId ?? null,
      invitedByUserId: input.invitedByUserId,
      role: input.role as "Owner" | "Member",
      workspaceId: input.workspaceId as WorkspaceId
    });

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

  async acceptInvitation(invitationId: string, acceptedByUserId: string): Promise<WorkspaceInvitationDto | null> {
    const existingRow = await this.database
      .selectFrom("workspace_invitations")
      .selectAll()
      .where("id", "=", invitationId)
      .executeTakeFirst();

    if (!existingRow) {
      return null;
    }

    const nextInvitation = acceptWorkspaceInvitation(mapWorkspaceInvitationRow(existingRow), acceptedByUserId);

    await this.database.transaction().execute(async (trx) => {
      await trx
        .updateTable("workspace_invitations")
        .set({
          accept_token: nextInvitation.acceptToken,
          accepted_at: nextInvitation.acceptedAt,
          accepted_by_user_id: nextInvitation.acceptedByUserId,
          status: nextInvitation.status,
          updated_at: nextInvitation.updatedAt
        })
        .where("id", "=", invitationId)
        .execute();

      await trx
        .insertInto("workspace_memberships")
        .values({
          created_at: nextInvitation.acceptedAt ?? new Date().toISOString(),
          role: nextInvitation.projectId ? "Member" : toWorkspaceMembershipRole(nextInvitation.role),
          user_id: acceptedByUserId,
          workspace_id: nextInvitation.workspaceId
        })
        .onConflict((conflict) => conflict.columns(["workspace_id", "user_id"]).doNothing())
        .execute();

      if (nextInvitation.projectId) {
        await trx
          .insertInto("project_memberships")
          .values({
            created_at: nextInvitation.acceptedAt ?? new Date().toISOString(),
            project_id: nextInvitation.projectId,
            role: nextInvitation.role as "Developer" | "Guest" | "Maintainer" | "Owner" | "Planner",
            user_id: acceptedByUserId
          })
          .onConflict((conflict) => conflict.columns(["project_id", "user_id"]).doNothing())
          .execute();
      }
    });

    return nextInvitation;
  }

  async revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
    const row = await this.database
      .selectFrom("workspace_invitations")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("id", "=", invitationId)
      .where("project_id", "is", null)
      .executeTakeFirst();

    if (!row) {
      return;
    }

    const invitation = revokeWorkspaceInvitation(mapWorkspaceInvitationRow(row));

    await this.database
      .updateTable("workspace_invitations")
      .set({
        accept_token: invitation.acceptToken,
        status: invitation.status,
        updated_at: invitation.updatedAt
      })
      .where("workspace_id", "=", workspaceId)
      .where("id", "=", invitationId)
      .where("project_id", "is", null)
      .execute();
  }

  async updateMember(workspaceId: string, userId: string, role: WorkspaceRole): Promise<void> {
    await this.database
      .updateTable("workspace_memberships")
      .set({ role })
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", userId)
      .execute();
  }

  async updateProfile(input: {
    handle?: string;
    name?: string;
    userId: string;
  }): Promise<User> {
    const currentUser = await this.findUserById(input.userId);

    if (!currentUser) {
      throw new Error(`User not found: ${input.userId}`);
    }

    return this.updateUser({
      email: currentUser.email,
      handle: input.handle ?? currentUser.handle,
      id: currentUser.id,
      name: input.name ?? currentUser.name
    });
  }
}
