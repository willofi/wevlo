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
  description: z.string().optional().default("")
});

export const updateIssueRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: issuePrioritySchema.optional(),
  assigneeUserId: z.string().nullable().optional()
});

export const transitionIssueRequestSchema = z.object({
  state: issueStateSchema
});

export const createCommentRequestSchema = z.object({
  body: z.string().min(1)
});

export type ListIssueScope = z.infer<typeof listIssueScopeSchema>;
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
export type CreateIssueRequest = z.infer<typeof createIssueRequestSchema>;
export type UpdateIssueRequest = z.infer<typeof updateIssueRequestSchema>;
export type TransitionIssueRequest = z.infer<typeof transitionIssueRequestSchema>;
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;
