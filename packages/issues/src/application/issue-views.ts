import type { BoardColumnDto, IssueListItemDto } from "@wevlo/contracts";

import { issueStateOrder, type Issue } from "../domain/issue";

export const toIssueListItem = (issue: Issue): IssueListItemDto => {
  const { comments: _comments, ...listItem } = issue;
  return listItem;
};

export const sortByIssueNumber = (left: IssueListItemDto, right: IssueListItemDto): number => {
  return left.issueNumber - right.issueNumber;
};

export const groupIssuesByState = (issues: Issue[]): BoardColumnDto[] => {
  return issueStateOrder.map((state) => ({
    state,
    issues: issues
      .filter((issue) => issue.state === state)
      .map(toIssueListItem)
      .sort(sortByIssueNumber)
  }));
};
