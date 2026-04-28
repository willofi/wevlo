import { z } from "zod";

import { projectRoleSchema } from "./project-role";
import { userSchema } from "./user";

export const workspaceRoleSchema = z.enum(["Owner", "Maintainer", "Developer", "Member", "Guest"]);

export const workspaceMemberSchema = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  user: userSchema,
  role: workspaceRoleSchema,
  createdAt: z.string()
});

export const projectMemberSchema = z.object({
  projectId: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  user: userSchema,
  role: projectRoleSchema,
  createdAt: z.string()
});

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type WorkspaceMemberDto = z.infer<typeof workspaceMemberSchema>;
export type ProjectMemberDto = z.infer<typeof projectMemberSchema>;
