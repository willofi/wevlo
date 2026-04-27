import type {
  IntegrationAuthType,
  IntegrationInstallationDto,
  IntegrationProjectLinkDto,
  IntegrationProvider,
  RemoteIssueCommentDto,
  RemoteIssueDto,
  SyncStatusDto,
  WebhookDeliveryDto,
  WebhookDeliveryStatus
} from "@wevlo/contracts";
import { createEntityId } from "@wevlo/core";

export type IntegrationInstallation = Omit<IntegrationInstallationDto, "hasWebhookSecret"> & {
  webhookSecret: string | null;
};

export type IntegrationProjectLink = IntegrationProjectLinkDto;

export type WebhookDelivery = WebhookDeliveryDto & {
  payload: string;
};

export type SyncCursor = {
  id: string;
  projectLinkId: string;
  cursor: string;
  updatedAt: string;
};

export type ProjectRef = {
  id: string;
  key: string;
};

export type CanonicalWebhookEvent =
  | {
      kind: "issue";
      projectLinkId?: string;
      provider: IntegrationProvider;
      remoteIssue: RemoteIssueDto;
    }
  | {
      kind: "comment";
      projectLinkId?: string;
      provider: IntegrationProvider;
      remoteIssue: RemoteIssueDto;
      comment: RemoteIssueCommentDto;
    };

export const createIntegrationInstallation = (input: {
  authType: IntegrationAuthType;
  createdByUserId: string;
  externalAccountId: string;
  externalAccountSlug?: string | undefined;
  provider: IntegrationProvider;
  webhookSecret?: string | undefined;
  workspaceId: string;
}): IntegrationInstallation => {
  const now = new Date().toISOString();

  return {
    authType: input.authType,
    createdAt: now,
    createdByUserId: input.createdByUserId,
    externalAccountId: input.externalAccountId,
    externalAccountSlug: input.externalAccountSlug?.trim() || null,
    id: createEntityId("integration_installation"),
    provider: input.provider,
    status: "active",
    updatedAt: now,
    webhookSecret: input.webhookSecret?.trim() || null,
    workspaceId: input.workspaceId
  };
};

export const createIntegrationProjectLink = (input: {
  externalProjectId: string;
  externalProjectPath: string;
  installationId: string;
  projectId: string;
  provider: IntegrationProvider;
  sourceOfTruth: IntegrationProjectLinkDto["sourceOfTruth"];
}): IntegrationProjectLink => {
  const now = new Date().toISOString();

  return {
    createdAt: now,
    externalProjectId: input.externalProjectId,
    externalProjectPath: input.externalProjectPath,
    id: createEntityId("integration_project_link"),
    installationId: input.installationId,
    lastImportedAt: null,
    lastWebhookReceivedAt: null,
    projectId: input.projectId,
    provider: input.provider,
    sourceOfTruth: input.sourceOfTruth,
    updatedAt: now
  };
};

export const createWebhookDelivery = (input: {
  eventType: string;
  installationId?: string | null;
  payload: string;
  projectLinkId?: string | null;
  provider: IntegrationProvider;
  providerDeliveryId: string;
}): WebhookDelivery => ({
  errorMessage: null,
  eventType: input.eventType,
  id: createEntityId("webhook_delivery"),
  installationId: input.installationId ?? null,
  payload: input.payload,
  processedAt: null,
  projectLinkId: input.projectLinkId ?? null,
  provider: input.provider,
  providerDeliveryId: input.providerDeliveryId,
  receivedAt: new Date().toISOString(),
  status: "pending"
});

export const markWebhookDelivery = (
  delivery: WebhookDelivery,
  status: WebhookDeliveryStatus,
  errorMessage?: string | null
): WebhookDelivery => ({
  ...delivery,
  errorMessage: errorMessage ?? null,
  processedAt: new Date().toISOString(),
  status
});

export const touchProjectLink = (
  projectLink: IntegrationProjectLink,
  input: {
    lastImportedAt?: string;
    lastWebhookReceivedAt?: string;
  }
): IntegrationProjectLink => ({
  ...projectLink,
  lastImportedAt: input.lastImportedAt ?? projectLink.lastImportedAt,
  lastWebhookReceivedAt: input.lastWebhookReceivedAt ?? projectLink.lastWebhookReceivedAt,
  updatedAt: new Date().toISOString()
});

export const buildSyncStatus = (input: {
  lastProcessedAt: string | null;
  pendingDeliveryCount: number;
  projectLink: IntegrationProjectLink;
  status: SyncStatusDto["status"];
}): SyncStatusDto => ({
  lastImportedAt: input.projectLink.lastImportedAt,
  lastProcessedAt: input.lastProcessedAt,
  lastWebhookReceivedAt: input.projectLink.lastWebhookReceivedAt,
  pendingDeliveryCount: input.pendingDeliveryCount,
  projectId: input.projectLink.projectId,
  projectLinkId: input.projectLink.id,
  provider: input.projectLink.provider,
  status: input.status
});
