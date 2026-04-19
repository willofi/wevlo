import type { IssueDetailDto } from "@wevlo/contracts";

import { applyIssuePatch, type IssueMutator } from "../domain/issue";
import { IssueMutationNotAllowedError, IssueNotFoundError, IssueTriageStatusError } from "./errors";
import type { IssueRepository } from "./issue-repository";

export const acceptTriageUseCase = async (
  repository: IssueRepository,
  input: {
    actor: IssueMutator;
    issueKey: string;
    projectId: string;
  }
): Promise<IssueDetailDto> => {
  const issue = await repository.findByKey(input.projectId, input.issueKey);

  if (!issue) {
    throw new IssueNotFoundError(input.projectId, input.issueKey);
  }

  if (issue.triageStatus !== "pending") {
    throw new IssueTriageStatusError(input.issueKey);
  }

  try {
    const accepted = applyIssuePatch(issue, { triageStatus: "accepted" }, input.actor);
    await repository.save(accepted);
    return accepted;
  } catch (error) {
    if (error instanceof Error) {
      throw new IssueMutationNotAllowedError(error.message, input.actor);
    }

    throw error;
  }
};
