import type { WorkspaceInvitationDto, WorkspaceRole } from "@wevlo/contracts";

export type CreateWorkspaceInvitationRepository = {
  createInvitation: (input: {
    inviteeEmail?: string | null;
    inviteeUserId?: string | null;
    invitedByUserId: string;
    role: WorkspaceRole;
    workspaceId: string;
  }) => Promise<WorkspaceInvitationDto>;
};

export const createWorkspaceInvitationUseCase = async (
  repository: CreateWorkspaceInvitationRepository,
  input: {
    inviteeEmail?: string | null;
    inviteeUserId?: string | null;
    invitedByUserId: string;
    role: WorkspaceRole;
    workspaceId: string;
  }
): Promise<WorkspaceInvitationDto> => {
  return repository.createInvitation(input);
};
