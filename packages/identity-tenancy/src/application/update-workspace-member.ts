import type { WorkspaceRole } from "@wevlo/contracts";

export type UpdateWorkspaceMemberRepository = {
  updateMember: (workspaceId: string, userId: string, role: WorkspaceRole) => Promise<void>;
};

export const updateWorkspaceMemberUseCase = async (
  repository: UpdateWorkspaceMemberRepository,
  input: {
    role: WorkspaceRole;
    userId: string;
    workspaceId: string;
  }
): Promise<void> => {
  await repository.updateMember(input.workspaceId, input.userId, input.role);
};
