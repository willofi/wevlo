import type { Issue } from "../domain/issue";
import type { IssueAttachmentDto, IssueLabelDto } from "@wevlo/contracts";

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

export type IssueRepository = {
  addReaction: (input: {
    emoji: string;
    issueId: string;
    userId: string;
  }) => Promise<void>;
  createAttachment: (input: CreateIssueAttachmentInput) => Promise<IssueAttachmentDto>;
  createLabel: (input: CreateIssueLabelInput) => Promise<IssueLabelDto>;
  deleteAttachment: (attachmentId: string, issueId: string) => Promise<void>;
  findAttachment: (attachmentId: string, issueId: string) => Promise<(IssueAttachmentDto & { storageKey: string }) | null>;
  findByKey: (projectId: string, issueKey: string) => Promise<Issue | null>;
  findBySourceLink: (input: {
    projectId: string;
    provider: Issue["sourceLinks"][number]["provider"];
    externalId: string;
    installationId?: string;
  }) => Promise<Issue | null>;
  listLabels: (projectId: string) => Promise<IssueLabelDto[]>;
  listByProject: (projectId: string) => Promise<Issue[]>;
  nextIssueNumber: (projectId: string) => Promise<number>;
  removeReaction: (input: {
    emoji: string;
    issueId: string;
    userId: string;
  }) => Promise<void>;
  save: (issue: Issue) => Promise<void>;
};
