import { normalizeWorkspaceSlug, type WorkspaceId, type WorkspaceSlug } from "@wevlo/core";
import type { Database } from "@wevlo/data-access";

import type { WorkspaceLookupRepository } from "../application/get-workspace";
import type { VisibleWorkspaceRepository } from "../application/list-workspaces";
import type { WorkspaceRepository } from "../application/create-workspace";
import type { WorkspaceMembership } from "../domain/workspace-membership";
import type { Workspace } from "../domain/workspace";

const mapWorkspace = (row: {
  created_at: string;
  id: string;
  name: string;
  slug: string;
}): Workspace => ({
  createdAt: row.created_at,
  id: row.id as WorkspaceId,
  name: row.name,
  slug: row.slug as WorkspaceSlug
});

export class PostgresWorkspaceRepository
  implements WorkspaceLookupRepository, VisibleWorkspaceRepository, WorkspaceRepository
{
  constructor(private readonly database: Database) {}

  async findBySlug(slug: string): Promise<Workspace | null> {
    const normalizedSlug = normalizeWorkspaceSlug(slug);
    const row = await this.database
      .selectFrom("workspaces")
      .selectAll()
      .where("slug", "=", normalizedSlug)
      .executeTakeFirst();

    return row ? mapWorkspace(row) : null;
  }

  async findForUserBySlug(userId: string, slug: string): Promise<Workspace | null> {
    const normalizedSlug = normalizeWorkspaceSlug(slug);
    const row = await this.database
      .selectFrom("workspaces")
      .innerJoin("workspace_memberships", "workspace_memberships.workspace_id", "workspaces.id")
      .select([
        "workspaces.created_at",
        "workspaces.id",
        "workspaces.name",
        "workspaces.slug"
      ])
      .where("workspaces.slug", "=", normalizedSlug)
      .where("workspace_memberships.user_id", "=", userId)
      .executeTakeFirst();

    return row ? mapWorkspace(row) : null;
  }

  async listForUser(userId: string): Promise<Workspace[]> {
    const rows = await this.database
      .selectFrom("workspaces")
      .innerJoin("workspace_memberships", "workspace_memberships.workspace_id", "workspaces.id")
      .select([
        "workspaces.created_at",
        "workspaces.id",
        "workspaces.name",
        "workspaces.slug"
      ])
      .where("workspace_memberships.user_id", "=", userId)
      .orderBy("workspaces.created_at", "asc")
      .execute();

    return rows.map(mapWorkspace);
  }

  async save(workspace: Workspace): Promise<void> {
    await this.database
      .insertInto("workspaces")
      .values({
        created_at: workspace.createdAt,
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug
      })
      .execute();
  }

  async saveMembership(membership: WorkspaceMembership): Promise<void> {
    await this.database
      .insertInto("workspace_memberships")
      .values({
        created_at: membership.createdAt,
        role: membership.role,
        user_id: membership.userId,
        workspace_id: membership.workspaceId
      })
      .execute();
  }
}
