import type { IntegrationProvider, SyncStatusDto } from "@wevlo/contracts";

import type {
  IntegrationInstallation,
  IntegrationProjectLink,
  ProjectRef,
  SyncCursor,
  WebhookDelivery
} from "../domain/integration";

export type IntegrationRepository = {
  countPendingDeliveriesByProjectLinkId: (projectLinkId: string) => Promise<number>;
  findInstallationByExternalAccount: (
    workspaceId: string,
    provider: IntegrationProvider,
    externalAccountId: string
  ) => Promise<IntegrationInstallation | null>;
  findInstallationById: (installationId: string) => Promise<IntegrationInstallation | null>;
  findInstallationByWebhookSecret: (
    provider: IntegrationProvider,
    webhookSecret: string
  ) => Promise<IntegrationInstallation | null>;
  findPendingDeliveries: (limit: number) => Promise<WebhookDelivery[]>;
  findProjectLinkByExternalProject: (
    provider: IntegrationProvider,
    externalProjectId: string
  ) => Promise<IntegrationProjectLink | null>;
  findProjectLinkById: (projectLinkId: string) => Promise<IntegrationProjectLink | null>;
  findProjectLinkByProjectAndProvider: (
    projectId: string,
    provider: IntegrationProvider
  ) => Promise<IntegrationProjectLink | null>;
  findProjectRef: (projectId: string) => Promise<ProjectRef | null>;
  findWebhookDeliveryByProviderDeliveryId: (
    provider: IntegrationProvider,
    providerDeliveryId: string
  ) => Promise<WebhookDelivery | null>;
  listProjectLinksByProjectId: (projectId: string) => Promise<IntegrationProjectLink[]>;
  listWorkspaceInstallations: (workspaceId: string) => Promise<IntegrationInstallation[]>;
  listProjectSyncStatuses: (projectId: string) => Promise<SyncStatusDto[]>;
  saveInstallation: (installation: IntegrationInstallation) => Promise<void>;
  saveProjectLink: (projectLink: IntegrationProjectLink) => Promise<void>;
  saveSyncCursor: (cursor: SyncCursor) => Promise<void>;
  saveWebhookDelivery: (delivery: WebhookDelivery) => Promise<void>;
};
