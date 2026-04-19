import { z } from "zod";

import {
  integrationAuthTypeSchema,
  integrationProviderSchema,
  remoteIssueSchema
} from "../domain/integration";
import { issueSourceOwnershipSchema } from "../domain/issue";

export const createIntegrationInstallationRequestSchema = z.object({
  authType: integrationAuthTypeSchema,
  externalAccountId: z.string().min(1),
  externalAccountSlug: z.string().min(1).optional(),
  webhookSecret: z.string().min(1).optional()
});

export const createIntegrationProjectLinkRequestSchema = z.object({
  externalProjectId: z.string().min(1),
  externalProjectPath: z.string().min(1),
  installationId: z.string().min(1),
  sourceOfTruth: issueSourceOwnershipSchema.exclude(["local"]).optional().default("remote")
});

export const importIntegrationProjectIssuesRequestSchema = z.object({
  issues: z.array(remoteIssueSchema).default([])
});

export const integrationWebhookEnvelopeSchema = z.object({
  deliveryId: z.string(),
  eventType: z.string(),
  installationId: z.string().optional(),
  projectLinkId: z.string().optional(),
  provider: integrationProviderSchema
});

export type CreateIntegrationInstallationRequest = z.infer<typeof createIntegrationInstallationRequestSchema>;
export type CreateIntegrationProjectLinkRequest = z.infer<typeof createIntegrationProjectLinkRequestSchema>;
export type ImportIntegrationProjectIssuesRequest = z.infer<typeof importIntegrationProjectIssuesRequestSchema>;
export type IntegrationWebhookEnvelope = z.infer<typeof integrationWebhookEnvelopeSchema>;
