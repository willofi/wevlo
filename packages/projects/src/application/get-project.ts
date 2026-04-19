import type { ProjectSummaryDto } from "@wevlo/contracts";

export type ProjectLookupRepository = {
  findForUserByKey: (
    userId: string,
    workspaceId: string,
    projectKey: string
  ) => Promise<ProjectSummaryDto | null>;
};

export const getProjectByKeyUseCase = async (
  repository: ProjectLookupRepository,
  input: {
    projectKey: string;
    userId: string;
    workspaceId: string;
  }
): Promise<ProjectSummaryDto | null> => {
  return repository.findForUserByKey(input.userId, input.workspaceId, input.projectKey.toUpperCase());
};
