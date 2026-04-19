import type { ProjectSummaryDto } from "@wevlo/contracts";

export type VisibleProjectRepository = {
  listForUserInWorkspace: (userId: string, workspaceId: string) => Promise<ProjectSummaryDto[]>;
};

export const listWorkspaceProjectsUseCase = async (
  repository: VisibleProjectRepository,
  input: {
    userId: string;
    workspaceId: string;
  }
): Promise<ProjectSummaryDto[]> => {
  return repository.listForUserInWorkspace(input.userId, input.workspaceId);
};
