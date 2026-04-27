import { z } from "zod";

export const authProviderSchema = z.enum([
  "dev",
  "google",
  "github",
  "gitlab",
  "slack",
  "oidc"
]);

export const userIdentitySchema = z.object({
  id: z.string(),
  userId: z.string(),
  provider: authProviderSchema,
  providerUserId: z.string(),
  email: z.string().email().nullable(),
  createdAt: z.string()
});

export const userSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/),
  email: z.string().email().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  identities: z.array(userIdentitySchema)
});

export type AuthProvider = z.infer<typeof authProviderSchema>;
export type UserIdentityDto = z.infer<typeof userIdentitySchema>;
export type UserDto = z.infer<typeof userSchema>;
