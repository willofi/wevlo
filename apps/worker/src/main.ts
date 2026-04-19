import { recordAuditEvent } from "@wevlo/audit-activity";
import { createDatabase, destroyDatabase, runMigrations } from "@wevlo/data-access";
import { createInboundEvent, PostgresIntegrationRepository, processPendingWebhookDeliveriesUseCase } from "@wevlo/integrations";
import { PostgresIssueRepository } from "@wevlo/issues";

const boot = async () => {
  const database = createDatabase();
  await runMigrations(database);
  const integrationRepository = new PostgresIntegrationRepository(database);
  const issueRepository = new PostgresIssueRepository(database);
  const event = createInboundEvent("github", "workspace_bootstrap", "worker.started");
  const audit = recordAuditEvent({
    actorId: "system",
    action: event.eventName,
    resourceId: event.id
  });
  const processedCount = await processPendingWebhookDeliveriesUseCase({
    issueRepository,
    repository: integrationRepository
  });

  console.log("[worker] started", { audit, event, processedCount });
  await destroyDatabase(database);
};

boot().catch((error) => {
  console.error("[worker] failed", error);
  process.exit(1);
});
