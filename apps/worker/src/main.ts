import { recordAuditEvent } from "@wevlo/audit-activity";
import { createDatabase, destroyDatabase } from "@wevlo/data-access";
import { createInboundEvent, PostgresIntegrationRepository, processPendingWebhookDeliveriesUseCase } from "@wevlo/integrations";
import { PostgresIssueRepository } from "@wevlo/issues";
import { deliverNotificationOutboxBatch, PostgresNotificationRepository } from "@wevlo/notifications";

const pollIntervalMs = 5_000;
const workerId = `worker:${process.pid}`;

const sleep = async (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const boot = async () => {
  const database = createDatabase();

  const integrationRepository = new PostgresIntegrationRepository(database);
  const issueRepository = new PostgresIssueRepository(database);
  const notificationRepository = new PostgresNotificationRepository(database);
  const event = createInboundEvent("github", "workspace_bootstrap", "worker.started");
  const audit = recordAuditEvent({
    actorId: "system",
    action: event.eventName,
    resourceId: event.id
  });

  console.log("[worker] started", { audit, event, workerId });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    await destroyDatabase(database);
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });

  while (!shuttingDown) {
    try {
      const [processedWebhookCount, processedNotificationCount] = await Promise.all([
        processPendingWebhookDeliveriesUseCase({
          issueRepository,
          repository: integrationRepository
        }),
        deliverNotificationOutboxBatch(notificationRepository, {
          limit: 25,
          workerId
        })
      ]);

      if (processedWebhookCount > 0 || processedNotificationCount > 0) {
        console.log("[worker] processed", {
          notifications: processedNotificationCount,
          webhooks: processedWebhookCount
        });
      }
    } catch (error) {
      console.error("[worker] iteration failed", error);
    }

    await sleep(pollIntervalMs);
  }
};

boot().catch((error) => {
  console.error("[worker] failed", error);
  process.exit(1);
});
