export type RemoveWorkspaceMemberRepository = {
  removeMember: (workspaceId: string, userId: string) => Promise<void>;
};

export const removeWorkspaceMemberUseCase = async (
  repository: RemoveWorkspaceMemberRepository,
  input: {
    userId: string;
    workspaceId: string;
  }
): Promise<void> => {
  await repository.removeMember(input.workspaceId, input.userId);
};
