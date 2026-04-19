import type { ProjectMembershipDto } from "@wevlo/contracts";
import {
  createProjectId,
  normalizeProjectKey,
  type ProjectId,
  type ProjectKey,
  type WorkspaceId
} from "@wevlo/core";

export type Project = {
  createdAt: string;
  id: ProjectId;
  key: ProjectKey;
  workspaceId: WorkspaceId;
  name: string;
  updatedAt: string;
  visibility: "private" | "workspace";
  memberships: ProjectMembershipDto[];
};

export const createProject = (input: {
  workspaceId: WorkspaceId;
  name: string;
  key: string;
  ownerUserId: string;
}): Project => ({
  createdAt: new Date().toISOString(),
  id: createProjectId(),
  workspaceId: input.workspaceId,
  name: input.name,
  key: normalizeProjectKey(input.key),
  updatedAt: new Date().toISOString(),
  visibility: "private",
  memberships: [
    {
      userId: input.ownerUserId,
      role: "Owner"
    }
  ]
});
