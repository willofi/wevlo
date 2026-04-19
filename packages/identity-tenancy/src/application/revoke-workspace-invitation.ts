export type RevokeWorkspaceInvitationRepository = {
  revokeInvitation: (workspaceId: string, invitationId: string) => Promise<void>;
};

export const revokeWorkspaceInvitationUseCase = async (
  repository: RevokeWorkspaceInvitationRepository,
  input: {
    invitationId: string;
    workspaceId: string;
  }
): Promise<void> => {
  await repository.revokeInvitation(input.workspaceId, input.invitationId);
};
