import { createEntityId } from "@wevlo/core";

export type AuditEvent = {
  id: string;
  actorId: string;
  action: string;
  resourceId: string;
  occurredAt: string;
};

export const recordAuditEvent = (input: Omit<AuditEvent, "id" | "occurredAt">): AuditEvent => ({
  id: createEntityId("audit"),
  occurredAt: new Date().toISOString(),
  ...input
});
