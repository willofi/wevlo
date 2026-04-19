import { z } from "zod";

import { projectRoleSchema } from "./project-role";
import { workspaceRoleSchema } from "./member";

export const invitationStatusSchema = z.enum(["pending", "accepted", "revoked", "expired"]);

export const workspaceInvitationSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().nullable(),
  inviteeUserId: z.string().nullable(),
  inviteeEmail: z.string().email().nullable(),
  role: z.union([workspaceRoleSchema, projectRoleSchema]),
  status: invitationStatusSchema,
  invitedByUserId: z.string(),
  acceptedByUserId: z.string().nullable(),
  acceptedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
  ,
  expiresAt: z.string(),
  acceptToken: z.string().nullable()
});

export type InvitationStatus = z.infer<typeof invitationStatusSchema>;
export type WorkspaceInvitationDto = z.infer<typeof workspaceInvitationSchema>;
