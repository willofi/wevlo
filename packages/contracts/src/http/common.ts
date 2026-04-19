import { z } from "zod";

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative()
});

export const errorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string().optional()
});

export type PaginationDto = z.infer<typeof paginationSchema>;
export type ErrorEnvelopeDto = z.infer<typeof errorEnvelopeSchema>;
