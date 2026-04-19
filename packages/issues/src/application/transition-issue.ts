import type { IssueDetailDto } from "@wevlo/contracts";

import { canMutateIssueField, isIssueTransitionAllowed, transitionIssue, type IssueMutator } from "../domain/issue";
import { IssueMutationNotAllowedError, IssueNotFoundError, IssueTransitionNotAllowedError } from "./errors";
import type { IssueRepository } from "./issue-repository";

export const transitionIssueUseCase = async (
  repository: IssueRepository,
  input: {
    actor: IssueMutator;
    issueKey: string;
    nextState: IssueDetailDto["state"];
    projectId: string;
  }
): Promise<IssueDetailDto> => {
  const issue = await repository.findByKey(input.projectId, input.issueKey);

  if (!issue) {
    throw new IssueNotFoundError(input.projectId, input.issueKey);
  }

  if (!isIssueTransitionAllowed(issue.state, input.nextState)) {
    throw new IssueTransitionNotAllowedError(issue.state, input.nextState);
  }

  if (!canMutateIssueField(issue, "state", input.actor)) {
    throw new IssueMutationNotAllowedError("state", input.actor);
  }

  const transitioned = transitionIssue(issue, input.nextState);
  await repository.save(transitioned);
  return transitioned;
};
