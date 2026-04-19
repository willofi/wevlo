export type RemoveProjectMemberRepository = {
  removeMember: (projectId: string, userId: string) => Promise<void>;
};

export const removeProjectMemberUseCase = async (
  repository: RemoveProjectMemberRepository,
  input: {
    projectId: string;
    userId: string;
  }
): Promise<void> => {
  await repository.removeMember(input.projectId, input.userId);
};
