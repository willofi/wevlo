import type { WorkspaceInvitationDto } from "@wevlo/contracts";

export type WorkspaceInvitationRepository = {
  listInvitations: (workspaceId: string) => Promise<WorkspaceInvitationDto[]>;
};

export const listWorkspaceInvitationsUseCase = async (
  repository: WorkspaceInvitationRepository,
  workspaceId: string
): Promise<WorkspaceInvitationDto[]> => {
  return repository.listInvitations(workspaceId);
};
