import { z } from "zod";

export const outboxEventSchema = z.object({
  id: z.string(),
  topic: z.string(),
  aggregateId: z.string(),
  occurredAt: z.string()
});

export type OutboxEventDto = z.infer<typeof outboxEventSchema>;
