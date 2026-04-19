import { z } from "zod";

import { projectMemberSchema, workspaceMemberSchema } from "../domain/member";
import { userSchema } from "../domain/user";

export const meSchema = z.object({
  user: userSchema,
  workspaceMemberships: z.array(workspaceMemberSchema),
  projectMemberships: z.array(projectMemberSchema)
});

export type MeDto = z.infer<typeof meSchema>;
