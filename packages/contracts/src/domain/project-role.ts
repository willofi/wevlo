import { z } from "zod";

export const projectRoleSchema = z.enum([
  "Owner",
  "Maintainer",
  "Developer",
  "Planner",
  "Guest"
]);

export type ProjectRole = z.infer<typeof projectRoleSchema>;
