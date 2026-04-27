import type { ProjectId } from "@wevlo/core";
import type { IssueDetailDto, IssueMentionDto, IssueSourceLinkDto } from "@wevlo/contracts";

import { buildIssueKey, createIssue } from "../domain/issue";
import { IssueAlreadyExistsError } from "./errors";
import type { IssueRepository } from "./issue-repository";

export type CreateIssueInput = {
  projectId: string;
  projectKey: string;
  parentIssueId?: string | null;
  reporterUserId: string;
  title: string;
  state?: IssueDetailDto["state"];
  triageStatus?: IssueDetailDto["triageStatus"];
  description?: string;
  priority?: IssueDetailDto["priority"];
  dueDate?: IssueDetailDto["dueDate"];
  labels?: IssueDetailDto["labels"];
  assigneeUserId?: string | null;
  descriptionMentions?: IssueMentionDto[];
  sourceLinks?: IssueSourceLinkDto[];
};

export const createIssueUseCase = async (
  repository: IssueRepository,
  input: CreateIssueInput
): Promise<IssueDetailDto> => {
  const issueNumber = await repository.nextIssueNumber(input.projectId);
  const issueKey = buildIssueKey(input.projectKey, issueNumber);
  const existing = await repository.findByKey(input.projectId, issueKey);

  if (existing) {
    throw new IssueAlreadyExistsError(input.projectId, issueKey);
  }

  const issue = createIssue({
    assigneeUserId: input.assigneeUserId ?? null,
    issueKey,
    issueNumber,
    ...(input.parentIssueId !== undefined ? { parentIssueId: input.parentIssueId } : {}),
    projectId: input.projectId as ProjectId,
    projectKey: input.projectKey,
    reporterUserId: input.reporterUserId,
    ...(input.state !== undefined ? { state: input.state } : {}),
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.descriptionMentions !== undefined ? { descriptionMentions: input.descriptionMentions } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.labels !== undefined ? { labels: input.labels } : {}),
    ...(input.triageStatus !== undefined ? { triageStatus: input.triageStatus } : {}),
    ...(input.sourceLinks !== undefined ? { sourceLinks: input.sourceLinks } : {})
  });

  await repository.save(issue);
  return issue;
};
