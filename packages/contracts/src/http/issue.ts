import { z } from "zod";

import { issuePrioritySchema, issueStateSchema } from "../domain/issue";

export const listIssueScopeSchema = z.enum([
  "all",
  "assigned",
  "created"
]);

export const listIssuesQuerySchema = z.object({
  scope: listIssueScopeSchema.optional()
});

export const createIssueRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  targetProjectKey: z.string().optional(),
  parentIssueKey: z.string().nullable().optional(),
  state: issueStateSchema.optional(),
  priority: issuePrioritySchema.optional(),
  assigneeUserId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  dueDate: z.string().nullable().optional()
});

export const updateIssueRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: issuePrioritySchema.optional(),
  assigneeUserId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  dueDate: z.string().nullable().optional()
});

export const transitionIssueRequestSchema = z.object({
  state: issueStateSchema
});

export const createCommentRequestSchema = z.object({
  body: z.string().min(1),
  parentCommentId: z.string().nullable().optional()
});

export const updateIssueReactionRequestSchema = z.object({
  active: z.boolean().optional(),
  emoji: z.string().min(1).max(32)
});

export const createIssueLabelRequestSchema = z.object({
  color: z.string().min(1).optional(),
  name: z.string().min(1)
});

export const issueActivityItemSchema = z.object({
  actorUserId: z.string(),
  createdAt: z.string(),
  id: z.string(),
  summary: z.string().min(1)
});

export const workspaceSearchScopeSchema = z.enum([
  "all",
  "issues",
  "projects",
  "documents"
]);

export const workspaceSearchQuerySchema = z.object({
  q: z.string().optional().default(""),
  scope: workspaceSearchScopeSchema.optional().default("all")
});

export const workspaceSearchIssueItemSchema = z.object({
  id: z.string(),
  issueKey: z.string().min(1),
  title: z.string().min(1),
  projectId: z.string(),
  projectKey: z.string().min(1),
  priority: issuePrioritySchema,
  state: issueStateSchema,
  updatedAt: z.string()
});

export const workspaceSearchProjectItemSchema = z.object({
  id: z.string(),
  key: z.string().min(1),
  name: z.string().min(1),
  workspaceId: z.string()
});

export const workspaceSearchDocumentItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1)
});

export const workspaceSearchResponseSchema = z.object({
  documents: z.array(workspaceSearchDocumentItemSchema),
  issues: z.array(workspaceSearchIssueItemSchema),
  projects: z.array(workspaceSearchProjectItemSchema)
});

export type ListIssueScope = z.infer<typeof listIssueScopeSchema>;
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
export type CreateIssueRequest = z.infer<typeof createIssueRequestSchema>;
export type UpdateIssueRequest = z.infer<typeof updateIssueRequestSchema>;
export type TransitionIssueRequest = z.infer<typeof transitionIssueRequestSchema>;
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;
export type UpdateIssueReactionRequest = z.infer<typeof updateIssueReactionRequestSchema>;
export type CreateIssueLabelRequest = z.infer<typeof createIssueLabelRequestSchema>;
export type IssueActivityItemDto = z.infer<typeof issueActivityItemSchema>;
export type WorkspaceSearchScope = z.infer<typeof workspaceSearchScopeSchema>;
export type WorkspaceSearchQuery = z.infer<typeof workspaceSearchQuerySchema>;
export type WorkspaceSearchIssueItemDto = z.infer<typeof workspaceSearchIssueItemSchema>;
export type WorkspaceSearchProjectItemDto = z.infer<typeof workspaceSearchProjectItemSchema>;
export type WorkspaceSearchDocumentItemDto = z.infer<typeof workspaceSearchDocumentItemSchema>;
export type WorkspaceSearchResponseDto = z.infer<typeof workspaceSearchResponseSchema>;
