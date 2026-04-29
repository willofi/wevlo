import type { Issue } from "../domain/issue";
import type { IssueAttachmentDto, IssueLabelDto, IssueListItemDto, IssuePriority, IssueState, IssueSubscriptionStateDto, IssueTriageStatus } from "@wevlo/contracts";

export type CreateIssueAttachmentInput = {
  byteSize: number;
  checksum: string;
  contentType: string;
  fileName: string;
  id: string;
  issueId: string;
  storageKey: string;
  uploadedByUserId: string;
};

export type CreateIssueLabelInput = {
  color: string;
  name: string;
  projectId: string;
};

export type IssueIdentity = {
  assigneeUserId: string | null;
  dueDate: string | null;
  id: string;
  issueKey: string;
  parentIssueId: string | null;
  priority: IssuePriority;
  projectId: string;
  reporterUserId: string;
  state: IssueState;
  title: string;
  triageStatus: IssueTriageStatus;
};

export type IssueRepository = {
  addReaction: (input: {
    emoji: string;
    issueId: string;
    userId: string;
  }) => Promise<void>;
  appendComment: (input: {
    comment: Issue["comments"][number];
    issueId: string;
    updatedAt: string;
  }) => Promise<void>;
  createAttachment: (input: CreateIssueAttachmentInput) => Promise<IssueAttachmentDto>;
  createLabel: (input: CreateIssueLabelInput) => Promise<IssueLabelDto>;
  deleteAttachment: (attachmentId: string, issueId: string) => Promise<void>;
  ensureDefaultLabels: (projectId: string) => Promise<void>;
  ensureSubscriptions: (input: {
    issueId: string;
    userIds: string[];
  }) => Promise<void>;
  findAttachment: (attachmentId: string, issueId: string) => Promise<(IssueAttachmentDto & { storageKey: string }) | null>;
  findByKey: (projectId: string, issueKey: string) => Promise<Issue | null>;
  findIssueIdentityByKey: (projectId: string, issueKey: string) => Promise<IssueIdentity | null>;
  findLabelsByIds: (projectId: string, labelIds: string[]) => Promise<IssueLabelDto[]>;
  findBySourceLink: (input: {
    projectId: string;
    provider: Issue["sourceLinks"][number]["provider"];
    externalId: string;
    installationId?: string;
  }) => Promise<Issue | null>;
  getSubscriptionState: (issueId: string, userId: string) => Promise<IssueSubscriptionStateDto>;
  hasReaction: (input: {
    emoji: string;
    issueId: string;
    userId: string;
  }) => Promise<boolean>;
  listLabels: (projectId: string) => Promise<IssueLabelDto[]>;
  listByProject: (projectId: string) => Promise<Issue[]>;
  listIssueSummariesByProject: (input: {
    projectId: string;
    scope?: "all" | "assigned" | "created";
    userId?: string;
  }) => Promise<IssueListItemDto[]>;
  nextIssueNumber: (projectId: string) => Promise<number>;
  removeReaction: (input: {
    emoji: string;
    issueId: string;
    userId: string;
  }) => Promise<void>;
  save: (issue: Issue) => Promise<void>;
  setSubscription: (input: {
    issueId: string;
    subscribed: boolean;
    userId: string;
  }) => Promise<IssueSubscriptionStateDto>;
};
