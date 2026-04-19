import type { ProjectId } from "@wevlo/core";
import type { IssueDetailDto, IssueSourceLinkDto } from "@wevlo/contracts";

import { buildIssueKey, createIssue } from "../domain/issue";
import { IssueAlreadyExistsError } from "./errors";
import type { IssueRepository } from "./issue-repository";

export type CreateIssueInput = {
  projectId: string;
  projectKey: string;
  reporterUserId: string;
  title: string;
  state?: IssueDetailDto["state"];
  triageStatus?: IssueDetailDto["triageStatus"];
  description?: string;
  priority?: IssueDetailDto["priority"];
  assigneeUserId?: string | null;
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
    projectId: input.projectId as ProjectId,
    projectKey: input.projectKey,
    reporterUserId: input.reporterUserId,
    ...(input.state !== undefined ? { state: input.state } : {}),
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.triageStatus !== undefined ? { triageStatus: input.triageStatus } : {}),
    ...(input.sourceLinks !== undefined ? { sourceLinks: input.sourceLinks } : {})
  });

  await repository.save(issue);
  return issue;
};
