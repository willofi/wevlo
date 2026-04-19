import type {
  IssueCommentDto,
  IssueDetailDto,
  IssuePriority,
  IssueSourceLinkDto,
  IssueState,
  IssueTriageStatus
} from "@wevlo/contracts";
import {
  createIssueId,
  createEntityId,
  type IssueId,
  type ProjectId
} from "@wevlo/core";

export type Issue = IssueDetailDto;
export type IssueComment = IssueCommentDto;
export type IssueMutator = "local" | "remote";
export type IssueField =
  | "title"
  | "description"
  | "priority"
  | "state"
  | "triageStatus"
  | "reporterUserId"
  | "assigneeUserId";

export type IssueCreateInput = {
  projectId: ProjectId;
  title: string;
  projectKey?: string;
  issueNumber?: number;
  issueKey?: string;
  description?: string;
  priority?: IssuePriority;
  state?: IssueState;
  triageStatus?: IssueTriageStatus;
  reporterUserId?: string;
  assigneeUserId?: string | null;
  sourceLinks?: IssueSourceLinkDto[];
  comments?: IssueComment[];
};

export type IssuePatch = {
  assigneeUserId?: string | null;
  description?: string;
  priority?: IssuePriority;
  reporterUserId?: string;
  title?: string;
  triageStatus?: IssueTriageStatus;
};

export const issueStateOrder: IssueState[] = [
  "backlog",
  "todo",
  "in_progress",
  "done",
  "canceled"
];

const validTransitions: Record<IssueState, IssueState[]> = {
  backlog: issueStateOrder.filter((state) => state !== "backlog"),
  todo: issueStateOrder.filter((state) => state !== "todo"),
  in_progress: issueStateOrder.filter((state) => state !== "in_progress"),
  done: issueStateOrder.filter((state) => state !== "done"),
  canceled: issueStateOrder.filter((state) => state !== "canceled")
};

const issueSourceLinkDefaults: IssueSourceLinkDto = {
  externalId: "self",
  provider: "native",
  sourceOfTruth: "local"
};

const normalizeIssueKeyPart = (value: string): string => {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "ISSUE";
};

const normalizeIssueKey = (value: string): string => normalizeIssueKeyPart(value);

export const buildIssueKey = (projectKey: string, issueNumber: number): string => {
  return `${normalizeIssueKeyPart(projectKey)}-${issueNumber}`;
};

const createFallbackIssueNumber = (): number => {
  const hex = createEntityId("issue").split("_")[1]?.replace(/-/g, "").slice(0, 8) ?? "1";
  return Number.parseInt(hex, 16) || 1;
};

export const getIssueSourceScope = (issue: Pick<Issue, "sourceLinks">): IssueSourceLinkDto["sourceOfTruth"] => {
  const scopes = new Set(issue.sourceLinks.map((link) => link.sourceOfTruth));

  if (scopes.has("shared")) {
    return "shared";
  }

  if (scopes.has("local")) {
    return "local";
  }

  return "remote";
};

export const isIssueTransitionAllowed = (currentState: IssueState, nextState: IssueState): boolean => {
  return validTransitions[currentState].includes(nextState);
};

export const createIssueComment = (input: {
  authorUserId: string;
  body: string;
  issueId: IssueId;
}): IssueComment => {
  const body = input.body.trim();

  if (body.length === 0) {
    throw new Error("Comment body is required");
  }

  return {
    id: createEntityId("issue_comment"),
    issueId: input.issueId,
    authorUserId: input.authorUserId,
    body,
    createdAt: new Date().toISOString()
  };
};

export const createIssue = (input: IssueCreateInput): Issue => {
  const issueNumber = input.issueNumber ?? createFallbackIssueNumber();

  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    throw new Error("Issue number must be a positive integer");
  }

  const issueKey = normalizeIssueKey(input.issueKey ?? buildIssueKey(input.projectKey ?? input.projectId, issueNumber));
  const title = input.title.trim();
  const sourceLinks = input.sourceLinks ?? [issueSourceLinkDefaults];
  const defaultTriageStatus: IssueTriageStatus = sourceLinks.every((sourceLink) => sourceLink.provider === "native")
    ? "accepted"
    : "pending";

  if (title.length === 0) {
    throw new Error("Issue title is required");
  }

  return {
    id: createIssueId(),
    projectId: input.projectId,
    issueNumber,
    issueKey,
    title,
    description: input.description ?? "",
    priority: input.priority ?? "none",
    state: input.state ?? "backlog",
    triageStatus: input.triageStatus ?? defaultTriageStatus,
    reporterUserId: input.reporterUserId ?? "unknown",
    assigneeUserId: input.assigneeUserId ?? null,
    sourceLinks,
    comments: input.comments ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

export const canMutateIssueField = (
  issue: Pick<Issue, "sourceLinks">,
  field: IssueField,
  actor: IssueMutator
): boolean => {
  const scope = getIssueSourceScope(issue);

  if (scope === "shared") {
    return true;
  }

  if (scope === "local") {
    return actor === "local";
  }

  if (actor === "remote") {
    return field === "title" || field === "description" || field === "reporterUserId" || field === "state";
  }

  return field === "priority" || field === "assigneeUserId" || field === "triageStatus";
};

export const applyIssuePatch = (issue: Issue, patch: IssuePatch, actor: IssueMutator): Issue => {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as Array<
    [keyof IssuePatch, NonNullable<IssuePatch[keyof IssuePatch]>]
  >;

  if (entries.length === 0) {
    return issue;
  }

  let nextIssue: Issue = issue;

  for (const [field, value] of entries) {
    if (!canMutateIssueField(issue, field as IssueField, actor)) {
      throw new Error(`Issue field ${String(field)} cannot be mutated by ${actor}`);
    }

    nextIssue = {
      ...nextIssue,
      [field]: value
    } as Issue;
  }

  return {
    ...nextIssue,
    updatedAt: new Date().toISOString()
  };
};

export const transitionIssue = (issue: Issue, nextState: IssueState): Issue => {
  if (!isIssueTransitionAllowed(issue.state, nextState)) {
    throw new Error(`Invalid transition from ${issue.state} to ${nextState}`);
  }

  return {
    ...issue,
    state: nextState,
    updatedAt: new Date().toISOString()
  };
};
