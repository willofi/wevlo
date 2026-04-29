import type {
  NotificationCategory,
  NotificationDto,
  NotificationEventType,
  NotificationListResponseDto,
  NotificationListStatus,
  NotificationPreferenceDto,
  NotificationSummaryDto,
  NotificationTargetDto,
  UpdateNotificationPreferencesRequest
} from "@wevlo/contracts";
import { notificationCategorySchema } from "@wevlo/contracts";
import { sql, type DatabaseExecutor } from "@wevlo/data-access";
import { createEntityId } from "@wevlo/core";

type NotificationDeliveryPlan = {
  body: string;
  category: NotificationCategory;
  dedupeKey: string;
  eventType: NotificationEventType;
  href: string;
  invitationId?: string | null;
  issueId?: string | null;
  mandatory?: boolean;
  payload?: Record<string, unknown>;
  projectId?: string | null;
  recipientUserId: string;
  target?: NotificationTargetDto | null;
  title: string;
  workspaceId?: string | null;
};

type NotificationOutboxPayload = {
  deliveries: NotificationDeliveryPlan[];
};

type NotificationOutboxEnvelope = {
  actorUserId: string | null;
  aggregateId: string;
  aggregateType: string;
  availableAt?: string;
  eventType: NotificationEventType;
  invitationId?: string | null;
  issueId?: string | null;
  payload: NotificationOutboxPayload;
  projectId?: string | null;
  workspaceId?: string | null;
};

type NotificationOutboxRow = {
  actor_user_id: string | null;
  aggregate_id: string;
  aggregate_type: string;
  attempt_count: number;
  available_at: string;
  created_at: string;
  event_type: NotificationEventType;
  id: string;
  invitation_id: string | null;
  issue_id: string | null;
  last_error: string | null;
  locked_at: string | null;
  locked_by: string | null;
  payload_json: string;
  processed_at: string | null;
  project_id: string | null;
  status: "failed" | "pending" | "processed" | "processing";
  workspace_id: string | null;
};

type CategoryPreference = NotificationPreferenceDto["categories"][NotificationCategory];

const notificationCategories = notificationCategorySchema.options;

const defaultCategoryPreference: CategoryPreference = {
  emailEnabled: false,
  inAppEnabled: true
};

const parseJson = <TValue>(value: string): TValue => JSON.parse(value) as TValue;

const parseNotificationPayload = (value: string): {
  payload: Record<string, unknown>;
  target: NotificationTargetDto | null;
} => {
  const parsed = parseJson<Record<string, unknown>>(value);
  const target = parsed.target;

  if (target && typeof target === "object") {
    const { target: _target, ...payload } = parsed;

    return {
      payload,
      target: target as NotificationTargetDto
    };
  }

  return {
    payload: parsed,
    target: null
  };
};

const defaultCategoryPreferences = (): NotificationPreferenceDto["categories"] =>
  Object.fromEntries(
    notificationCategories.map((category) => [category, { ...defaultCategoryPreference }])
  ) as NotificationPreferenceDto["categories"];

export const createDefaultNotificationPreference = (userId: string): NotificationPreferenceDto => ({
  categories: defaultCategoryPreferences(),
  emailEnabled: false,
  inAppEnabled: true,
  updatedAt: new Date(0).toISOString(),
  userId
});

const toNotificationDto = (row: {
  actor_user_id: string | null;
  archived_at: string | null;
  body: string;
  category: NotificationCategory;
  created_at: string;
  event_type: NotificationEventType;
  href: string;
  id: string;
  invitation_id: string | null;
  issue_id: string | null;
  payload_json: string;
  project_id: string | null;
  read_at: string | null;
  recipient_user_id: string;
  seen_at: string | null;
  title: string;
  workspace_id: string | null;
}): NotificationDto => {
  const parsed = parseNotificationPayload(row.payload_json);

  return {
    actorUserId: row.actor_user_id,
    archivedAt: row.archived_at,
    body: row.body,
    category: row.category,
    createdAt: row.created_at,
    eventType: row.event_type,
    href: row.href,
    id: row.id,
    invitationId: row.invitation_id,
    issueId: row.issue_id,
    payload: parsed.payload,
    projectId: row.project_id,
    readAt: row.read_at,
    recipientUserId: row.recipient_user_id,
    seenAt: row.seen_at,
    target: parsed.target,
    title: row.title,
    workspaceId: row.workspace_id
  };
};

const shouldDeliverInApp = (
  preferences: NotificationPreferenceDto,
  category: NotificationCategory,
  mandatory: boolean
): boolean => {
  if (mandatory) {
    return true;
  }

  return preferences.inAppEnabled && preferences.categories[category].inAppEnabled;
};

const notificationSelectColumns = [
  "actor_user_id",
  "archived_at",
  "body",
  "category",
  "created_at",
  "event_type",
  "href",
  "id",
  "invitation_id",
  "issue_id",
  "payload_json",
  "project_id",
  "read_at",
  "recipient_user_id",
  "seen_at",
  "title",
  "workspace_id"
] as const;

export class PostgresNotificationRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async enqueueEvent(input: NotificationOutboxEnvelope): Promise<string> {
    const id = createEntityId("notification_outbox");
    const createdAt = new Date().toISOString();

    await this.database
      .insertInto("notification_outbox")
      .values({
        actor_user_id: input.actorUserId,
        aggregate_id: input.aggregateId,
        aggregate_type: input.aggregateType,
        attempt_count: 0,
        available_at: input.availableAt ?? createdAt,
        created_at: createdAt,
        event_type: input.eventType,
        id,
        invitation_id: input.invitationId ?? null,
        issue_id: input.issueId ?? null,
        last_error: null,
        locked_at: null,
        locked_by: null,
        payload_json: JSON.stringify(input.payload),
        processed_at: null,
        project_id: input.projectId ?? null,
        status: "pending",
        workspace_id: input.workspaceId ?? null
      })
      .execute();

    return id;
  }

  async getPreferences(userId: string): Promise<NotificationPreferenceDto> {
    const [baseRow, categoryRows] = await Promise.all([
      this.database
        .selectFrom("notification_preferences")
        .selectAll()
        .where("user_id", "=", userId)
        .executeTakeFirst(),
      this.database
        .selectFrom("notification_category_preferences")
        .selectAll()
        .where("user_id", "=", userId)
        .execute()
    ]);

    const preference = createDefaultNotificationPreference(userId);

    if (baseRow) {
      preference.inAppEnabled = baseRow.in_app_enabled;
      preference.emailEnabled = baseRow.email_enabled;
      preference.updatedAt = baseRow.updated_at;
    }

    for (const row of categoryRows) {
      preference.categories[row.category] = {
        emailEnabled: row.email_enabled,
        inAppEnabled: row.in_app_enabled
      };

      if (!baseRow || row.updated_at > preference.updatedAt) {
        preference.updatedAt = row.updated_at;
      }
    }

    return preference;
  }

  async savePreferences(
    userId: string,
    input: UpdateNotificationPreferencesRequest
  ): Promise<NotificationPreferenceDto> {
    const updatedAt = new Date().toISOString();

    await this.database
      .insertInto("notification_preferences")
      .values({
        email_enabled: input.emailEnabled,
        in_app_enabled: input.inAppEnabled,
        updated_at: updatedAt,
        user_id: userId
      })
      .onConflict((conflict) =>
        conflict.column("user_id").doUpdateSet({
          email_enabled: input.emailEnabled,
          in_app_enabled: input.inAppEnabled,
          updated_at: updatedAt
        })
      )
      .execute();

    for (const category of notificationCategories) {
      const categoryPreference = input.categories[category];

      await this.database
        .insertInto("notification_category_preferences")
        .values({
          category,
          email_enabled: categoryPreference.emailEnabled,
          in_app_enabled: categoryPreference.inAppEnabled,
          updated_at: updatedAt,
          user_id: userId
        })
        .onConflict((conflict) =>
          conflict.columns(["user_id", "category"]).doUpdateSet({
            email_enabled: categoryPreference.emailEnabled,
            in_app_enabled: categoryPreference.inAppEnabled,
            updated_at: updatedAt
          })
        )
        .execute();
    }

    return this.getPreferences(userId);
  }

  async listSummary(userId: string, limit = 5): Promise<NotificationSummaryDto> {
    const [items, unseenCount] = await Promise.all([
      this.database
        .selectFrom("notifications")
        .select(notificationSelectColumns)
        .where("recipient_user_id", "=", userId)
        .where("archived_at", "is", null)
        .orderBy("created_at", "desc")
        .limit(limit)
        .execute(),
      this.countUnseen(userId)
    ]);

    return {
      items: items.map(toNotificationDto),
      unseenCount
    };
  }

  async listNotifications(input: {
    category?: NotificationCategory;
    projectId?: string;
    status: NotificationListStatus;
    userId: string;
    workspaceId?: string;
  }): Promise<NotificationListResponseDto> {
    let query = this.database
      .selectFrom("notifications")
      .select(notificationSelectColumns)
      .where("recipient_user_id", "=", input.userId);

    if (input.status === "archived") {
      query = query.where("archived_at", "is not", null);
    } else {
      query = query.where("archived_at", "is", null);

      if (input.status === "unread") {
        query = query.where("read_at", "is", null);
      }
    }

    if (input.category) {
      query = query.where("category", "=", input.category);
    }

    if (input.workspaceId) {
      query = query.where("workspace_id", "=", input.workspaceId);
    }

    if (input.projectId) {
      query = query.where("project_id", "=", input.projectId);
    }

    const [items, unreadCount, unseenCount] = await Promise.all([
      query.orderBy("created_at", "desc").execute(),
      this.countUnread(input.userId),
      this.countUnseen(input.userId)
    ]);

    return {
      items: items.map(toNotificationDto),
      unreadCount,
      unseenCount
    };
  }

  async markSeen(userId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const now = new Date().toISOString();

    await this.database
      .updateTable("notifications")
      .set({
        seen_at: now
      })
      .where("recipient_user_id", "=", userId)
      .where("id", "in", ids)
      .where("archived_at", "is", null)
      .where("seen_at", "is", null)
      .execute();
  }

  async markRead(userId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const now = new Date().toISOString();

    await this.database
      .updateTable("notifications")
      .set({
        read_at: now,
        seen_at: now
      })
      .where("recipient_user_id", "=", userId)
      .where("id", "in", ids)
      .where("archived_at", "is", null)
      .execute();
  }

  async archive(userId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    const now = new Date().toISOString();

    await this.database
      .updateTable("notifications")
      .set({
        archived_at: now
      })
      .where("recipient_user_id", "=", userId)
      .where("id", "in", ids)
      .execute();
  }

  async markAllRead(userId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.database
      .updateTable("notifications")
      .set({
        read_at: now,
        seen_at: now
      })
      .where("recipient_user_id", "=", userId)
      .where("archived_at", "is", null)
      .where("read_at", "is", null)
      .execute();
  }

  async claimOutboxBatch(workerId: string, limit: number): Promise<Array<NotificationOutboxRow & { payload: NotificationOutboxPayload }>> {
    const now = new Date().toISOString();

    const result = await sql<NotificationOutboxRow>`
      with claimed as (
        select id
        from notification_outbox
        where status in ('pending', 'failed')
          and available_at <= ${now}
        order by created_at asc
        for update skip locked
        limit ${limit}
      )
      update notification_outbox
      set
        attempt_count = notification_outbox.attempt_count + 1,
        last_error = null,
        locked_at = ${now},
        locked_by = ${workerId},
        status = 'processing'
      from claimed
      where notification_outbox.id = claimed.id
      returning notification_outbox.*
    `.execute(this.database);

    return result.rows.map((row: NotificationOutboxRow) => ({
      ...row,
      payload: parseJson<NotificationOutboxPayload>(row.payload_json),
      status: "processing" as const
    }));
  }

  async markOutboxProcessed(id: string): Promise<void> {
    const now = new Date().toISOString();

    await this.database
      .updateTable("notification_outbox")
      .set({
        last_error: null,
        locked_at: now,
        processed_at: now,
        status: "processed"
      })
      .where("id", "=", id)
      .execute();
  }

  async markOutboxFailed(id: string, errorMessage: string, attemptCount: number): Promise<void> {
    const retryDelayMs = Math.min(60_000, 2_000 * Math.max(attemptCount, 1));

    await this.database
      .updateTable("notification_outbox")
      .set({
        available_at: new Date(Date.now() + retryDelayMs).toISOString(),
        last_error: errorMessage,
        status: "failed"
      })
      .where("id", "=", id)
      .execute();
  }

  async createNotifications(input: {
    actorUserId: string | null;
    deliveries: NotificationDeliveryPlan[];
  }): Promise<void> {
    if (input.deliveries.length === 0) {
      return;
    }

    await this.database
      .insertInto("notifications")
      .values(
        input.deliveries.map((delivery) => ({
          actor_user_id: input.actorUserId,
          archived_at: null,
          body: delivery.body,
          category: delivery.category,
          created_at: new Date().toISOString(),
          dedupe_key: delivery.dedupeKey,
          event_type: delivery.eventType,
          href: delivery.href,
          id: createEntityId("notification"),
          invitation_id: delivery.invitationId ?? null,
          issue_id: delivery.issueId ?? null,
          payload_json: JSON.stringify({
            ...(delivery.payload ?? {}),
            ...(delivery.target ? { target: delivery.target } : {})
          }),
          project_id: delivery.projectId ?? null,
          read_at: null,
          recipient_user_id: delivery.recipientUserId,
          seen_at: null,
          title: delivery.title,
          workspace_id: delivery.workspaceId ?? null
        }))
      )
      .onConflict((conflict) =>
        conflict.columns(["recipient_user_id", "dedupe_key"]).doNothing()
      )
      .execute();
  }

  private async countUnread(userId: string): Promise<number> {
    const row = await this.database
      .selectFrom("notifications")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("recipient_user_id", "=", userId)
      .where("archived_at", "is", null)
      .where("read_at", "is", null)
      .executeTakeFirst();

    return Number(row?.count ?? 0);
  }

  private async countUnseen(userId: string): Promise<number> {
    const row = await this.database
      .selectFrom("notifications")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("recipient_user_id", "=", userId)
      .where("archived_at", "is", null)
      .where("seen_at", "is", null)
      .executeTakeFirst();

    return Number(row?.count ?? 0);
  }
}

export const deliverNotificationOutboxBatch = async (
  repository: PostgresNotificationRepository,
  input: {
    limit?: number;
    workerId: string;
  }
): Promise<number> => {
  const claimed = await repository.claimOutboxBatch(input.workerId, input.limit ?? 25);
  let processedCount = 0;

  for (const event of claimed) {
    try {
      const deliverable: NotificationDeliveryPlan[] = [];

      for (const delivery of event.payload.deliveries) {
        const preferences = await repository.getPreferences(delivery.recipientUserId);

        if (shouldDeliverInApp(preferences, delivery.category, Boolean(delivery.mandatory))) {
          deliverable.push(delivery);
        }
      }

      await repository.createNotifications({
        actorUserId: event.actor_user_id,
        deliveries: deliverable
      });
      await repository.markOutboxProcessed(event.id);
      processedCount += 1;
    } catch (error) {
      await repository.markOutboxFailed(
        event.id,
        error instanceof Error ? error.message : "Notification delivery failed",
        event.attempt_count
      );
    }
  }

  return processedCount;
};

export type { NotificationDeliveryPlan, NotificationOutboxEnvelope, NotificationOutboxPayload };
