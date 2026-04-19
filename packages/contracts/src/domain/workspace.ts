import { z } from "zod";

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(3),
  createdAt: z.string()
});

export const workspaceSummarySchema = workspaceSchema.pick({
  id: true,
  name: true,
  slug: true,
  createdAt: true
});

export type WorkspaceDto = z.infer<typeof workspaceSchema>;
export type WorkspaceSummaryDto = z.infer<typeof workspaceSummarySchema>;
