import type { ProjectSummaryDto } from "@wevlo/contracts";
import { normalizeProjectKey, type ProjectId, type ProjectKey, type WorkspaceId } from "@wevlo/core";
import type { Database } from "@wevlo/data-access";

import type { ProjectLookupRepository } from "../application/get-project";
import type { VisibleProjectRepository } from "../application/list-projects";
import type { ProjectRepository } from "../application/create-project";
import type { Project } from "../domain/project";

const mapProjectSummary = (row: {
  current_user_role: ProjectSummaryDto["currentUserRole"];
  id: string;
  key: string;
  name: string;
  visibility: ProjectSummaryDto["visibility"];
  workspace_id: string;
}): ProjectSummaryDto => ({
  currentUserRole: row.current_user_role,
  id: row.id,
  key: row.key,
  name: row.name,
  visibility: row.visibility,
  workspaceId: row.workspace_id
});

export class PostgresProjectRepository
  implements ProjectLookupRepository, VisibleProjectRepository, ProjectRepository
{
  constructor(private readonly database: Database) {}

  async findByKey(workspaceId: string, projectKey: string): Promise<Project | null> {
    const normalizedProjectKey = normalizeProjectKey(projectKey);
    const projectRow = await this.database
      .selectFrom("projects")
      .select([
        "created_at",
        "id",
        "name",
        "project_key",
        "updated_at",
        "visibility",
        "workspace_id"
      ])
      .where("workspace_id", "=", workspaceId)
      .where("project_key", "=", normalizedProjectKey)
      .executeTakeFirst();

    if (!projectRow) {
      return null;
    }

    const memberships = await this.database
      .selectFrom("project_memberships")
      .select(["role", "user_id"])
      .where("project_id", "=", projectRow.id)
      .execute();

    return {
      createdAt: projectRow.created_at,
      id: projectRow.id as ProjectId,
      key: projectRow.project_key as ProjectKey,
      memberships: memberships.map((membership) => ({
        role: membership.role,
        userId: membership.user_id
      })),
      name: projectRow.name,
      updatedAt: projectRow.updated_at,
      visibility: projectRow.visibility,
      workspaceId: projectRow.workspace_id as WorkspaceId
    };
  }

  async findForUserByKey(
    userId: string,
    workspaceId: string,
    projectKey: string
  ): Promise<ProjectSummaryDto | null> {
    const normalizedProjectKey = normalizeProjectKey(projectKey);
    const row = await this.database
      .selectFrom("projects")
      .innerJoin("project_memberships", "project_memberships.project_id", "projects.id")
      .select((expressionBuilder) => [
        "projects.id",
        "projects.name",
        "projects.project_key as key",
        "projects.visibility",
        "projects.workspace_id",
        expressionBuilder.ref("project_memberships.role").as("current_user_role")
      ])
      .where("projects.workspace_id", "=", workspaceId)
      .where("projects.project_key", "=", normalizedProjectKey)
      .where("project_memberships.user_id", "=", userId)
      .executeTakeFirst();

    return row ? mapProjectSummary(row) : null;
  }

  async isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    const membership = await this.database
      .selectFrom("workspace_memberships")
      .select("user_id")
      .where("workspace_id", "=", workspaceId)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    return Boolean(membership);
  }

  async listForUserInWorkspace(userId: string, workspaceId: string): Promise<ProjectSummaryDto[]> {
    const rows = await this.database
      .selectFrom("projects")
      .innerJoin("project_memberships", "project_memberships.project_id", "projects.id")
      .select((expressionBuilder) => [
        "projects.id",
        "projects.name",
        "projects.project_key as key",
        "projects.visibility",
        "projects.workspace_id",
        expressionBuilder.ref("project_memberships.role").as("current_user_role")
      ])
      .where("projects.workspace_id", "=", workspaceId)
      .where("project_memberships.user_id", "=", userId)
      .orderBy("projects.created_at", "asc")
      .execute();

    return rows.map(mapProjectSummary);
  }

  async save(project: Project): Promise<void> {
    await this.database.transaction().execute(async (trx) => {
      await trx
        .insertInto("projects")
        .values({
          created_at: project.createdAt,
          id: project.id,
          name: project.name,
          project_key: project.key,
          updated_at: project.updatedAt,
          visibility: project.visibility,
          workspace_id: project.workspaceId
        })
        .execute();

      await trx
        .insertInto("project_memberships")
        .values(
          project.memberships.map((membership) => ({
            created_at: project.createdAt,
            project_id: project.id,
            role: membership.role,
            user_id: membership.userId
          }))
        )
        .execute();
    });
  }
}
