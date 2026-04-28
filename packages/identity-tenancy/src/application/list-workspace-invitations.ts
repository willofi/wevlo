import type { WorkspaceInvitationDto } from "@wevlo/contracts";

export type WorkspaceInvitationRepository = {
  listInvitations: (
    workspaceId: string,
    status?: WorkspaceInvitationDto["status"]
  ) => Promise<WorkspaceInvitationDto[]>;
};

export const listWorkspaceInvitationsUseCase = async (
  repository: WorkspaceInvitationRepository,
  workspaceId: string,
  status?: WorkspaceInvitationDto["status"]
): Promise<WorkspaceInvitationDto[]> => {
  return repository.listInvitations(workspaceId, status);
};
