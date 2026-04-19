import { z } from "zod";

export const sessionSchema = z.object({
  userId: z.string(),
  email: z.string().email().nullable(),
  name: z.string().min(1),
  workspaceIds: z.array(z.string()),
  defaultWorkspaceSlug: z.string().nullable()
});

export type SessionDto = z.infer<typeof sessionSchema>;
