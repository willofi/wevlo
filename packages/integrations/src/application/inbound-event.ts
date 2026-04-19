import { createEntityId } from "@wevlo/core";

import type { IntegrationProvider } from "../domain/provider";

export type InboundEvent = {
  id: string;
  tenantId: string;
  provider: IntegrationProvider;
  eventName: string;
  receivedAt: string;
};

export const createInboundEvent = (
  provider: IntegrationProvider,
  tenantId: string,
  eventName: string
): InboundEvent => ({
  id: createEntityId("event"),
  tenantId,
  provider,
  eventName,
  receivedAt: new Date().toISOString()
});
