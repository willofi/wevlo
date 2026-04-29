import type { UserDto, WorkspaceInvitationDto, WorkspaceMemberDto, WorkspaceRole } from "@wevlo/contracts";
import type { WorkspaceId } from "@wevlo/core";
import { sql, type DatabaseExecutor } from "@wevlo/data-access";
import { createHash } from "node:crypto";

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
  revokeWorkspaceInvitation
} from "../domain/workspace-invitation";

const normalizeSupabasePublicStorageBaseUrl = (): string | null => {
  const driver = process.env.WEVLO_STORAGE_DRIVER?.trim();
  const endpoint = process.env.WEVLO_S3_ENDPOINT?.trim();
  const bucket = process.env.WEVLO_S3_BUCKET?.trim();

  if (driver !== "supabase_s3" || !endpoint || !bucket) {
    return null;
  }

  try {
    const url = new URL(endpoint);
    return `${url.origin}/storage/v1/object/public/${bucket}`;
  } catch {
    return null;
  }
};

const encodeStorageKey = (storageKey: string): string =>
  storageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const resolveAvatarUrl = (input: {
  avatarStorageKey: string | null;
  avatarUrl: string | null;
}): string | null => {
  const publicBaseUrl = normalizeSupabasePublicStorageBaseUrl();

  if (publicBaseUrl && input.avatarStorageKey) {
    return `${publicBaseUrl}/${encodeStorageKey(input.avatarStorageKey)}`;
  }

  return input.avatarUrl;
};

const mapUserRow = (row: {
  avatar_content_type: string | null;
  avatar_storage_key: string | null;
  avatar_url: string | null;
  created_at: string;
  email: string | null;
  handle: string;
  id: string;
  name: string;
  updated_at: string;
}): Omit<User, "identities"> => ({
  avatarContentType: row.avatar_content_type,
  avatarStorageKey: row.avatar_storage_key,
  avatarUrl: resolveAvatarUrl({
    avatarStorageKey: row.avatar_storage_key,
    avatarUrl: row.avatar_url
  }),
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

const hydrateUsersByIds = async (
  database: DatabaseExecutor,
  userIds: string[]
): Promise<Map<string, User>> => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  if (uniqueUserIds.length === 0) {
    return new Map();
  }

  const [userRows, identityRows] = await Promise.all([
    database
      .selectFrom("users")
      .selectAll()
      .where("id", "in", uniqueUserIds)
      .execute(),
    database
      .selectFrom("user_identities")
      .selectAll()
      .where("user_id", "in", uniqueUserIds)
      .orderBy("created_at", "asc")
      .execute()
  ]);

  const identitiesByUserId = new Map<string, UserDto["identities"]>();

  for (const identityRow of identityRows) {
    const current = identitiesByUserId.get(identityRow.user_id) ?? [];
    current.push(mapIdentityRow(identityRow));
    identitiesByUserId.set(identityRow.user_id, current);
  }

  return new Map(
    userRows.map((userRow) => [
      userRow.id,
      {
        ...mapUserRow(userRow),
        identities: identitiesByUserId.get(userRow.id) ?? []
      }
    ])
  );
};

const hydrateUser = async (database: DatabaseExecutor, userId: string): Promise<User | null> => {
  const usersById = await hydrateUsersByIds(database, [userId]);
  return usersById.get(userId) ?? null;
};

const mapWorkspaceInvitationRow = (row: {
  accept_token: string | null;
  accept_token_hash: string | null;
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
  send_attempt_count: number;
  status: WorkspaceInvitationDto["status"];
  last_send_error: string | null;
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
  sendAttemptCount: Number(row.send_attempt_count ?? 0),
  status: row.status,
  lastSendError: row.last_send_error ?? null,
  updatedAt: row.updated_at,
  workspaceId: row.workspace_id
});

const hashInvitationToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

export class PostgresIdentityRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  private async grantWorkspaceProjectVisibility(
    executor: DatabaseExecutor,
    workspaceId: string,
    userId: string,
    createdAt: string
  ): Promise<void> {
    await sql`
      insert into project_memberships (created_at, project_id, role, user_id)
      select ${createdAt}, projects.id, 'Guest', ${userId}
      from projects
      where projects.workspace_id = ${workspaceId}
      on conflict (project_id, user_id) do nothing
    `.execute(executor);
  }

  async findUserById(userId: string): Promise<User | null> {
    return hydrateUser(this.database, userId);
  }

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

  async upsertIdentityForUser(input: {
    email?: string | null;
    provider: UserDto["identities"][number]["provider"];
    providerUserId: string;
    userId: string;
  }): Promise<User> {
    const existingIdentity = await this.database
      .selectFrom("user_identities")
      .selectAll()
      .where("provider", "=", input.provider)
      .where("provider_user_id", "=", input.providerUserId)
      .executeTakeFirst();

    if (existingIdentity) {
      const nextEmail = input.email ?? existingIdentity.email;

      if (existingIdentity.user_id !== input.userId || existingIdentity.email !== nextEmail) {
        await this.database
          .updateTable("user_identities")
          .set({
            email: nextEmail,
            user_id: input.userId
          })
          .where("id", "=", existingIdentity.id)
          .execute();
      }
    } else {
      const identity = createUserIdentity({
        email: input.email ?? null,
        provider: input.provider,
        providerUserId: input.providerUserId,
        userId: input.userId
      });

      await this.database
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
    }

    if (input.email) {
      const nextUserEmail = input.email;

      await this.database
        .updateTable("users")
        .set({
          email: nextUserEmail,
          updated_at: new Date().toISOString()
        })
        .where("id", "=", input.userId)
        .where((eb) => eb.or([
          eb("email", "is", null),
          eb("email", "=", nextUserEmail)
        ]))
        .execute();
    }

    const hydrated = await hydrateUser(this.database, input.userId);

    if (!hydrated) {
      throw new Error(`User not found after identity upsert: ${input.userId}`);
    }

    return hydrated;
  }

  async createUserWithIdentity(input: {
    avatarUrl?: string | null;
    email?: string | null;
    name: string;
    provider: UserDto["identities"][number]["provider"];
    providerUserId: string;
  }): Promise<User> {
    const fallbackName = input.name.trim().length > 0 ? input.name : (input.email?.split("@")[0] ?? "user");
    const handle = await this.generateAvailableHandle(fallbackName);
    const user = createUser({
      avatarContentType: null,
      avatarUrl: input.avatarUrl ?? null,
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
            avatar_content_type: user.avatarContentType,
            avatar_storage_key: user.avatarStorageKey,
            avatar_url: user.avatarUrl,
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

  async updateUser(user: Pick<User, "avatarContentType" | "avatarStorageKey" | "avatarUrl" | "email" | "handle" | "id" | "name">): Promise<User> {
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
        avatar_content_type: user.avatarContentType,
        avatar_storage_key: user.avatarStorageKey,
        avatar_url: user.avatarUrl,
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

    const usersById = await hydrateUsersByIds(this.database, rows.map((row) => row.user_id));

    return rows.flatMap((row) => {
      const user = usersById.get(row.user_id);

      if (!user) {
        return [];
      }

      return [
        {
          createdAt: row.created_at,
          role: row.role,
          user,
          userId: row.user_id,
          workspaceId: row.workspace_id
        }
      ];
    });
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

    await this.database.transaction().execute(async (trx) => {
      await trx
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

      await this.grantWorkspaceProjectVisibility(trx, membership.workspaceId, membership.userId, membership.createdAt);
    });

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

  async listInvitations(
    workspaceId: string,
    status?: WorkspaceInvitationDto["status"]
  ): Promise<WorkspaceInvitationDto[]> {
    let query = this.database
      .selectFrom("workspace_invitations")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .where("project_id", "is", null)
      .orderBy("created_at", "asc");

    if (status) {
      query = query.where("status", "=", status);
    }

    const rows = await query.execute();

    return rows.map(mapWorkspaceInvitationRow);
  }

  async findInvitationByToken(token: string): Promise<WorkspaceInvitationDto | null> {
    const tokenHash = hashInvitationToken(token);
    const row =
      (await this.database
        .selectFrom("workspace_invitations")
        .selectAll()
        .where("accept_token_hash", "=", tokenHash)
        .executeTakeFirst()) ??
      (await this.database
        .selectFrom("workspace_invitations")
        .selectAll()
        .where("accept_token", "=", token)
        .executeTakeFirst()) ??
      (await this.database
        .selectFrom("workspace_invitations")
        .selectAll()
        .where("id", "=", token)
        .executeTakeFirst());

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
    role: WorkspaceRole;
    workspaceId: string;
  }): Promise<WorkspaceInvitationDto> {
    const existingPending = input.inviteeEmail
      ? await this.database
          .selectFrom("workspace_invitations")
          .selectAll()
          .where("workspace_id", "=", input.workspaceId)
          .where("project_id", "is", null)
          .where("invitee_email", "=", input.inviteeEmail)
          .where("status", "=", "pending")
          .executeTakeFirst()
      : null;

    if (existingPending) {
      return mapWorkspaceInvitationRow(existingPending);
    }

    const invitation = createWorkspaceInvitation({
      inviteeEmail: input.inviteeEmail ?? null,
      inviteeUserId: input.inviteeUserId ?? null,
      invitedByUserId: input.invitedByUserId,
      role: input.role,
      workspaceId: input.workspaceId as WorkspaceId
    });

    await this.database
      .insertInto("workspace_invitations")
      .values({
        accept_token: null,
        accept_token_hash: invitation.acceptToken ? hashInvitationToken(invitation.acceptToken) : null,
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
        send_attempt_count: 0,
        last_send_error: null,
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
          accept_token_hash: null,
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
          role: nextInvitation.projectId ? "Member" : (nextInvitation.role as WorkspaceRole),
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
      } else {
        await this.grantWorkspaceProjectVisibility(
          trx,
          nextInvitation.workspaceId,
          acceptedByUserId,
          nextInvitation.acceptedAt ?? new Date().toISOString()
        );
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
        accept_token_hash: null,
        status: invitation.status,
        updated_at: invitation.updatedAt
      })
      .where("workspace_id", "=", workspaceId)
      .where("id", "=", invitationId)
      .where("project_id", "is", null)
      .execute();
  }

  async markInvitationEmailDelivery(invitationId: string, input: { error: string | null }): Promise<void> {
    const now = new Date().toISOString();
    await this.database
      .updateTable("workspace_invitations")
      .set({
        last_send_error: input.error,
        send_attempt_count: sql`coalesce(send_attempt_count, 0) + 1`,
        status: input.error ? "delivery_failed" : "pending",
        updated_at: now
      })
      .where("id", "=", invitationId)
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
    avatarContentType?: string | null;
    avatarStorageKey?: string | null;
    avatarUrl?: string | null;
    handle?: string;
    name?: string;
    userId: string;
  }): Promise<User> {
    const currentUser = await this.findUserById(input.userId);

    if (!currentUser) {
      throw new Error(`User not found: ${input.userId}`);
    }

    return this.updateUser({
      avatarContentType: input.avatarContentType ?? currentUser.avatarContentType,
      avatarStorageKey: input.avatarStorageKey ?? currentUser.avatarStorageKey,
      avatarUrl: input.avatarUrl ?? currentUser.avatarUrl,
      email: currentUser.email,
      handle: input.handle ?? currentUser.handle,
      id: currentUser.id,
      name: input.name ?? currentUser.name
    });
  }

  async syncUserProfileFromIdentity(input: {
    avatarUrl?: string | null;
    email?: string | null;
    name?: string | null;
    userId: string;
  }): Promise<User> {
    const currentUser = await this.findUserById(input.userId);

    if (!currentUser) {
      throw new Error(`User not found: ${input.userId}`);
    }

    const shouldUpdateEmail = Boolean(input.email && (!currentUser.email || currentUser.email === input.email));
    const shouldUpdateName = Boolean(input.name && currentUser.name.trim().length === 0);
    const shouldUpdateAvatar = Boolean(input.avatarUrl && !currentUser.avatarUrl && !currentUser.avatarStorageKey);

    if (!shouldUpdateEmail && !shouldUpdateName && !shouldUpdateAvatar) {
      return currentUser;
    }

    return this.updateUser({
      avatarContentType: currentUser.avatarContentType,
      avatarStorageKey: currentUser.avatarStorageKey,
      avatarUrl: shouldUpdateAvatar ? input.avatarUrl ?? null : currentUser.avatarUrl,
      email: shouldUpdateEmail ? input.email ?? null : currentUser.email,
      handle: currentUser.handle,
      id: currentUser.id,
      name: shouldUpdateName ? input.name ?? currentUser.name : currentUser.name
    });
  }
}
