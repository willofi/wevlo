import { describe, expect, it, vi } from "vitest";
import type { ProjectId } from "@wevlo/core";

import { createIssue } from "../domain/issue";
import { acceptTriageUseCase } from "./accept-triage";
import { commentOnIssueUseCase } from "./comment-on-issue";
import { createIssueUseCase } from "./create-issue";
import { getIssueBoardUseCase } from "./get-issue-board";
import { getIssueUseCase } from "./get-issue";
import { listIssuesUseCase } from "./list-issues";
import { resolveProjectBoardViewUseCase } from "./resolve-project-board-view";
import { transitionIssueUseCase } from "./transition-issue";
import { triageIssueUseCase } from "./triage-issue";
import { updateIssueUseCase } from "./update-issue";

const makeRepository = () => {
  const issues = new Map<string, ReturnType<typeof createIssue>>();
  const numbers = new Map<string, number>();

  return {
    findByKey: vi.fn(async (projectId: string, issueKey: string) => {
      return issues.get(`${projectId}:${issueKey}`) ?? null;
    }),
    findBySourceLink: vi.fn(async (input: {
      projectId: string;
      provider: string;
      externalId: string;
      installationId?: string;
    }) => {
      return (
        [...issues.values()].find(
          (issue) =>
            issue.projectId === input.projectId &&
            issue.sourceLinks.some(
              (sourceLink) =>
                sourceLink.provider === input.provider &&
                sourceLink.externalId === input.externalId &&
                (input.installationId === undefined || sourceLink.installationId === input.installationId)
            )
        ) ?? null
      );
    }),
    listByProject: vi.fn(async (projectId: string) => {
      return [...issues.values()].filter((issue) => issue.projectId === projectId);
    }),
    nextIssueNumber: vi.fn(async (projectId: string) => {
      const next = (numbers.get(projectId) ?? 0) + 1;
      numbers.set(projectId, next);
      return next;
    }),
    save: vi.fn(async (issue: ReturnType<typeof createIssue>) => {
      issues.set(`${issue.projectId}:${issue.issueKey}`, issue);
    }),
    seed: (issue: ReturnType<typeof createIssue>) => {
      issues.set(`${issue.projectId}:${issue.issueKey}`, issue);
    }
  };
};

describe("issue application use cases", () => {
  it("creates and looks up issues using project keys and issue numbers", async () => {
    const repository = makeRepository();

    const issue = await createIssueUseCase(repository, {
      projectId: "project_1" as ProjectId,
      projectKey: "plat",
      reporterUserId: "user_1",
      title: "Investigate broken sync"
    });

    expect(issue.issueNumber).toBe(1);
    expect(issue.issueKey).toBe("PLAT-1");
    expect(repository.save).toHaveBeenCalledTimes(1);

    const detail = await getIssueUseCase(repository, {
      issueKey: issue.issueKey,
      projectId: issue.projectId
    });

    expect(detail?.issueKey).toBe("PLAT-1");
  });

  it("lists issues and groups them on the board by state", async () => {
    const repository = makeRepository();

    repository.seed(
      createIssue({
        issueNumber: 3,
        projectId: "project_1" as ProjectId,
        reporterUserId: "user_1",
        title: "Done issue",
        state: "done"
      })
    );
    repository.seed(
      createIssue({
        issueNumber: 1,
        projectId: "project_1" as ProjectId,
        reporterUserId: "user_1",
        title: "Backlog issue"
      })
    );

    const list = await listIssuesUseCase(repository, { projectId: "project_1" });
    const board = await getIssueBoardUseCase(repository, { projectId: "project_1" });

    expect(list).toHaveLength(2);
    expect(list[0]?.issueNumber).toBe(1);
    expect(board.find((column) => column.state === "backlog")?.issues).toHaveLength(1);
    expect(board.find((column) => column.state === "done")?.issues[0]?.issueNumber).toBe(3);
  });

  it("resolves a board view with custom column labels and accepted issues only", async () => {
    const repository = makeRepository();
    const accepted = createIssue({
      issueNumber: 1,
      projectId: "project_1" as ProjectId,
      reporterUserId: "user_1",
      title: "Accepted issue",
      description: "Show me on the board",
      state: "todo",
      triageStatus: "accepted"
    });
    const pending = createIssue({
      issueNumber: 2,
      projectId: "project_1" as ProjectId,
      reporterUserId: "user_1",
      title: "Pending issue",
      description: "Hide me from the board",
      state: "todo",
      triageStatus: "pending"
    });

    repository.seed(accepted);
    repository.seed(pending);

    const board = resolveProjectBoardViewUseCase(await repository.listByProject("project_1"), {
      projectId: "project_1",
      columns: [
        { state: "todo", label: "Queued", order: 0, accent: "blue" },
        { state: "backlog", label: "Backlog", order: 1, accent: "slate" },
        { state: "in_progress", label: "In progress", order: 2, accent: "amber" },
        { state: "done", label: "Done", order: 3, accent: "teal" },
        { state: "canceled", label: "Canceled", order: 4, accent: "rose" }
      ]
    });

    expect(board.columns[0]?.label).toBe("Queued");
    expect(board.columns[0]?.issues).toHaveLength(1);
    expect(board.columns[0]?.issues[0]?.description).toBe("Show me on the board");
  });

  it("updates only allowed fields for the actor and preserves the domain rules", async () => {
    const repository = makeRepository();
    const issue = createIssue({
      issueNumber: 5,
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
    repository.seed(issue);

    const updated = await updateIssueUseCase(repository, {
      actor: "local",
      changes: {
        assigneeUserId: "user_2",
        priority: "high"
      },
      issueKey: issue.issueKey,
      projectId: issue.projectId
    });

    expect(updated.priority).toBe("high");
    expect(updated.assigneeUserId).toBe("user_2");

    await expect(
      updateIssueUseCase(repository, {
        actor: "local",
        changes: {
          title: "Renamed"
        },
        issueKey: issue.issueKey,
        projectId: issue.projectId
      })
    ).rejects.toThrowError(/cannot be mutated/i);
  });

  it("transitions issues, appends comments, and manages triage", async () => {
    const repository = makeRepository();
    const issue = createIssue({
      issueNumber: 9,
      projectId: "project_1" as ProjectId,
      reporterUserId: "user_1",
      title: "Imported issue",
      sourceLinks: [
        {
          externalId: "123",
          provider: "github",
          sourceOfTruth: "remote"
        }
      ]
    });
    repository.seed(issue);

    const transitioned = await transitionIssueUseCase(repository, {
      actor: "remote",
      issueKey: issue.issueKey,
      nextState: "todo",
      projectId: issue.projectId
    });

    expect(transitioned.state).toBe("todo");

    const commented = await commentOnIssueUseCase(repository, {
      authorUserId: "user_2",
      body: "  Please inspect  ",
      issueKey: issue.issueKey,
      projectId: issue.projectId
    });

    expect(commented.comments).toHaveLength(1);
    expect(commented.comments[0]?.body).toBe("Please inspect");

    const triaged = await triageIssueUseCase(repository, {
      actor: "local",
      assigneeUserId: "user_3",
      issueKey: issue.issueKey,
      priority: "urgent",
      projectId: issue.projectId
    });

    expect(triaged.priority).toBe("urgent");
    expect(triaged.assigneeUserId).toBe("user_3");
    expect(triaged.triageStatus).toBe("pending");

    const accepted = await acceptTriageUseCase(repository, {
      actor: "local",
      issueKey: issue.issueKey,
      projectId: issue.projectId
    });

    expect(accepted.triageStatus).toBe("accepted");
  });
});
