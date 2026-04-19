import { describe, expect, it } from "vitest";
import type { IssueId, ProjectId } from "@wevlo/core";

import {
  applyIssuePatch,
  buildIssueKey,
  canMutateIssueField,
  createIssue,
  createIssueComment,
  getIssueSourceScope,
  isIssueTransitionAllowed,
  transitionIssue
} from "./issue";

describe("issue aggregate", () => {
  it("creates issues with number, key, and default workflow fields", () => {
    const issue = createIssue({
      description: "A broken sync should be investigated",
      issueNumber: 12,
      projectId: "project_1" as ProjectId,
      projectKey: "plat",
      reporterUserId: "user_1",
      title: "Investigate broken sync"
    });

    expect(issue.issueNumber).toBe(12);
    expect(issue.issueKey).toBe("PLAT-12");
    expect(issue.priority).toBe("none");
    expect(issue.triageStatus).toBe("accepted");
    expect(issue.comments).toHaveLength(0);
  });

  it("builds readable issue keys from project keys", () => {
    expect(buildIssueKey("Platform Core", 7)).toBe("PLATFORM-CORE-7");
  });

  it("allows moving between any different workflow states", () => {
    const issue = createIssue({
      issueNumber: 1,
      projectId: "project_1" as ProjectId,
      reporterUserId: "user_1",
      title: "Investigate broken sync"
    });

    expect(isIssueTransitionAllowed(issue.state, "todo")).toBe(true);
    expect(isIssueTransitionAllowed(issue.state, "done")).toBe(true);
    expect(isIssueTransitionAllowed("in_progress", "todo")).toBe(true);
    expect(transitionIssue(issue, "done").state).toBe("done");
  });

  it("supports local-only triage on remote-owned issues", () => {
    const issue = createIssue({
      issueNumber: 4,
      projectId: "project_1" as ProjectId,
      reporterUserId: "user_1",
      sourceLinks: [
        {
          externalId: "123",
          provider: "github",
          sourceOfTruth: "remote"
        }
      ],
      title: "Imported issue"
    });

    expect(getIssueSourceScope(issue)).toBe("remote");
    expect(canMutateIssueField(issue, "priority", "local")).toBe(true);
    expect(canMutateIssueField(issue, "triageStatus", "local")).toBe(true);
    expect(canMutateIssueField(issue, "title", "local")).toBe(false);
    expect(canMutateIssueField(issue, "title", "remote")).toBe(true);
    expect(canMutateIssueField(issue, "state", "remote")).toBe(true);
  });

  it("applies patches only when the actor is allowed to change the field", () => {
    const issue = createIssue({
      issueNumber: 8,
      projectId: "project_1" as ProjectId,
      reporterUserId: "user_1",
      sourceLinks: [
        {
          externalId: "123",
          provider: "github",
          sourceOfTruth: "remote"
        }
      ],
      title: "Imported issue"
    });

    const triaged = applyIssuePatch(issue, { priority: "high", assigneeUserId: "user_2" }, "local");

    expect(triaged.priority).toBe("high");
    expect(triaged.assigneeUserId).toBe("user_2");
    expect(() => applyIssuePatch(issue, { title: "Renamed" }, "local")).toThrowError(/cannot be mutated/i);
  });

  it("creates comments with trimmed bodies", () => {
    const comment = createIssueComment({
      authorUserId: "user_1",
      body: "  Looks good  ",
      issueId: "issue_1" as IssueId
    });

    expect(comment.body).toBe("Looks good");
  });
});
