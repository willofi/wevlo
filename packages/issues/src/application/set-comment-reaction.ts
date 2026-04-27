import type { IssueDetailDto } from "@wevlo/contracts";
import type { IssueRepository } from "./issue-repository";
import { IssueNotFoundError } from "./errors";

export type SetCommentReactionInput = {
  active: boolean;
  commentId: string;
  emoji: string;
  issueKey: string;
  projectId: string;
  userId: string;
};

export const setCommentReactionUseCase = async (
  repository: IssueRepository,
  input: SetCommentReactionInput
): Promise<IssueDetailDto> => {
  const issue = await repository.findByKey(input.projectId, input.issueKey);

  if (!issue) {
    throw new IssueNotFoundError(input.projectId, input.issueKey);
  }

  const commentIndex = issue.comments.findIndex((c) => c.id === input.commentId);

  if (commentIndex === -1) {
    throw new Error(`Comment not found: ${input.commentId}`);
  }

  const comment = issue.comments[commentIndex];
  if (!comment) {
    throw new Error(`Comment not found: ${input.commentId}`);
  }

  const reactions = [...comment.reactions];
  const reactionIndex = reactions.findIndex((r) => r.emoji === input.emoji);

  if (input.active) {
    if (reactionIndex === -1) {
      reactions.push({
        count: 1,
        emoji: input.emoji,
        userIds: [input.userId]
      });
    } else {
      const reaction = reactions[reactionIndex];
      if (!reaction) {
        throw new Error(`Reaction not found: ${input.emoji}`);
      }
      if (!reaction.userIds.includes(input.userId)) {
        reactions[reactionIndex] = {
          ...reaction,
          count: reaction.count + 1,
          userIds: [...reaction.userIds, input.userId]
        };
      }
    }
  } else {
    if (reactionIndex !== -1) {
      const reaction = reactions[reactionIndex];
      if (!reaction) {
        throw new Error(`Reaction not found: ${input.emoji}`);
      }
      if (reaction.userIds.includes(input.userId)) {
        const nextUserIds = reaction.userIds.filter((id) => id !== input.userId);
        if (nextUserIds.length === 0) {
          reactions.splice(reactionIndex, 1);
        } else {
          reactions[reactionIndex] = {
            ...reaction,
            count: reaction.count - 1,
            userIds: nextUserIds
          };
        }
      }
    }
  }

  const nextComments = [...issue.comments];
  nextComments[commentIndex] = {
    ...comment,
    reactions
  };

  const updatedIssue: IssueDetailDto = {
    ...issue,
    comments: nextComments,
    updatedAt: new Date().toISOString()
  };

  await repository.save(updatedIssue);
  return updatedIssue;
};
