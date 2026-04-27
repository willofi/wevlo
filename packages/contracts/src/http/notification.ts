import { z } from "zod";

import { notificationCategorySchema, notificationPreferenceSchema } from "../domain/notification";
import { userSchema } from "../domain/user";

export const notificationListStatusSchema = z.enum([
  "all",
  "unread",
  "archived"
]);

export const notificationListQuerySchema = z.object({
  category: notificationCategorySchema.optional(),
  projectId: z.string().optional(),
  status: notificationListStatusSchema.optional().default("all"),
  workspaceId: z.string().optional()
});

export const notificationIdsRequestSchema = z.object({
  ids: z.array(z.string()).min(1)
});

export const updateNotificationPreferencesRequestSchema = notificationPreferenceSchema.pick({
  categories: true,
  emailEnabled: true,
  inAppEnabled: true
});

export const handleAvailabilityQuerySchema = z.object({
  handle: userSchema.shape.handle
});

export const handleAvailabilitySchema = z.object({
  available: z.boolean(),
  handle: userSchema.shape.handle
});

export const updateProfileRequestSchema = z
  .object({
    handle: userSchema.shape.handle.optional(),
    name: userSchema.shape.name.optional()
  })
  .refine((value) => value.handle !== undefined || value.name !== undefined, {
    message: "name or handle is required"
  });

export type HandleAvailabilityDto = z.infer<typeof handleAvailabilitySchema>;
export type HandleAvailabilityQuery = z.infer<typeof handleAvailabilityQuerySchema>;
export type NotificationIdsRequest = z.infer<typeof notificationIdsRequestSchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationListStatus = z.infer<typeof notificationListStatusSchema>;
export type UpdateNotificationPreferencesRequest = z.infer<typeof updateNotificationPreferencesRequestSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
