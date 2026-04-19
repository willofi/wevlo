import type { IssueListItemDto } from "@wevlo/contracts";

import type { IssueRepository } from "./issue-repository";
import { toIssueListItem } from "./issue-views";

export const listIssuesUseCase = async (
  repository: IssueRepository,
  input: {
    projectId: string;
  }
): Promise<IssueListItemDto[]> => {
  const issues = await repository.listByProject(input.projectId);
  return issues.map(toIssueListItem).sort((left, right) => left.issueNumber - right.issueNumber);
};
