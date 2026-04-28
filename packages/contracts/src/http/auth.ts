import { z } from "zod";

export const verificationTokenSchema = z.object({
  identifier: z.string(),
  token: z.string(),
  expires: z.string()
});

export const createVerificationTokenRequestSchema = verificationTokenSchema;

export const verifyTokenRequestSchema = z.object({
  identifier: z.string(),
  token: z.string()
});

export const createUserRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  handle: z.string().min(1).optional()
});

export type VerificationTokenDto = z.infer<typeof verificationTokenSchema>;
export type CreateVerificationTokenRequest = z.infer<typeof createVerificationTokenRequestSchema>;
export type VerifyTokenRequest = z.infer<typeof verifyTokenRequestSchema>;
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
