import type { IssueDetailDto } from "@wevlo/contracts";

import { applyIssuePatch, type IssueMutator, type IssuePatch } from "../domain/issue";
import { IssueNotFoundError } from "./errors";
import type { IssueRepository } from "./issue-repository";

export type UpdateIssueInput = {
  actor: IssueMutator;
  issueKey: string;
  projectId: string;
  changes: Pick<IssuePatch, "assigneeUserId" | "description" | "descriptionMentions" | "dueDate" | "labels" | "priority" | "reporterUserId" | "title">;
};

export const updateIssueUseCase = async (
  repository: IssueRepository,
  input: UpdateIssueInput
): Promise<IssueDetailDto> => {
  const issue = await repository.findByKey(input.projectId, input.issueKey);

  if (!issue) {
    throw new IssueNotFoundError(input.projectId, input.issueKey);
  }

  const updated = applyIssuePatch(issue, input.changes, input.actor);
  await repository.save(updated);
  return updated;
};
