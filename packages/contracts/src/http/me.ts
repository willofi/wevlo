import { z } from "zod";

import { issueDetailSchema, issueSubscriptionStateSchema } from "../domain/issue";
import { projectMemberSchema, workspaceMemberSchema } from "../domain/member";
import { userSchema } from "../domain/user";

export const meSchema = z.object({
  user: userSchema,
  workspaceMemberships: z.array(workspaceMemberSchema),
  projectMemberships: z.array(projectMemberSchema)
});

export const myIssuesTabSchema = z.enum([
  "assigned",
  "created",
  "subscribed",
  "activity"
]);

export const myIssuesQuerySchema = z
  .object({
    projectKey: z.string().optional(),
    tab: myIssuesTabSchema.optional().default("assigned"),
    workspaceSlug: z.string().optional()
  })
  .refine((value) => value.projectKey === undefined || value.workspaceSlug !== undefined, {
    message: "workspaceSlug is required when projectKey is provided"
  });

export const myIssueItemSchema = z.object({
  issue: issueDetailSchema,
  lastActivityAt: z.string().nullable(),
  projectId: z.string(),
  projectKey: z.string(),
  projectName: z.string(),
  subscribed: z.boolean(),
  workspaceId: z.string(),
  workspaceName: z.string(),
  workspaceSlug: z.string()
});

export const myIssuesResponseSchema = z.object({
  items: z.array(myIssueItemSchema)
});

export const updateIssueSubscriptionRequestSchema = z.object({
  subscribed: z.boolean()
});

export const issueSubscriptionResponseSchema = issueSubscriptionStateSchema;

export type MeDto = z.infer<typeof meSchema>;
export type MyIssueItemDto = z.infer<typeof myIssueItemSchema>;
export type MyIssuesQuery = z.infer<typeof myIssuesQuerySchema>;
export type MyIssuesResponseDto = z.infer<typeof myIssuesResponseSchema>;
export type MyIssuesTab = z.infer<typeof myIssuesTabSchema>;
export type UpdateIssueSubscriptionRequest = z.infer<typeof updateIssueSubscriptionRequestSchema>;
