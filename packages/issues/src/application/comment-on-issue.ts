import type { IssueId } from "@wevlo/core";
import type { IssueCommentDto, IssueDetailDto } from "@wevlo/contracts";

import { createIssueComment } from "../domain/issue";
import { IssueNotFoundError } from "./errors";
import type { IssueRepository } from "./issue-repository";

export type CommentOnIssueInput = {
  authorUserId: string;
  body: string;
  issueKey: string;
  mentions?: IssueCommentDto["mentions"];
  parentCommentId?: string | null;
  projectId: string;
};

export const commentOnIssueUseCase = async (
  repository: IssueRepository,
  input: CommentOnIssueInput
): Promise<{
  createdComment: IssueCommentDto;
  issue: IssueDetailDto;
  previousIssue: IssueDetailDto;
}> => {
  const issue = await repository.findByKey(input.projectId, input.issueKey);

  if (!issue) {
    throw new IssueNotFoundError(input.projectId, input.issueKey);
  }

  const comment: IssueCommentDto = createIssueComment({
    authorUserId: input.authorUserId,
    body: input.body,
    issueId: issue.id as IssueId,
    parentCommentId: input.parentCommentId ?? null,
    ...(input.mentions ? { mentions: input.mentions } : {})
  });

  const updated = {
    ...issue,
    comments: [...issue.comments, comment],
    updatedAt: new Date().toISOString()
  };

  await repository.appendComment({
    comment,
    issueId: issue.id,
    updatedAt: updated.updatedAt
  });

  return {
    createdComment: comment,
    issue: updated,
    previousIssue: issue
  };
};
