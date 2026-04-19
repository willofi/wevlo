import { z } from "zod";

import { projectRoleSchema } from "./project-role";

export const projectVisibilitySchema = z.enum([
  "private",
  "workspace"
]);

export const projectMembershipSchema = z.object({
  userId: z.string(),
  role: projectRoleSchema
});

export const projectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(1),
  key: z.string().min(2),
  visibility: projectVisibilitySchema,
  memberships: z.array(projectMembershipSchema)
});

export const projectSummarySchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(1),
  key: z.string().min(2),
  visibility: projectVisibilitySchema,
  currentUserRole: projectRoleSchema
});

export type ProjectDto = z.infer<typeof projectSchema>;
export type ProjectMembershipDto = z.infer<typeof projectMembershipSchema>;
export type ProjectSummaryDto = z.infer<typeof projectSummarySchema>;
export type ProjectVisibility = z.infer<typeof projectVisibilitySchema>;
