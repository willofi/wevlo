import type { SyncStatusDto } from "@wevlo/contracts";
import type { Database } from "@wevlo/data-access";

import type { IntegrationRepository } from "../application/integration-repository";
import { buildSyncStatus, type IntegrationInstallation, type IntegrationProjectLink, type ProjectRef, type SyncCursor, type WebhookDelivery } from "../domain/integration";

const mapInstallation = (row: {
  auth_type: IntegrationInstallation["authType"];
  created_at: string;
  created_by_user_id: string;
  external_account_id: string;
  external_account_slug: string | null;
  id: string;
  provider: IntegrationInstallation["provider"];
  status: IntegrationInstallation["status"];
  updated_at: string;
  webhook_secret: string | null;
  workspace_id: string;
}): IntegrationInstallation => ({
  authType: row.auth_type,
  createdAt: row.created_at,
  createdByUserId: row.created_by_user_id,
  externalAccountId: row.external_account_id,
  externalAccountSlug: row.external_account_slug,
  id: row.id,
  provider: row.provider,
  status: row.status,
  updatedAt: row.updated_at,
  webhookSecret: row.webhook_secret,
  workspaceId: row.workspace_id
});

const mapProjectLink = (row: {
  created_at: string;
  external_project_id: string;
  external_project_path: string;
  id: string;
  installation_id: string;
  last_imported_at: string | null;
  last_webhook_received_at: string | null;
  project_id: string;
  provider: IntegrationProjectLink["provider"];
  source_of_truth: IntegrationProjectLink["sourceOfTruth"];
  updated_at: string;
}): IntegrationProjectLink => ({
  createdAt: row.created_at,
  externalProjectId: row.external_project_id,
  externalProjectPath: row.external_project_path,
  id: row.id,
  installationId: row.installation_id,
  lastImportedAt: row.last_imported_at,
  lastWebhookReceivedAt: row.last_webhook_received_at,
  projectId: row.project_id,
  provider: row.provider,
  sourceOfTruth: row.source_of_truth,
  updatedAt: row.updated_at
});

const mapWebhookDelivery = (row: {
  error_message: string | null;
  event_type: string;
  id: string;
  installation_id: string | null;
  payload: string;
  processed_at: string | null;
  project_link_id: string | null;
  provider: WebhookDelivery["provider"];
  provider_delivery_id: string;
  received_at: string;
  status: WebhookDelivery["status"];
}): WebhookDelivery => ({
  errorMessage: row.error_message,
  eventType: row.event_type,
  id: row.id,
  installationId: row.installation_id,
  payload: row.payload,
  processedAt: row.processed_at,
  projectLinkId: row.project_link_id,
  provider: row.provider,
  providerDeliveryId: row.provider_delivery_id,
  receivedAt: row.received_at,
  status: row.status
});

export class PostgresIntegrationRepository implements IntegrationRepository {
  constructor(private readonly database: Database) {}

  async countPendingDeliveriesByProjectLinkId(projectLinkId: string): Promise<number> {
    const row = await this.database
      .selectFrom("webhook_deliveries")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("project_link_id", "=", projectLinkId)
      .where("status", "=", "pending")
      .executeTakeFirst();

    return Number(row?.count ?? 0);
  }

  async findInstallationByExternalAccount(
    workspaceId: string,
    provider: IntegrationInstallation["provider"],
    externalAccountId: string
  ): Promise<IntegrationInstallation | null> {
    const query = this.database
      .selectFrom("integration_installations")
      .selectAll()
      .where("provider", "=", provider)
      .where("external_account_id", "=", externalAccountId);
    const row = workspaceId
      ? await query.where("workspace_id", "=", workspaceId).executeTakeFirst()
      : await query.executeTakeFirst();

    return row ? mapInstallation(row) : null;
  }

  async findInstallationById(installationId: string): Promise<IntegrationInstallation | null> {
    const row = await this.database
      .selectFrom("integration_installations")
      .selectAll()
      .where("id", "=", installationId)
      .executeTakeFirst();

    return row ? mapInstallation(row) : null;
  }

  async findInstallationByWebhookSecret(
    provider: IntegrationInstallation["provider"],
    webhookSecret: string
  ): Promise<IntegrationInstallation | null> {
    const row = await this.database
      .selectFrom("integration_installations")
      .selectAll()
      .where("provider", "=", provider)
      .where("webhook_secret", "=", webhookSecret)
      .executeTakeFirst();

    return row ? mapInstallation(row) : null;
  }

  async findPendingDeliveries(limit: number): Promise<WebhookDelivery[]> {
    const rows = await this.database
      .selectFrom("webhook_deliveries")
      .selectAll()
      .where("status", "=", "pending")
      .orderBy("received_at", "asc")
      .limit(limit)
      .execute();

    return rows.map(mapWebhookDelivery);
  }

  async findProjectLinkByExternalProject(
    provider: IntegrationProjectLink["provider"],
    externalProjectId: string
  ): Promise<IntegrationProjectLink | null> {
    const row = await this.database
      .selectFrom("integration_project_links")
      .selectAll()
      .where("provider", "=", provider)
      .where("external_project_id", "=", externalProjectId)
      .executeTakeFirst();

    return row ? mapProjectLink(row) : null;
  }

  async findProjectLinkById(projectLinkId: string): Promise<IntegrationProjectLink | null> {
    const row = await this.database
      .selectFrom("integration_project_links")
      .selectAll()
      .where("id", "=", projectLinkId)
      .executeTakeFirst();

    return row ? mapProjectLink(row) : null;
  }

  async findProjectLinkByProjectAndProvider(
    projectId: string,
    provider: IntegrationProjectLink["provider"]
  ): Promise<IntegrationProjectLink | null> {
    const row = await this.database
      .selectFrom("integration_project_links")
      .selectAll()
      .where("project_id", "=", projectId)
      .where("provider", "=", provider)
      .executeTakeFirst();

    return row ? mapProjectLink(row) : null;
  }

  async findProjectRef(projectId: string): Promise<ProjectRef | null> {
    const row = await this.database
      .selectFrom("projects")
      .select(["id", "project_key as key"])
      .where("id", "=", projectId)
      .executeTakeFirst();

    return row ?? null;
  }

  async findWebhookDeliveryByProviderDeliveryId(
    provider: WebhookDelivery["provider"],
    providerDeliveryId: string
  ): Promise<WebhookDelivery | null> {
    const row = await this.database
      .selectFrom("webhook_deliveries")
      .selectAll()
      .where("provider", "=", provider)
      .where("provider_delivery_id", "=", providerDeliveryId)
      .executeTakeFirst();

    return row ? mapWebhookDelivery(row) : null;
  }

  async listProjectLinksByProjectId(projectId: string): Promise<IntegrationProjectLink[]> {
    const rows = await this.database
      .selectFrom("integration_project_links")
      .selectAll()
      .where("project_id", "=", projectId)
      .orderBy("created_at", "asc")
      .execute();

    return rows.map(mapProjectLink);
  }

  async listWorkspaceInstallations(workspaceId: string): Promise<IntegrationInstallation[]> {
    const rows = await this.database
      .selectFrom("integration_installations")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .orderBy("created_at", "asc")
      .execute();

    return rows.map(mapInstallation);
  }

  async listProjectSyncStatuses(projectId: string): Promise<SyncStatusDto[]> {
    const projectLinks = await this.listProjectLinksByProjectId(projectId);
    const statuses: SyncStatusDto[] = [];

    for (const projectLink of projectLinks) {
      const pendingDeliveryCount = await this.countPendingDeliveriesByProjectLinkId(projectLink.id);
      const lastDelivery = await this.database
        .selectFrom("webhook_deliveries")
        .select(["processed_at", "status"])
        .where("project_link_id", "=", projectLink.id)
        .orderBy("received_at", "desc")
        .executeTakeFirst();

      statuses.push(
        buildSyncStatus({
          lastProcessedAt: lastDelivery?.processed_at ?? null,
          pendingDeliveryCount,
          projectLink,
          status: (lastDelivery?.status ?? (pendingDeliveryCount > 0 ? "pending" : "processed")) as SyncStatusDto["status"]
        })
      );
    }

    return statuses;
  }

  async saveInstallation(installation: IntegrationInstallation): Promise<void> {
    await this.database
      .insertInto("integration_installations")
      .values({
        auth_type: installation.authType,
        created_at: installation.createdAt,
        created_by_user_id: installation.createdByUserId,
        external_account_id: installation.externalAccountId,
        external_account_slug: installation.externalAccountSlug,
        id: installation.id,
        provider: installation.provider,
        status: installation.status,
        updated_at: installation.updatedAt,
        webhook_secret: installation.webhookSecret,
        workspace_id: installation.workspaceId
      })
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          auth_type: installation.authType,
          external_account_id: installation.externalAccountId,
          external_account_slug: installation.externalAccountSlug,
          provider: installation.provider,
          status: installation.status,
          updated_at: installation.updatedAt,
          webhook_secret: installation.webhookSecret
        })
      )
      .execute();
  }

  async saveProjectLink(projectLink: IntegrationProjectLink): Promise<void> {
    await this.database
      .insertInto("integration_project_links")
      .values({
        created_at: projectLink.createdAt,
        external_project_id: projectLink.externalProjectId,
        external_project_path: projectLink.externalProjectPath,
        id: projectLink.id,
        installation_id: projectLink.installationId,
        last_imported_at: projectLink.lastImportedAt,
        last_webhook_received_at: projectLink.lastWebhookReceivedAt,
        project_id: projectLink.projectId,
        provider: projectLink.provider,
        source_of_truth: projectLink.sourceOfTruth,
        updated_at: projectLink.updatedAt
      })
      .onConflict((conflict) =>
        conflict.column("id").doUpdateSet({
          external_project_id: projectLink.externalProjectId,
          external_project_path: projectLink.externalProjectPath,
          installation_id: projectLink.installationId,
          last_imported_at: projectLink.lastImportedAt,
          last_webhook_received_at: projectLink.lastWebhookReceivedAt,
          provider: projectLink.provider,
          source_of_truth: projectLink.sourceOfTruth,
          updated_at: projectLink.updatedAt
        })
      )
      .execute();
  }

  async saveSyncCursor(cursor: SyncCursor): Promise<void> {
    await this.database
      .insertInto("sync_cursors")
      .values({
        cursor: cursor.cursor,
        id: cursor.id,
        project_link_id: cursor.projectLinkId,
        updated_at: cursor.updatedAt
      })
      .onConflict((conflict) =>
        conflict.column("project_link_id").doUpdateSet({
          cursor: cursor.cursor,
          updated_at: cursor.updatedAt
        })
      )
      .execute();
  }

  async saveWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
    await this.database
      .insertInto("webhook_deliveries")
      .values({
        error_message: delivery.errorMessage,
        event_type: delivery.eventType,
        id: delivery.id,
        installation_id: delivery.installationId,
        payload: delivery.payload,
        processed_at: delivery.processedAt,
        project_link_id: delivery.projectLinkId,
        provider: delivery.provider,
        provider_delivery_id: delivery.providerDeliveryId,
        received_at: delivery.receivedAt,
        status: delivery.status
      })
      .onConflict((conflict) =>
        conflict.columns(["provider", "provider_delivery_id"]).doUpdateSet({
          error_message: delivery.errorMessage,
          event_type: delivery.eventType,
          installation_id: delivery.installationId,
          payload: delivery.payload,
          processed_at: delivery.processedAt,
          project_link_id: delivery.projectLinkId,
          status: delivery.status
        })
      )
      .execute();
  }
}
