import type { WorkspaceId } from "@wevlo/core";
import type { WorkspaceRole } from "@wevlo/contracts";

export type WorkspaceMembershipRole = WorkspaceRole;

export type WorkspaceMembership = {
  workspaceId: WorkspaceId;
  userId: string;
  role: WorkspaceMembershipRole;
  createdAt: string;
};

export const createWorkspaceMembership = (
  workspaceId: WorkspaceId,
  userId: string,
  role: WorkspaceMembershipRole
): WorkspaceMembership => ({
  workspaceId,
  userId,
  role,
  createdAt: new Date().toISOString()
});
