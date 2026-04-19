import { z } from "zod";

export const inboundEventSchema = z.object({
  id: z.string(),
  provider: z.enum(["github", "gitlab"]),
  eventName: z.string(),
  receivedAt: z.string(),
  tenantId: z.string(),
  deliveryId: z.string().optional(),
  installationId: z.string().nullable().optional(),
  projectLinkId: z.string().nullable().optional()
});

export type InboundEventDto = z.infer<typeof inboundEventSchema>;
