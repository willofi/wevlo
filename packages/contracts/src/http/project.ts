import { z } from "zod";

import { projectBoardColumnConfigSchema } from "../domain/issue";
import { projectRoleSchema } from "../domain/project-role";

export const createProjectRequestSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(2).optional()
});

export const upsertProjectMemberRequestSchema = z.object({
  role: projectRoleSchema
});

export const updateProjectBoardConfigRequestSchema = z.object({
  columns: z.array(projectBoardColumnConfigSchema)
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type UpsertProjectMemberRequest = z.infer<typeof upsertProjectMemberRequestSchema>;
export type UpdateProjectBoardConfigRequest = z.infer<typeof updateProjectBoardConfigRequestSchema>;
