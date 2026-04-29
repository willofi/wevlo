import type { IssueListItemDto } from "@wevlo/contracts";

import type { IssueRepository } from "./issue-repository";

export const listIssuesUseCase = async (
  repository: IssueRepository,
  input: {
    projectId: string;
    scope?: "all" | "assigned" | "created";
    userId?: string;
  }
): Promise<IssueListItemDto[]> => {
  const issues = await repository.listIssueSummariesByProject(input);
  return issues.sort((left, right) => left.issueNumber - right.issueNumber);
};
