import type { IssueDetailDto } from "@wevlo/contracts";

import type { IssueRepository } from "./issue-repository";

export const getIssueUseCase = async (
  repository: IssueRepository,
  input: {
    issueKey: string;
    projectId: string;
  }
): Promise<IssueDetailDto | null> => {
  return repository.findByKey(input.projectId, input.issueKey);
};
