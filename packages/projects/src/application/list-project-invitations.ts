import type { WorkspaceInvitationDto } from "@wevlo/contracts";

export type ProjectInvitationRepository = {
  listInvitations: (projectId: string) => Promise<WorkspaceInvitationDto[]>;
};

export const listProjectInvitationsUseCase = async (
  repository: ProjectInvitationRepository,
  projectId: string
): Promise<WorkspaceInvitationDto[]> => {
  return repository.listInvitations(projectId);
};
