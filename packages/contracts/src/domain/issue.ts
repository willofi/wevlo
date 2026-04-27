import { z } from "zod";

export const issueStateSchema = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "done",
  "canceled"
]);

export const issueSourceOwnershipSchema = z.enum([
  "local",
  "remote",
  "shared"
]);

export const issuePrioritySchema = z.enum([
  "none",
  "low",
  "medium",
  "high",
  "urgent"
]);

export const issueLabelSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string().min(1),
  color: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const issueAttachmentSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  uploadedByUserId: z.string(),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  checksum: z.string().min(1),
  url: z.string().min(1),
  createdAt: z.string()
});

export const issueReactionSchema = z.object({
  count: z.number().int().nonnegative(),
  emoji: z.string().min(1),
  userIds: z.array(z.string())
});

export const issueTriageStatusSchema = z.enum([
  "pending",
  "accepted"
]);

export const issueSourceLinkSchema = z.object({
  provider: z.enum(["github", "gitlab", "native"]),
  externalId: z.string(),
  sourceOfTruth: issueSourceOwnershipSchema,
  installationId: z.string().optional(),
  externalProjectId: z.string().optional(),
  externalKey: z.string().optional(),
  externalUrl: z.string().url().optional(),
  lastSyncedAt: z.string().optional()
});

export const issueReferenceSchema = z.object({
  id: z.string(),
  issueKey: z.string().min(3),
  title: z.string().min(1),
  priority: issuePrioritySchema,
  state: issueStateSchema,
  assigneeUserId: z.string().nullable(),
  dueDate: z.string().nullable()
});

export const issueListItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  parentIssueId: z.string().nullable(),
  issueNumber: z.number().int().positive(),
  issueKey: z.string().min(3),
  title: z.string().min(1),
  priority: issuePrioritySchema,
  state: issueStateSchema,
  triageStatus: issueTriageStatusSchema,
  reporterUserId: z.string(),
  assigneeUserId: z.string().nullable(),
  dueDate: z.string().nullable(),
  labels: z.array(issueLabelSchema),
  sourceLinks: z.array(issueSourceLinkSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const issueMentionSchema = z.object({
  userId: z.string(),
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive()
});

export const issueCommentSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  authorUserId: z.string(),
  body: z.string().min(1),
  mentions: z.array(issueMentionSchema),
  parentCommentId: z.string().nullable().default(null),
  reactions: z.array(issueReactionSchema).default([]),
  createdAt: z.string()
});

export const issueSubscriptionStateSchema = z.object({
  issueId: z.string(),
  subscribed: z.boolean(),
  updatedAt: z.string()
});

export const issueDetailSchema = issueListItemSchema.extend({
  description: z.string(),
  descriptionMentions: z.array(issueMentionSchema).default([]),
  attachments: z.array(issueAttachmentSchema),
  comments: z.array(issueCommentSchema),
  reactions: z.array(issueReactionSchema).default([]),
  parent: issueReferenceSchema.nullable().default(null),
  subIssues: z.array(issueReferenceSchema).default([])
});

export const boardColumnSchema = z.object({
  state: issueStateSchema,
  issues: z.array(issueListItemSchema)
});

export const projectBoardAccentSchema = z.enum([
  "slate",
  "blue",
  "amber",
  "teal",
  "rose"
]);

export const projectBoardIconKeySchema = z.enum([
  "circle_dashed",
  "list_todo",
  "loader_circle",
  "check_circle_2",
  "ban",
  "clock_3",
  "sparkles",
  "rocket",
  "flag",
  "bolt"
]);

export const boardIssueSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  issueKey: z.string().min(3),
  title: z.string().min(1),
  description: z.string(),
  state: issueStateSchema,
  priority: issuePrioritySchema,
  assigneeUserId: z.string().nullable(),
  dueDate: z.string().nullable(),
  labels: z.array(issueLabelSchema),
  updatedAt: z.string()
});

export const projectBoardColumnConfigSchema = z.object({
  state: issueStateSchema,
  label: z.string().min(1),
  order: z.number().int().nonnegative(),
  accent: projectBoardAccentSchema,
  iconKey: projectBoardIconKeySchema
});

export const projectBoardConfigSchema = z.object({
  projectId: z.string(),
  columns: z.array(projectBoardColumnConfigSchema)
});

export const projectBoardViewColumnSchema = projectBoardColumnConfigSchema.extend({
  issues: z.array(boardIssueSchema)
});

export const projectBoardViewSchema = z.object({
  projectId: z.string(),
  columns: z.array(projectBoardViewColumnSchema)
});

export type IssueListItemDto = z.infer<typeof issueListItemSchema>;
export type IssueDetailDto = z.infer<typeof issueDetailSchema>;
export type IssueReferenceDto = z.infer<typeof issueReferenceSchema>;
export type IssueCommentDto = z.infer<typeof issueCommentSchema>;
export type IssueLabelDto = z.infer<typeof issueLabelSchema>;
export type IssueAttachmentDto = z.infer<typeof issueAttachmentSchema>;
export type IssueReactionDto = z.infer<typeof issueReactionSchema>;
export type IssueMentionDto = z.infer<typeof issueMentionSchema>;
export type IssueSubscriptionStateDto = z.infer<typeof issueSubscriptionStateSchema>;
export type IssueSourceLinkDto = z.infer<typeof issueSourceLinkSchema>;
export type IssueState = z.infer<typeof issueStateSchema>;
export type IssuePriority = z.infer<typeof issuePrioritySchema>;
export type IssueTriageStatus = z.infer<typeof issueTriageStatusSchema>;
export type BoardColumnDto = z.infer<typeof boardColumnSchema>;
export type ProjectBoardAccent = z.infer<typeof projectBoardAccentSchema>;
export type ProjectBoardIconKey = z.infer<typeof projectBoardIconKeySchema>;
export type BoardIssueDto = z.infer<typeof boardIssueSchema>;
export type ProjectBoardColumnConfigDto = z.infer<typeof projectBoardColumnConfigSchema>;
export type ProjectBoardConfigDto = z.infer<typeof projectBoardConfigSchema>;
export type ProjectBoardViewColumnDto = z.infer<typeof projectBoardViewColumnSchema>;
export type ProjectBoardViewDto = z.infer<typeof projectBoardViewSchema>;
