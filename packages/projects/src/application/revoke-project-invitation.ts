export type RevokeProjectInvitationRepository = {
  revokeInvitation: (projectId: string, invitationId: string) => Promise<void>;
};

export const revokeProjectInvitationUseCase = async (
  repository: RevokeProjectInvitationRepository,
  input: {
    invitationId: string;
    projectId: string;
  }
): Promise<void> => {
  await repository.revokeInvitation(input.projectId, input.invitationId);
};
