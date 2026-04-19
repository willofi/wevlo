import { z } from "zod";

export const integrationProviderSchema = z.enum([
  "github",
  "gitlab"
]);

export const integrationInstallationStatusSchema = z.enum([
  "active",
  "paused"
]);

export const integrationAuthTypeSchema = z.enum([
  "app",
  "oauth",
  "token"
]);

export const webhookDeliveryStatusSchema = z.enum([
  "pending",
  "processed",
  "failed"
]);

export const remoteIssueCommentSchema = z.object({
  externalId: z.string(),
  authorId: z.string(),
  body: z.string().min(1),
  createdAt: z.string()
});

export const remoteIssueStateSchema = z.enum([
  "open",
  "closed"
]);

export const remoteIssueSchema = z.object({
  externalId: z.string(),
  externalKey: z.string().optional(),
  externalProjectId: z.string(),
  externalUrl: z.string().url().optional(),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  state: remoteIssueStateSchema,
  authorId: z.string(),
  comments: z.array(remoteIssueCommentSchema).optional().default([])
});

export const integrationInstallationSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  provider: integrationProviderSchema,
  externalAccountId: z.string(),
  externalAccountSlug: z.string().nullable(),
  authType: integrationAuthTypeSchema,
  status: integrationInstallationStatusSchema,
  hasWebhookSecret: z.boolean(),
  createdByUserId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const integrationProjectLinkSchema = z.object({
  id: z.string(),
  installationId: z.string(),
  projectId: z.string(),
  provider: integrationProviderSchema,
  externalProjectId: z.string(),
  externalProjectPath: z.string(),
  sourceOfTruth: z.enum(["remote", "shared"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastImportedAt: z.string().nullable(),
  lastWebhookReceivedAt: z.string().nullable()
});

export const webhookDeliverySchema = z.object({
  id: z.string(),
  provider: integrationProviderSchema,
  providerDeliveryId: z.string(),
  installationId: z.string().nullable(),
  projectLinkId: z.string().nullable(),
  eventType: z.string(),
  status: webhookDeliveryStatusSchema,
  receivedAt: z.string(),
  processedAt: z.string().nullable(),
  errorMessage: z.string().nullable()
});

export const syncStatusSchema = z.object({
  projectId: z.string(),
  provider: integrationProviderSchema,
  projectLinkId: z.string(),
  pendingDeliveryCount: z.number().int().nonnegative(),
  lastImportedAt: z.string().nullable(),
  lastWebhookReceivedAt: z.string().nullable(),
  lastProcessedAt: z.string().nullable(),
  status: webhookDeliveryStatusSchema
});

export type IntegrationProvider = z.infer<typeof integrationProviderSchema>;
export type IntegrationInstallationStatus = z.infer<typeof integrationInstallationStatusSchema>;
export type IntegrationAuthType = z.infer<typeof integrationAuthTypeSchema>;
export type WebhookDeliveryStatus = z.infer<typeof webhookDeliveryStatusSchema>;
export type RemoteIssueDto = z.infer<typeof remoteIssueSchema>;
export type RemoteIssueCommentDto = z.infer<typeof remoteIssueCommentSchema>;
export type IntegrationInstallationDto = z.infer<typeof integrationInstallationSchema>;
export type IntegrationProjectLinkDto = z.infer<typeof integrationProjectLinkSchema>;
export type WebhookDeliveryDto = z.infer<typeof webhookDeliverySchema>;
export type SyncStatusDto = z.infer<typeof syncStatusSchema>;
