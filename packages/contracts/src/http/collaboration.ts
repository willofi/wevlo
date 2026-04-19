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
    role: workspaceRoleSchema
  })
  .refine((value) => Boolean(value.userId || value.email), {
    message: "userId or email is required"
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

export const workspaceInvitationRequestSchema = createWorkspaceInvitationRequestSchema;
export const projectInvitationRequestSchema = createProjectInvitationRequestSchema;

export type WorkspaceInvitationRequest = CreateWorkspaceInvitationRequest;
export type ProjectInvitationRequest = CreateProjectInvitationRequest;
