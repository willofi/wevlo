import type { BoardColumnDto } from "@wevlo/contracts";

import type { IssueRepository } from "./issue-repository";
import { groupIssuesByState } from "./issue-views";

export const getIssueBoardUseCase = async (
  repository: IssueRepository,
  input: {
    projectId: string;
  }
): Promise<BoardColumnDto[]> => {
  const issues = await repository.listByProject(input.projectId);
  return groupIssuesByState(issues);
};
