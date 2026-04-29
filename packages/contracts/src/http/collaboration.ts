import { z } from "zod";

import { projectRoleSchema } from "../domain/project-role";
import { workspaceRoleSchema } from "../domain/member";

export const createWorkspaceMemberRequestSchema = z.object({
  userId: z.string().min(1),
  role: workspaceRoleSchema
});

export const createProjectMemberRequestSchema = z.object({
  userId: z.string().min(1),
  role: projectRoleSchema
});

export const createWorkspaceInvitationRequestSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.string().email().optional(),
    emails: z.array(z.string()).min(1).optional(),
    role: workspaceRoleSchema
  })
  .refine((value) => Boolean(value.userId || value.email || value.emails), {
    message: "userId, email, or emails is required"
  });

export const workspaceInvitationFailureReasonSchema = z.enum([
  "invalid_email",
  "email_send_failed",
  "invite_create_failed",
  "invite_already_pending"
]);

export const workspaceInvitationResultSchema = z.object({
  email: z.string().min(1),
  invitationId: z.string().nullable(),
  reason: workspaceInvitationFailureReasonSchema.nullable(),
  status: z.enum(["created", "already_member", "failed"])
});

export const createWorkspaceInvitationsResponseSchema = z.object({
  results: z.array(workspaceInvitationResultSchema)
});

export const createProjectInvitationRequestSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: projectRoleSchema
  })
  .refine((value) => Boolean(value.userId || value.email), {
    message: "userId or email is required"
  });

export type CreateWorkspaceMemberRequest = z.infer<typeof createWorkspaceMemberRequestSchema>;
export type CreateProjectMemberRequest = z.infer<typeof createProjectMemberRequestSchema>;
export type CreateWorkspaceInvitationRequest = z.infer<typeof createWorkspaceInvitationRequestSchema>;
export type CreateProjectInvitationRequest = z.infer<typeof createProjectInvitationRequestSchema>;
export type WorkspaceInvitationFailureReason = z.infer<typeof workspaceInvitationFailureReasonSchema>;
export type WorkspaceInvitationResult = z.infer<typeof workspaceInvitationResultSchema>;
export type CreateWorkspaceInvitationsResponse = z.infer<typeof createWorkspaceInvitationsResponseSchema>;

export const workspaceInvitationRequestSchema = createWorkspaceInvitationRequestSchema;
export const projectInvitationRequestSchema = createProjectInvitationRequestSchema;

export type WorkspaceInvitationRequest = CreateWorkspaceInvitationRequest;
export type ProjectInvitationRequest = CreateProjectInvitationRequest;
