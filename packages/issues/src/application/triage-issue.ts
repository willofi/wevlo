import type { IssueDetailDto } from "@wevlo/contracts";
import type { IssuePriority } from "@wevlo/contracts";

import { applyIssuePatch, type IssueMutator } from "../domain/issue";
import { IssueMutationNotAllowedError, IssueNotFoundError, IssueTriageStatusError } from "./errors";
import type { IssueRepository } from "./issue-repository";

export type TriageIssueInput = {
  actor: IssueMutator;
  assigneeUserId?: string | null;
  issueKey: string;
  priority?: IssuePriority;
  projectId: string;
};

export const triageIssueUseCase = async (
  repository: IssueRepository,
  input: TriageIssueInput
): Promise<{
  issue: IssueDetailDto;
  previousIssue: IssueDetailDto;
}> => {
  const issue = await repository.findByKey(input.projectId, input.issueKey);

  if (!issue) {
    throw new IssueNotFoundError(input.projectId, input.issueKey);
  }

  if (issue.triageStatus !== "pending") {
    throw new IssueTriageStatusError(input.issueKey);
  }

  const patch = {
    triageStatus: "pending" as const,
    ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {})
  };

  try {
    const triaged = applyIssuePatch(
      issue,
      patch,
      input.actor
    );

    await repository.save(triaged);
    return {
      issue: triaged,
      previousIssue: issue
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new IssueMutationNotAllowedError(error.message, input.actor);
    }

    throw error;
  }
};
