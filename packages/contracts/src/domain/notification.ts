import { z } from "zod";

export const notificationCategorySchema = z.enum([
  "invitations",
  "access",
  "assignments",
  "mentions",
  "comments"
]);

export const notificationEventTypeSchema = z.enum([
  "workspace_invitation_received",
  "workspace_invitation_accepted",
  "workspace_invitation_revoked",
  "project_invitation_received",
  "project_invitation_accepted",
  "project_invitation_revoked",
  "project_access_granted",
  "issue_assigned",
  "issue_description_mention",
  "issue_comment_mention",
  "issue_comment_assignee",
  "issue_comment_participant"
]);

export const notificationTargetKindSchema = z.enum([
  "issue",
  "description",
  "comment"
]);

export const notificationTargetSchema = z.object({
  workspaceSlug: z.string(),
  projectKey: z.string(),
  issueKey: z.string(),
  targetKind: notificationTargetKindSchema,
  commentId: z.string().optional(),
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().positive().optional()
});

export const notificationSchema = z.object({
  id: z.string(),
  recipientUserId: z.string(),
  actorUserId: z.string().nullable(),
  category: notificationCategorySchema,
  eventType: notificationEventTypeSchema,
  workspaceId: z.string().nullable(),
  projectId: z.string().nullable(),
  issueId: z.string().nullable(),
  invitationId: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  href: z.string(),
  target: notificationTargetSchema.nullable(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  seenAt: z.string().nullable(),
  readAt: z.string().nullable(),
  archivedAt: z.string().nullable()
});

export const notificationSummarySchema = z.object({
  unseenCount: z.number().int().nonnegative(),
  items: z.array(notificationSchema)
});

const notificationChannelPreferenceSchema = z.object({
  emailEnabled: z.boolean(),
  inAppEnabled: z.boolean()
});

export const notificationPreferenceSchema = z.object({
  userId: z.string(),
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  categories: z.record(notificationCategorySchema, notificationChannelPreferenceSchema),
  updatedAt: z.string()
});

export const notificationListResponseSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
  unseenCount: z.number().int().nonnegative()
});

export type NotificationCategory = z.infer<typeof notificationCategorySchema>;
export type NotificationDto = z.infer<typeof notificationSchema>;
export type NotificationEventType = z.infer<typeof notificationEventTypeSchema>;
export type NotificationListResponseDto = z.infer<typeof notificationListResponseSchema>;
export type NotificationPreferenceDto = z.infer<typeof notificationPreferenceSchema>;
export type NotificationSummaryDto = z.infer<typeof notificationSummarySchema>;
export type NotificationTargetDto = z.infer<typeof notificationTargetSchema>;
export type NotificationTargetKind = z.infer<typeof notificationTargetKindSchema>;
