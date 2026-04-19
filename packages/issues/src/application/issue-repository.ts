import type { Issue } from "../domain/issue";

export type IssueRepository = {
  findByKey: (projectId: string, issueKey: string) => Promise<Issue | null>;
  findBySourceLink: (input: {
    projectId: string;
    provider: Issue["sourceLinks"][number]["provider"];
    externalId: string;
    installationId?: string;
  }) => Promise<Issue | null>;
  listByProject: (projectId: string) => Promise<Issue[]>;
  nextIssueNumber: (projectId: string) => Promise<number>;
  save: (issue: Issue) => Promise<void>;
};
