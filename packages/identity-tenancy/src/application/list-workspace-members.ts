import type { WorkspaceMemberDto } from "@wevlo/contracts";

export type WorkspaceMemberRepository = {
  listMembers: (workspaceId: string) => Promise<WorkspaceMemberDto[]>;
};

export const listWorkspaceMembersUseCase = async (
  repository: WorkspaceMemberRepository,
  workspaceId: string
): Promise<WorkspaceMemberDto[]> => {
  return repository.listMembers(workspaceId);
};
