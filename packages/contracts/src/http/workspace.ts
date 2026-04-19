import { z } from "zod";

export const createWorkspaceRequestSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(3).optional()
});

export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;
