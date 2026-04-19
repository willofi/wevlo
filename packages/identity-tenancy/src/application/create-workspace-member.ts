import type { WorkspaceMemberDto, WorkspaceRole } from "@wevlo/contracts";

export type CreateWorkspaceMemberRepository = {
  createMember: (input: {
    role: WorkspaceRole;
    userId: string;
    workspaceId: string;
  }) => Promise<WorkspaceMemberDto>;
};

export const createWorkspaceMemberUseCase = async (
  repository: CreateWorkspaceMemberRepository,
  input: {
    role: WorkspaceRole;
    userId: string;
    workspaceId: string;
  }
): Promise<WorkspaceMemberDto> => {
  return repository.createMember(input);
};
