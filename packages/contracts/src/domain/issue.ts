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

export const issueCommentSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  authorUserId: z.string(),
  body: z.string().min(1),
  createdAt: z.string()
});

export const issueListItemSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  issueNumber: z.number().int().positive(),
  issueKey: z.string().min(3),
  title: z.string().min(1),
  priority: issuePrioritySchema,
  state: issueStateSchema,
  triageStatus: issueTriageStatusSchema,
  reporterUserId: z.string(),
  assigneeUserId: z.string().nullable(),
  sourceLinks: z.array(issueSourceLinkSchema),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const issueDetailSchema = issueListItemSchema.extend({
  description: z.string(),
  comments: z.array(issueCommentSchema)
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

export const boardIssueSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  issueKey: z.string().min(3),
  title: z.string().min(1),
  description: z.string(),
  state: issueStateSchema,
  priority: issuePrioritySchema,
  assigneeUserId: z.string().nullable(),
  updatedAt: z.string()
});

export const projectBoardColumnConfigSchema = z.object({
  state: issueStateSchema,
  label: z.string().min(1),
  order: z.number().int().nonnegative(),
  accent: projectBoardAccentSchema
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
export type IssueCommentDto = z.infer<typeof issueCommentSchema>;
export type IssueSourceLinkDto = z.infer<typeof issueSourceLinkSchema>;
export type IssueState = z.infer<typeof issueStateSchema>;
export type IssuePriority = z.infer<typeof issuePrioritySchema>;
export type IssueTriageStatus = z.infer<typeof issueTriageStatusSchema>;
export type BoardColumnDto = z.infer<typeof boardColumnSchema>;
export type ProjectBoardAccent = z.infer<typeof projectBoardAccentSchema>;
export type BoardIssueDto = z.infer<typeof boardIssueSchema>;
export type ProjectBoardColumnConfigDto = z.infer<typeof projectBoardColumnConfigSchema>;
export type ProjectBoardConfigDto = z.infer<typeof projectBoardConfigSchema>;
export type ProjectBoardViewColumnDto = z.infer<typeof projectBoardViewColumnSchema>;
export type ProjectBoardViewDto = z.infer<typeof projectBoardViewSchema>;
