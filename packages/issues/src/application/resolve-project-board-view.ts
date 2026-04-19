import type {
  BoardIssueDto,
  ProjectBoardConfigDto,
  ProjectBoardViewDto
} from "@wevlo/contracts";

import type { Issue } from "../domain/issue";

const toBoardIssue = (issue: Issue): BoardIssueDto => ({
  id: issue.id,
  projectId: issue.projectId,
  issueKey: issue.issueKey,
  title: issue.title,
  description: issue.description,
  state: issue.state,
  priority: issue.priority,
  assigneeUserId: issue.assigneeUserId,
  updatedAt: issue.updatedAt
});

const sortBoardIssues = (left: BoardIssueDto, right: BoardIssueDto): number =>
  left.updatedAt < right.updatedAt ? 1 : left.updatedAt > right.updatedAt ? -1 : left.issueKey.localeCompare(right.issueKey);

export const resolveProjectBoardViewUseCase = (
  issues: Issue[],
  config: ProjectBoardConfigDto
): ProjectBoardViewDto => ({
  projectId: config.projectId,
  columns: config.columns
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((column) => ({
      ...column,
      issues: issues
        .filter((issue) => issue.state === column.state && issue.triageStatus === "accepted")
        .map(toBoardIssue)
        .sort(sortBoardIssues)
    }))
});
