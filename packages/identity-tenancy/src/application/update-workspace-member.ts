export type UpdateWorkspaceMemberRepository = {
  updateMember: (workspaceId: string, userId: string, role: "Owner" | "Member") => Promise<void>;
};

export const updateWorkspaceMemberUseCase = async (
  repository: UpdateWorkspaceMemberRepository,
  input: {
    role: "Owner" | "Member";
    userId: string;
    workspaceId: string;
  }
): Promise<void> => {
  await repository.updateMember(input.workspaceId, input.userId, input.role);
};
