import type { ProjectBoardConfigDto, ProjectBoardIconKey } from "@wevlo/contracts";
import type { Database } from "@wevlo/data-access";

export class PostgresProjectBoardConfigRepository {
  constructor(private readonly database: Database) {}

  async findByProjectId(projectId: string): Promise<ProjectBoardConfigDto | null> {
    const rows = await this.database
      .selectFrom("project_board_columns")
      .select(["accent", "column_order", "icon_key", "label", "project_id", "state"])
      .where("project_id", "=", projectId)
      .orderBy("column_order", "asc")
      .execute();

    if (rows.length === 0) {
      return null;
    }

    return {
      projectId,
      columns: rows.map((row) => ({
        state: row.state,
        label: row.label,
        order: row.column_order,
        accent: row.accent,
        iconKey: row.icon_key as ProjectBoardIconKey
      }))
    };
  }

  async save(config: ProjectBoardConfigDto): Promise<ProjectBoardConfigDto> {
    const now = new Date().toISOString();

    await this.database.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("project_board_columns")
        .where("project_id", "=", config.projectId)
        .execute();

      await trx
        .insertInto("project_board_columns")
        .values(
          config.columns.map((column) => ({
            project_id: config.projectId,
            state: column.state,
            label: column.label,
            column_order: column.order,
            accent: column.accent,
            icon_key: column.iconKey,
            created_at: now,
            updated_at: now
          }))
        )
        .execute();
    });

    return config;
  }
}
