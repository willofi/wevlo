import type { ProjectRole, WorkspaceInvitationDto } from "@wevlo/contracts";

export type CreateProjectInvitationRepository = {
  createInvitation: (input: {
    inviteeEmail?: string | null;
    inviteeUserId?: string | null;
    invitedByUserId: string;
    projectId: string;
    role: ProjectRole;
    workspaceId: string;
  }) => Promise<WorkspaceInvitationDto>;
};

export const createProjectInvitationUseCase = async (
  repository: CreateProjectInvitationRepository,
  input: {
    inviteeEmail?: string | null;
    inviteeUserId?: string | null;
    invitedByUserId: string;
    projectId: string;
    role: ProjectRole;
    workspaceId: string;
  }
): Promise<WorkspaceInvitationDto> => {
  return repository.createInvitation(input);
};
