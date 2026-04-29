import { createEntityId } from "@wevlo/core";
import type {
  IssueAttachmentDto,
  IssueLabelDto,
  IssueListItemDto,
  IssueMentionDto,
  IssueReactionDto,
  IssueSubscriptionStateDto,
  MyIssueItemDto,
  MyIssuesTab
} from "@wevlo/contracts";
import { sql, type DatabaseExecutor } from "@wevlo/data-access";

import type {
  CreateIssueAttachmentInput,
  CreateIssueLabelInput,
  IssueIdentity,
  IssueRepository
} from "../application/issue-repository";
import { asIssueReference, type Issue } from "../domain/issue";

type IssueRow = {
  assignee_user_id: string | null;
  created_at: string;
  description: string;
  id: string;
  issue_key: string;
  issue_number: number;
  parent_issue_id: string | null;
  priority: Issue["priority"];
  project_id: string;
  reporter_user_id: string;
  state: Issue["state"];
  title: string;
  triage_status: Issue["triageStatus"];
  due_at: string | null;
  updated_at: string;
};

type PersonalIssueContextRow = IssueRow & {
  last_activity_at: string | null;
  project_key: string;
  project_name: string;
  subscribed: boolean;
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
};

type LabelRow = {
  color: string;
  created_at: string;
  id: string;
  name: string;
  project_id: string;
  updated_at: string;
};

type AttachmentRow = {
  byte_size: number;
  checksum: string;
  content_type: string;
  created_at: string;
  file_name: string;
  id: string;
  issue_id: string;
  storage_key: string;
  uploaded_by_user_id: string;
};

type ReactionRow = {
  created_at: string;
  emoji: string;
  issue_id: string;
  user_id: string;
};

const mapIssue = (
  row: IssueRow,
  descriptionMentions: IssueMentionDto[],
  comments: Issue["comments"],
  sourceLinks: Issue["sourceLinks"],
  labels: Issue["labels"],
  attachments: Issue["attachments"],
  reactions: Issue["reactions"],
  parent: Issue["parent"],
  subIssues: Issue["subIssues"]
): Issue => ({
  assigneeUserId: row.assignee_user_id,
  attachments,
  comments,
  createdAt: row.created_at,
  description: row.description,
  descriptionMentions,
  dueDate: row.due_at,
  id: row.id,
  issueKey: row.issue_key,
  issueNumber: row.issue_number,
  parent,
  parentIssueId: row.parent_issue_id,
  priority: row.priority,
  projectId: row.project_id,
  reporterUserId: row.reporter_user_id,
  sourceLinks,
  labels,
  reactions,
  state: row.state,
  subIssues,
  title: row.title,
  triageStatus: row.triage_status,
  updatedAt: row.updated_at
});

const mapLabel = (row: LabelRow): IssueLabelDto => ({
  color: row.color,
  createdAt: row.created_at,
  id: row.id,
  name: row.name,
  projectId: row.project_id,
  updatedAt: row.updated_at
});

const mapAttachment = (row: AttachmentRow): IssueAttachmentDto & { storageKey: string } => ({
  byteSize: row.byte_size,
  checksum: row.checksum,
  contentType: row.content_type,
  createdAt: row.created_at,
  fileName: row.file_name,
  id: row.id,
  issueId: row.issue_id,
  storageKey: row.storage_key,
  uploadedByUserId: row.uploaded_by_user_id,
  url: `/attachments/${row.id}`
});

const mapIssueIdentity = (row: Pick<
  IssueRow,
  | "assignee_user_id"
  | "due_at"
  | "id"
  | "issue_key"
  | "parent_issue_id"
  | "priority"
  | "project_id"
  | "reporter_user_id"
  | "state"
  | "title"
  | "triage_status"
>): IssueIdentity => ({
  assigneeUserId: row.assignee_user_id,
  dueDate: row.due_at,
  id: row.id,
  issueKey: row.issue_key,
  parentIssueId: row.parent_issue_id,
  priority: row.priority,
  projectId: row.project_id,
  reporterUserId: row.reporter_user_id,
  state: row.state,
  title: row.title,
  triageStatus: row.triage_status
});

const buildIssueListItem = (
  row: Pick<
    IssueRow,
    | "assignee_user_id"
    | "created_at"
    | "due_at"
    | "id"
    | "issue_key"
    | "issue_number"
    | "parent_issue_id"
    | "priority"
    | "project_id"
    | "reporter_user_id"
    | "state"
    | "title"
    | "triage_status"
    | "updated_at"
  >,
  labels: IssueLabelDto[],
  sourceLinks: Issue["sourceLinks"]
): IssueListItemDto => ({
  assigneeUserId: row.assignee_user_id,
  createdAt: row.created_at,
  dueDate: row.due_at,
  id: row.id,
  issueKey: row.issue_key,
  issueNumber: row.issue_number,
  labels,
  parentIssueId: row.parent_issue_id,
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
  constructor(private readonly database: DatabaseExecutor) {}

  async addReaction(input: {
    emoji: string;
    issueId: string;
    userId: string;
  }): Promise<void> {
    await this.database
      .insertInto("issue_reactions")
      .values({
        created_at: new Date().toISOString(),
        emoji: input.emoji,
        issue_id: input.issueId,
        user_id: input.userId
      })
      .onConflict((conflict) => conflict.columns(["issue_id", "user_id", "emoji"]).doNothing())
      .execute();
  }

  async appendComment(input: {
    comment: Issue["comments"][number];
    issueId: string;
    updatedAt: string;
  }): Promise<void> {
    await this.database
      .insertInto("issue_comments")
      .values({
        author_user_id: input.comment.authorUserId,
        body: input.comment.body,
        created_at: input.comment.createdAt,
        id: input.comment.id,
        issue_id: input.issueId,
        parent_comment_id: input.comment.parentCommentId
      })
      .execute();

    if (input.comment.mentions.length > 0) {
      await this.database
        .insertInto("issue_comment_mentions")
        .values(
          input.comment.mentions.map((mention) => ({
            comment_id: input.comment.id,
            end_offset: mention.endOffset,
            mentioned_handle: mention.handle,
            mentioned_user_id: mention.userId,
            start_offset: mention.startOffset
          }))
        )
        .execute();
    }

    await this.database
      .updateTable("issues")
      .set({
        updated_at: input.updatedAt
      })
      .where("id", "=", input.issueId)
      .execute();
  }

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

  async findIssueIdentityByKey(projectId: string, issueKey: string): Promise<IssueIdentity | null> {
    const row = await this.database
      .selectFrom("issues")
      .select([
        "assignee_user_id",
        "due_at",
        "id",
        "issue_key",
        "parent_issue_id",
        "priority",
        "project_id",
        "reporter_user_id",
        "state",
        "title",
        "triage_status"
      ])
      .where("project_id", "=", projectId)
      .where("issue_key", "=", issueKey.toUpperCase())
      .executeTakeFirst();

    return row ? mapIssueIdentity(row as IssueRow) : null;
  }

  async findLabelsByIds(projectId: string, labelIds: string[]): Promise<IssueLabelDto[]> {
    if (labelIds.length === 0) {
      return [];
    }

    const rows = await this.database
      .selectFrom("project_issue_labels")
      .selectAll()
      .where("project_id", "=", projectId)
      .where("id", "in", labelIds)
      .orderBy("name", "asc")
      .execute();

    return (rows as LabelRow[]).map(mapLabel);
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

  async listIssueSummariesByProject(input: {
    projectId: string;
    scope?: "all" | "assigned" | "created";
    userId?: string;
  }): Promise<IssueListItemDto[]> {
    let query = this.database
      .selectFrom("issues")
      .select([
        "assignee_user_id",
        "created_at",
        "due_at",
        "id",
        "issue_key",
        "issue_number",
        "parent_issue_id",
        "priority",
        "project_id",
        "reporter_user_id",
        "state",
        "title",
        "triage_status",
        "updated_at"
      ])
      .where("project_id", "=", input.projectId);

    if (input.scope === "assigned" && input.userId) {
      query = query.where("assignee_user_id", "=", input.userId);
    } else if (input.scope === "created" && input.userId) {
      query = query.where("reporter_user_id", "=", input.userId);
    }

    const rows = await query.orderBy("issue_number", "asc").execute();

    if (rows.length === 0) {
      return [];
    }

    const issueIds = rows.map((row) => row.id);
    const [labelRows, sourceLinkRows] = await Promise.all([
      this.database
        .selectFrom("issue_label_assignments")
        .innerJoin("project_issue_labels", "project_issue_labels.id", "issue_label_assignments.label_id")
        .select([
          "issue_label_assignments.issue_id as issue_id",
          "project_issue_labels.id as id",
          "project_issue_labels.project_id as project_id",
          "project_issue_labels.name as name",
          "project_issue_labels.color as color",
          "project_issue_labels.created_at as created_at",
          "project_issue_labels.updated_at as updated_at"
        ])
        .where("issue_label_assignments.issue_id", "in", issueIds)
        .orderBy("project_issue_labels.name", "asc")
        .execute(),
      this.database
        .selectFrom("issue_source_links")
        .selectAll()
        .where("issue_id", "in", issueIds)
        .orderBy("created_at", "asc")
        .execute()
    ]);

    const labelsByIssueId = this.groupLabelsByIssueId(labelRows as Array<LabelRow & { issue_id: string }>);
    const sourceLinksByIssueId = this.groupSourceLinksByIssueId(sourceLinkRows);

    return rows.map((row) => buildIssueListItem(row, labelsByIssueId.get(row.id) ?? [], sourceLinksByIssueId.get(row.id) ?? []));
  }

  async listLabels(projectId: string): Promise<IssueLabelDto[]> {
    await this.ensureDefaultLabels(projectId);

    const rows = await this.database
      .selectFrom("project_issue_labels")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("name", "asc")
      .execute();

    return (rows as LabelRow[]).map(mapLabel);
  }

  async createLabel(input: CreateIssueLabelInput): Promise<IssueLabelDto> {
    await this.ensureDefaultLabels(input.projectId);

    const existing = await this.database
      .selectFrom("project_issue_labels")
      .selectAll()
      .where("project_id", "=", input.projectId)
      .where(sql`lower(name)`, "=", input.name.trim().toLowerCase())
      .executeTakeFirst();

    if (existing) {
      return mapLabel(existing as LabelRow);
    }

    const now = new Date().toISOString();
    const row: LabelRow = {
      color: input.color,
      created_at: now,
      id: createEntityId("issue_label"),
      name: input.name.trim(),
      project_id: input.projectId,
      updated_at: now
    };

    await this.database
      .insertInto("project_issue_labels")
      .values(row)
      .execute();

    return mapLabel(row);
  }

  async hasReaction(input: {
    emoji: string;
    issueId: string;
    userId: string;
  }): Promise<boolean> {
    const row = await this.database
      .selectFrom("issue_reactions")
      .select("issue_id")
      .where("emoji", "=", input.emoji)
      .where("issue_id", "=", input.issueId)
      .where("user_id", "=", input.userId)
      .executeTakeFirst();

    return Boolean(row);
  }

  async createAttachment(input: CreateIssueAttachmentInput): Promise<IssueAttachmentDto> {
    const createdAt = new Date().toISOString();

    await this.database
      .insertInto("issue_attachments")
      .values({
        byte_size: input.byteSize,
        checksum: input.checksum,
        content_type: input.contentType,
        created_at: createdAt,
        deleted_at: null,
        file_name: input.fileName,
        id: input.id,
        issue_id: input.issueId,
        storage_key: input.storageKey,
        uploaded_by_user_id: input.uploadedByUserId
      })
      .execute();

    return {
      byteSize: input.byteSize,
      checksum: input.checksum,
      contentType: input.contentType,
      createdAt,
      fileName: input.fileName,
      id: input.id,
      issueId: input.issueId,
      uploadedByUserId: input.uploadedByUserId,
      url: `/attachments/${input.id}`
    };
  }

  async findAttachment(attachmentId: string, issueId: string): Promise<(IssueAttachmentDto & { storageKey: string }) | null> {
    const row = await this.database
      .selectFrom("issue_attachments")
      .selectAll()
      .where("id", "=", attachmentId)
      .where("issue_id", "=", issueId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();

    return row ? mapAttachment(row as AttachmentRow) : null;
  }

  async deleteAttachment(attachmentId: string, issueId: string): Promise<void> {
    await this.database
      .updateTable("issue_attachments")
      .set({
        deleted_at: new Date().toISOString()
      })
      .where("id", "=", attachmentId)
      .where("issue_id", "=", issueId)
      .execute();
  }

  async removeReaction(input: {
    emoji: string;
    issueId: string;
    userId: string;
  }): Promise<void> {
    await this.database
      .deleteFrom("issue_reactions")
      .where("emoji", "=", input.emoji)
      .where("issue_id", "=", input.issueId)
      .where("user_id", "=", input.userId)
      .execute();
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
    await this.persistIssue(this.database, issue);
  }

  private async persistIssue(executor: DatabaseExecutor, issue: Issue): Promise<void> {
    await executor
        .insertInto("issues")
        .values({
          assignee_user_id: issue.assigneeUserId,
          created_at: issue.createdAt,
          description: issue.description,
          id: issue.id,
          issue_key: issue.issueKey,
          issue_number: issue.issueNumber,
          parent_issue_id: issue.parentIssueId,
          priority: issue.priority,
          project_id: issue.projectId,
          reporter_user_id: issue.reporterUserId,
          state: issue.state,
          title: issue.title,
          triage_status: issue.triageStatus,
          due_at: issue.dueDate,
          updated_at: issue.updatedAt
        })
        .onConflict((conflict) =>
          conflict.column("id").doUpdateSet({
            assignee_user_id: issue.assigneeUserId,
            description: issue.description,
            issue_key: issue.issueKey,
            issue_number: issue.issueNumber,
            parent_issue_id: issue.parentIssueId,
            priority: issue.priority,
            reporter_user_id: issue.reporterUserId,
            state: issue.state,
            title: issue.title,
            triage_status: issue.triageStatus,
            due_at: issue.dueDate,
            updated_at: issue.updatedAt
          })
        )
        .execute();

      // IMPORTANT: Delete reactions BEFORE comments because reactions reference comments via comment_id
      await executor
        .deleteFrom("issue_comment_reactions")
        .where(
          "comment_id",
          "in",
          (eb) => eb.selectFrom("issue_comments").select("id").where("issue_id", "=", issue.id)
        )
        .execute();
      
      await executor.deleteFrom("issue_comments").where("issue_id", "=", issue.id).execute();
      await executor.deleteFrom("issue_label_assignments").where("issue_id", "=", issue.id).execute();
      await executor.deleteFrom("issue_source_links").where("issue_id", "=", issue.id).execute();

      if (issue.comments.length > 0) {
        await executor
          .insertInto("issue_comments")
          .values(
            issue.comments.map((comment) => ({
              author_user_id: comment.authorUserId,
              body: comment.body,
              created_at: comment.createdAt,
              id: comment.id,
              issue_id: issue.id,
              parent_comment_id: comment.parentCommentId
            }))
          )
          .execute();
      }

      if (issue.comments.length > 0) {
        const commentReactionRows = issue.comments.flatMap((comment) =>
          comment.reactions.flatMap((reaction) =>
            reaction.userIds.map((userId) => ({
              comment_id: comment.id,
              created_at: new Date().toISOString(),
              emoji: reaction.emoji,
              user_id: userId
            }))
          )
        );

        if (commentReactionRows.length > 0) {
          await executor.insertInto("issue_comment_reactions").values(commentReactionRows).execute();
        }
      }

      if (issue.comments.length > 0) {
        const legacyCommentMentionRows = issue.comments.flatMap((comment) =>
          comment.mentions.map((mention) => ({
            comment_id: comment.id,
            end_offset: mention.endOffset,
            mentioned_handle: mention.handle,
            mentioned_user_id: mention.userId,
            start_offset: mention.startOffset
          }))
        );

        if (legacyCommentMentionRows.length > 0) {
          await executor.insertInto("issue_comment_mentions").values(legacyCommentMentionRows).execute();
        }
      }

      if (issue.sourceLinks.length > 0) {
        await executor
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

      if (issue.labels.length > 0) {
        await executor
          .insertInto("issue_label_assignments")
          .values(
            issue.labels.map((label) => ({
              created_at: issue.updatedAt,
              issue_id: issue.id,
              label_id: label.id
            }))
          )
          .execute();
      }
  }

  async getSubscriptionState(issueId: string, userId: string): Promise<IssueSubscriptionStateDto> {
    const row = await this.database
      .selectFrom("issue_subscriptions")
      .select(["is_active", "updated_at"])
      .where("issue_id", "=", issueId)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    return {
      issueId,
      subscribed: row?.is_active ?? false,
      updatedAt: row?.updated_at ?? new Date(0).toISOString()
    };
  }

  async setSubscription(input: {
    issueId: string;
    subscribed: boolean;
    userId: string;
  }): Promise<IssueSubscriptionStateDto> {
    const now = new Date().toISOString();

    await this.database
      .insertInto("issue_subscriptions")
      .values({
        created_at: now,
        is_active: input.subscribed,
        issue_id: input.issueId,
        manually_unsubscribed: !input.subscribed,
        updated_at: now,
        user_id: input.userId
      })
      .onConflict((conflict) =>
        conflict.columns(["issue_id", "user_id"]).doUpdateSet({
          is_active: input.subscribed,
          manually_unsubscribed: !input.subscribed,
          updated_at: now
        })
      )
      .execute();

    return {
      issueId: input.issueId,
      subscribed: input.subscribed,
      updatedAt: now
    };
  }

  async ensureSubscriptions(input: {
    issueId: string;
    userIds: string[];
  }): Promise<void> {
    const uniqueUserIds = [...new Set(input.userIds.filter(Boolean))];

    if (uniqueUserIds.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    await this.database
      .insertInto("issue_subscriptions")
      .values(
        uniqueUserIds.map((userId) => ({
          created_at: now,
          is_active: true,
          issue_id: input.issueId,
          manually_unsubscribed: false,
          updated_at: now,
          user_id: userId
        }))
      )
      .onConflict((conflict) =>
        conflict.columns(["issue_id", "user_id"]).doUpdateSet({
          is_active: sql<boolean>`case when issue_subscriptions.manually_unsubscribed then issue_subscriptions.is_active else true end`,
          manually_unsubscribed: sql<boolean>`case when issue_subscriptions.manually_unsubscribed then true else false end`,
          updated_at: sql<string>`case when issue_subscriptions.manually_unsubscribed then issue_subscriptions.updated_at else ${now} end`
        })
      )
      .execute();
  }

  async listPersonalIssues(input: {
    projectId?: string;
    tab: MyIssuesTab;
    userId: string;
    workspaceId?: string;
  }): Promise<MyIssueItemDto[]> {
    const rows = await this.listPersonalIssueRows(input);

    if (rows.length === 0) {
      return [];
    }

    const hydratedIssues = await this.hydrateIssues(rows);
    const issuesById = new Map(hydratedIssues.map((issue) => [issue.id, issue]));

    return rows.flatMap((row) => {
      const issue = issuesById.get(row.id);

      if (!issue) {
        return [];
      }

      return [
        {
          issue,
          lastActivityAt: row.last_activity_at,
          projectId: issue.projectId,
          projectKey: row.project_key,
          projectName: row.project_name,
          subscribed: row.subscribed,
          workspaceId: row.workspace_id,
          workspaceName: row.workspace_name,
          workspaceSlug: row.workspace_slug
        }
      ];
    });
  }

  private async hydrateIssues(rows: IssueRow[]): Promise<Issue[]> {
    if (rows.length === 0) {
      return [];
    }

    const issueIds = rows.map((row) => row.id);
    const parentIssueIds = rows
      .map((row) => row.parent_issue_id)
      .filter((issueId): issueId is string => Boolean(issueId));
    const [commentRows, commentReactionRows, mentionRows, sourceLinkRows, labelRows, attachmentRows, reactionRows, parentRows, childRows] = await Promise.all([
      this.database
        .selectFrom("issue_comments")
        .selectAll()
        .where("issue_id", "in", issueIds)
        .orderBy("created_at", "asc")
        .execute(),
      this.database
        .selectFrom("issue_comment_reactions")
        .selectAll()
        .where("comment_id", "in", (eb) => eb.selectFrom("issue_comments").select("id").where("issue_id", "in", issueIds))
        .orderBy("created_at", "asc")
        .execute(),
      this.database
        .selectFrom("issue_comment_mentions")
        .select([
          "comment_id",
          "end_offset",
          "mentioned_handle as handle",
          "mentioned_user_id as userId",
          "start_offset"
        ])
        .where("comment_id", "in", (eb) => eb.selectFrom("issue_comments").select("id").where("issue_id", "in", issueIds))
        .orderBy("start_offset", "asc")
        .execute(),

      this.database
        .selectFrom("issue_source_links")
        .selectAll()
        .where("issue_id", "in", issueIds)
        .orderBy("created_at", "asc")
        .execute(),
      this.database
        .selectFrom("issue_label_assignments")
        .innerJoin("project_issue_labels", "project_issue_labels.id", "issue_label_assignments.label_id")
        .select([
          "issue_label_assignments.issue_id as issue_id",
          "project_issue_labels.id as id",
          "project_issue_labels.project_id as project_id",
          "project_issue_labels.name as name",
          "project_issue_labels.color as color",
          "project_issue_labels.created_at as created_at",
          "project_issue_labels.updated_at as updated_at"
        ])
        .where("issue_label_assignments.issue_id", "in", issueIds)
        .orderBy("project_issue_labels.name", "asc")
        .execute(),
      this.database
        .selectFrom("issue_attachments")
        .selectAll()
        .where("issue_id", "in", issueIds)
        .where("deleted_at", "is", null)
        .orderBy("created_at", "asc")
        .execute(),
      this.database
        .selectFrom("issue_reactions")
        .selectAll()
        .where("issue_id", "in", issueIds)
        .orderBy("created_at", "asc")
        .execute(),
      parentIssueIds.length > 0
        ? this.database
            .selectFrom("issues")
            .select([
              "id",
              "issue_key",
              "title",
              "priority",
              "state",
              "assignee_user_id",
              "due_at"
            ])
            .where("id", "in", parentIssueIds)
            .execute()
        : Promise.resolve([]),
      this.database
        .selectFrom("issues")
        .select([
          "id",
          "parent_issue_id",
          "issue_key",
          "title",
          "priority",
          "state",
          "assignee_user_id",
          "due_at"
        ])
        .where("parent_issue_id", "in", issueIds)
        .orderBy("issue_number", "asc")
        .execute()
    ]);

    const commentsByIssueId = new Map<string, Issue["comments"]>();
    const descriptionMentionsByIssueId = new Map<string, IssueMentionDto[]>();
    const mentionsByCommentId = new Map<string, Issue["comments"][number]["mentions"]>();
    const reactionsByCommentId = new Map<string, IssueReactionDto[]>();
    const sourceLinksByIssueId = new Map<string, Issue["sourceLinks"]>();
    const labelsByIssueId = new Map<string, Issue["labels"]>();
    const attachmentsByIssueId = new Map<string, Issue["attachments"]>();
    const reactionsByIssueId = new Map<string, IssueReactionDto[]>();
    const parentByIssueId = new Map<string, Issue["parent"]>();
    const subIssuesByIssueId = new Map<string, Issue["subIssues"]>();

    const parentReferenceById = new Map(
      parentRows.map((row) => [
        row.id,
        asIssueReference({
          assigneeUserId: row.assignee_user_id,
          dueDate: row.due_at,
          id: row.id,
          issueKey: row.issue_key,
          priority: row.priority,
          state: row.state,
          title: row.title
        })
      ])
    );

    for (const mention of mentionRows as any[]) {
      const nextMention = {
        endOffset: mention.end_offset,
        handle: mention.handle,
        startOffset: mention.start_offset,
        userId: mention.userId
      };

      const current = mentionsByCommentId.get(mention.comment_id) ?? [];
      current.push(nextMention);
      mentionsByCommentId.set(mention.comment_id, current);
    }

    for (const reaction of commentReactionRows as Array<ReactionRow & { comment_id: string }>) {
      const current = reactionsByCommentId.get(reaction.comment_id) ?? [];
      const existing = current.find((candidate) => candidate.emoji === reaction.emoji);

      if (existing) {
        existing.count += 1;
        existing.userIds.push(reaction.user_id);
      } else {
        current.push({
          count: 1,
          emoji: reaction.emoji,
          userIds: [reaction.user_id]
        });
      }

      reactionsByCommentId.set(reaction.comment_id, current);
    }

    for (const comment of commentRows) {
      const current = commentsByIssueId.get(comment.issue_id) ?? [];
      current.push({
        authorUserId: comment.author_user_id,
        body: comment.body,
        createdAt: comment.created_at,
        id: comment.id,
        issueId: comment.issue_id,
        mentions: mentionsByCommentId.get(comment.id) ?? [],
        parentCommentId: comment.parent_comment_id,
        reactions: reactionsByCommentId.get(comment.id) ?? []
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

    for (const label of labelRows as Array<LabelRow & { issue_id: string }>) {
      const current = labelsByIssueId.get(label.issue_id) ?? [];
      current.push(mapLabel(label));
      labelsByIssueId.set(label.issue_id, current);
    }

    for (const attachment of attachmentRows as AttachmentRow[]) {
      const current = attachmentsByIssueId.get(attachment.issue_id) ?? [];
      current.push(mapAttachment(attachment));
      attachmentsByIssueId.set(attachment.issue_id, current);
    }

    for (const reaction of reactionRows as ReactionRow[]) {
      const current = reactionsByIssueId.get(reaction.issue_id) ?? [];
      const existing = current.find((candidate) => candidate.emoji === reaction.emoji);

      if (existing) {
        existing.count += 1;
        existing.userIds.push(reaction.user_id);
      } else {
        current.push({
          count: 1,
          emoji: reaction.emoji,
          userIds: [reaction.user_id]
        });
      }

      reactionsByIssueId.set(reaction.issue_id, current);
    }

    for (const row of rows) {
      parentByIssueId.set(row.id, row.parent_issue_id ? (parentReferenceById.get(row.parent_issue_id) ?? null) : null);
    }

    for (const child of childRows) {
      if (!child.parent_issue_id) {
        continue;
      }

      const current = subIssuesByIssueId.get(child.parent_issue_id) ?? [];
      current.push(
        asIssueReference({
          assigneeUserId: child.assignee_user_id,
          dueDate: child.due_at,
          id: child.id,
          issueKey: child.issue_key,
          priority: child.priority,
          state: child.state,
          title: child.title
        })
      );
      subIssuesByIssueId.set(child.parent_issue_id, current);
    }

    return rows.map((row) =>
      mapIssue(
        row,
        descriptionMentionsByIssueId.get(row.id) ?? [],
        commentsByIssueId.get(row.id) ?? [],
        sourceLinksByIssueId.get(row.id) ?? [],
        labelsByIssueId.get(row.id) ?? [],
        attachmentsByIssueId.get(row.id) ?? [],
        reactionsByIssueId.get(row.id) ?? [],
        parentByIssueId.get(row.id) ?? null,
        subIssuesByIssueId.get(row.id) ?? []
      )
    );
  }

  async ensureDefaultLabels(projectId: string): Promise<void> {
    const now = new Date().toISOString();
    const defaults = [
      { color: "red", id: `${projectId}:label:bug`, name: "Bug" },
      { color: "violet", id: `${projectId}:label:feature`, name: "Feature" },
      { color: "blue", id: `${projectId}:label:improvement`, name: "Improvement" }
    ];

    await this.database
      .insertInto("project_issue_labels")
      .values(
        defaults.map((label) => ({
          color: label.color,
          created_at: now,
          id: label.id,
          name: label.name,
          project_id: projectId,
          updated_at: now
        }))
      )
      .onConflict((conflict) => conflict.column("id").doNothing())
      .execute();
  }

  private groupLabelsByIssueId(rows: Array<LabelRow & { issue_id: string }>): Map<string, IssueLabelDto[]> {
    const labelsByIssueId = new Map<string, IssueLabelDto[]>();

    for (const label of rows) {
      const current = labelsByIssueId.get(label.issue_id) ?? [];
      current.push(mapLabel(label));
      labelsByIssueId.set(label.issue_id, current);
    }

    return labelsByIssueId;
  }

  private groupSourceLinksByIssueId(rows: Array<{
    created_at: string;
    external_id: string;
    external_key: string | null;
    external_project_id: string | null;
    external_url: string | null;
    installation_id: string | null;
    issue_id: string;
    last_synced_at: string | null;
    provider: Issue["sourceLinks"][number]["provider"];
    source_of_truth: Issue["sourceLinks"][number]["sourceOfTruth"];
  }>): Map<string, Issue["sourceLinks"]> {
    const sourceLinksByIssueId = new Map<string, Issue["sourceLinks"]>();

    for (const sourceLink of rows) {
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

    return sourceLinksByIssueId;
  }

  private async listPersonalIssueRows(input: {
    projectId?: string;
    tab: MyIssuesTab;
    userId: string;
    workspaceId?: string;
  }): Promise<PersonalIssueContextRow[]> {
    const applyFilters = <TQuery extends {
      $if: (condition: boolean, callback: (query: TQuery) => TQuery) => TQuery;
      where: (column: string, operator: "=" | "in" | "is" | "is not", value: unknown) => TQuery;
    }>(query: TQuery) =>
      query
        .$if(Boolean(input.workspaceId), (current) => current.where("projects.workspace_id", "=", input.workspaceId ?? ""))
        .$if(Boolean(input.projectId), (current) => current.where("issues.project_id", "=", input.projectId ?? ""));

    const baseSelection = [
      "issues.assignee_user_id",
      "issues.created_at",
      "issues.description",
      "issues.id",
      "issues.issue_key",
      "issues.issue_number",
      "issues.parent_issue_id",
      "issues.priority",
      "issues.project_id",
      "issues.reporter_user_id",
      "issues.state",
      "issues.title",
      "issues.triage_status",
      "issues.due_at",
      "issues.updated_at",
      "projects.project_key as project_key",
      "projects.name as project_name",
      "projects.workspace_id as workspace_id",
      "workspaces.name as workspace_name",
      "workspaces.slug as workspace_slug"
    ] as const;

    if (input.tab === "activity") {
      const activity = this.database
        .selectFrom("notifications")
        .select("issue_id")
        .select((eb) => eb.fn.max<string>("created_at").as("last_activity_at"))
        .where("recipient_user_id", "=", input.userId)
        .where("issue_id", "is not", null)
        .groupBy("issue_id")
        .as("activity");

      const rows = await applyFilters(
        this.database
          .selectFrom("issues")
          .innerJoin(activity, "activity.issue_id", "issues.id")
          .innerJoin("projects", "projects.id", "issues.project_id")
          .innerJoin("workspaces", "workspaces.id", "projects.workspace_id")
          .leftJoin("issue_subscriptions as subscriptions", (join) =>
            join
              .onRef("subscriptions.issue_id", "=", "issues.id")
              .on("subscriptions.user_id", "=", input.userId)
              .on("subscriptions.is_active", "=", true)
          )
          .select(baseSelection)
          .select([
            "activity.last_activity_at as last_activity_at",
            sql<boolean>`coalesce(subscriptions.is_active, false)`.as("subscribed")
          ])
      )
        .orderBy("activity.last_activity_at", "desc")
        .execute();

      return rows as PersonalIssueContextRow[];
    }

    let query = applyFilters(
      this.database
        .selectFrom("issues")
        .innerJoin("projects", "projects.id", "issues.project_id")
        .innerJoin("workspaces", "workspaces.id", "projects.workspace_id")
        .leftJoin("issue_subscriptions as subscriptions", (join) =>
          join
            .onRef("subscriptions.issue_id", "=", "issues.id")
            .on("subscriptions.user_id", "=", input.userId)
            .on("subscriptions.is_active", "=", true)
        )
        .select(baseSelection)
        .select([
          "issues.updated_at as last_activity_at",
          sql<boolean>`coalesce(subscriptions.is_active, false)`.as("subscribed")
        ])
    );

    switch (input.tab) {
      case "assigned":
        query = query.where("issues.assignee_user_id", "=", input.userId);
        break;
      case "created":
        query = query.where("issues.reporter_user_id", "=", input.userId);
        break;
      case "subscribed":
        query = query.where("subscriptions.user_id", "=", input.userId);
        break;
      default:
        break;
    }

    const rows = await query.orderBy("issues.updated_at", "desc").execute();
    return rows as PersonalIssueContextRow[];
  }
}
