import { z } from "zod";

export const auditEventSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  action: z.string(),
  resourceId: z.string(),
  occurredAt: z.string()
});

export type AuditEventDto = z.infer<typeof auditEventSchema>;
