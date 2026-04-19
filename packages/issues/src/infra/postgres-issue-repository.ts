import type { Database } from "@wevlo/data-access";

import type { IssueRepository } from "../application/issue-repository";
import type { Issue } from "../domain/issue";

type IssueRow = {
  assignee_user_id: string | null;
  created_at: string;
  description: string;
  id: string;
  issue_key: string;
  issue_number: number;
  priority: Issue["priority"];
  project_id: string;
  reporter_user_id: string;
  state: Issue["state"];
  title: string;
  triage_status: Issue["triageStatus"];
  updated_at: string;
};

const mapIssue = (
  row: IssueRow,
  comments: Issue["comments"],
  sourceLinks: Issue["sourceLinks"]
): Issue => ({
  assigneeUserId: row.assignee_user_id,
  comments,
  createdAt: row.created_at,
  description: row.description,
  id: row.id,
  issueKey: row.issue_key,
  issueNumber: row.issue_number,
  priority: row.priority,
  projectId: row.project_id,
  reporterUserId: row.reporter_user_id,
  sourceLinks,
  state: row.state,
  title: row.title,
  triageStatus: row.triage_status,
  updatedAt: row.updated_at
});

export class PostgresIssueRepository implements IssueRepository {
  constructor(private readonly database: Database) {}

  async findByKey(projectId: string, issueKey: string): Promise<Issue | null> {
    const row = await this.database
      .selectFrom("issues")
      .selectAll()
      .where("project_id", "=", projectId)
      .where("issue_key", "=", issueKey.toUpperCase())
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const [issue] = await this.hydrateIssues([row]);
    return issue ?? null;
  }

  async findBySourceLink(input: {
    projectId: string;
    provider: Issue["sourceLinks"][number]["provider"];
    externalId: string;
    installationId?: string;
  }): Promise<Issue | null> {
    const row = await this.database
      .selectFrom("issues")
      .innerJoin("issue_source_links", "issue_source_links.issue_id", "issues.id")
      .selectAll("issues")
      .where("issues.project_id", "=", input.projectId)
      .where("issue_source_links.provider", "=", input.provider)
      .where("issue_source_links.external_id", "=", input.externalId)
      .$if(Boolean(input.installationId), (query) =>
        query.where("issue_source_links.installation_id", "=", input.installationId ?? null)
      )
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const [issue] = await this.hydrateIssues([row]);
    return issue ?? null;
  }

  async listByProject(projectId: string): Promise<Issue[]> {
    const rows = await this.database
      .selectFrom("issues")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("issue_number", "asc")
      .execute();

    return this.hydrateIssues(rows);
  }

  async nextIssueNumber(projectId: string): Promise<number> {
    const row = await this.database
      .selectFrom("issues")
      .select((expressionBuilder) => expressionBuilder.fn.max<number>("issue_number").as("max_issue_number"))
      .where("project_id", "=", projectId)
      .executeTakeFirst();

    return Number(row?.max_issue_number ?? 0) + 1;
  }

  async save(issue: Issue): Promise<void> {
    await this.database.transaction().execute(async (trx) => {
      await trx
        .insertInto("issues")
        .values({
          assignee_user_id: issue.assigneeUserId,
          created_at: issue.createdAt,
          description: issue.description,
          id: issue.id,
          issue_key: issue.issueKey,
          issue_number: issue.issueNumber,
          priority: issue.priority,
          project_id: issue.projectId,
          reporter_user_id: issue.reporterUserId,
          state: issue.state,
          title: issue.title,
          triage_status: issue.triageStatus,
          updated_at: issue.updatedAt
        })
        .onConflict((conflict) =>
          conflict.column("id").doUpdateSet({
            assignee_user_id: issue.assigneeUserId,
            description: issue.description,
            issue_key: issue.issueKey,
            issue_number: issue.issueNumber,
            priority: issue.priority,
            reporter_user_id: issue.reporterUserId,
            state: issue.state,
            title: issue.title,
            triage_status: issue.triageStatus,
            updated_at: issue.updatedAt
          })
        )
        .execute();

      await trx.deleteFrom("issue_comments").where("issue_id", "=", issue.id).execute();
      await trx.deleteFrom("issue_source_links").where("issue_id", "=", issue.id).execute();

      if (issue.comments.length > 0) {
        await trx
          .insertInto("issue_comments")
          .values(
            issue.comments.map((comment) => ({
              author_user_id: comment.authorUserId,
              body: comment.body,
              created_at: comment.createdAt,
              id: comment.id,
              issue_id: issue.id
            }))
          )
          .execute();
      }

      if (issue.sourceLinks.length > 0) {
        await trx
          .insertInto("issue_source_links")
          .values(
            issue.sourceLinks.map((sourceLink) => ({
              created_at: issue.createdAt,
              external_id: sourceLink.externalId,
              external_key: sourceLink.externalKey ?? null,
              external_project_id: sourceLink.externalProjectId ?? null,
              external_url: sourceLink.externalUrl ?? null,
              id: `${issue.id}:${sourceLink.provider}:${sourceLink.externalId}`,
              issue_id: issue.id,
              installation_id: sourceLink.installationId ?? null,
              last_synced_at: sourceLink.lastSyncedAt ?? null,
              provider: sourceLink.provider,
              source_of_truth: sourceLink.sourceOfTruth
            }))
          )
          .execute();
      }
    });
  }

  private async hydrateIssues(rows: IssueRow[]): Promise<Issue[]> {
    if (rows.length === 0) {
      return [];
    }

    const issueIds = rows.map((row) => row.id);
    const [commentRows, sourceLinkRows] = await Promise.all([
      this.database
        .selectFrom("issue_comments")
        .selectAll()
        .where("issue_id", "in", issueIds)
        .orderBy("created_at", "asc")
        .execute(),
      this.database
        .selectFrom("issue_source_links")
        .selectAll()
        .where("issue_id", "in", issueIds)
        .orderBy("created_at", "asc")
        .execute()
    ]);

    const commentsByIssueId = new Map<string, Issue["comments"]>();
    const sourceLinksByIssueId = new Map<string, Issue["sourceLinks"]>();

    for (const comment of commentRows) {
      const current = commentsByIssueId.get(comment.issue_id) ?? [];
      current.push({
        authorUserId: comment.author_user_id,
        body: comment.body,
        createdAt: comment.created_at,
        id: comment.id,
        issueId: comment.issue_id
      });
      commentsByIssueId.set(comment.issue_id, current);
    }

    for (const sourceLink of sourceLinkRows) {
      const current = sourceLinksByIssueId.get(sourceLink.issue_id) ?? [];
      current.push({
        externalId: sourceLink.external_id,
        externalKey: sourceLink.external_key ?? undefined,
        externalProjectId: sourceLink.external_project_id ?? undefined,
        externalUrl: sourceLink.external_url ?? undefined,
        installationId: sourceLink.installation_id ?? undefined,
        lastSyncedAt: sourceLink.last_synced_at ?? undefined,
        provider: sourceLink.provider,
        sourceOfTruth: sourceLink.source_of_truth
      });
      sourceLinksByIssueId.set(sourceLink.issue_id, current);
    }

    return rows.map((row) =>
      mapIssue(row, commentsByIssueId.get(row.id) ?? [], sourceLinksByIssueId.get(row.id) ?? [])
    );
  }
}
