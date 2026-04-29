import { describe, expect, it, vi } from "vitest";
import type { ProjectId } from "@wevlo/core";

import { createIssue } from "../domain/issue";
import { toIssueListItem } from "./issue-views";
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
    addReaction: vi.fn(),
    appendComment: vi.fn(async (input: {
      comment: ReturnType<typeof createIssue>["comments"][number];
      issueId: string;
      updatedAt: string;
    }) => {
      const issue = [...issues.values()].find((candidate) => candidate.id === input.issueId);
      if (!issue) {
        throw new Error(`Issue not found: ${input.issueId}`);
      }

      issues.set(`${issue.projectId}:${issue.issueKey}`, {
        ...issue,
        comments: [...issue.comments, input.comment],
        updatedAt: input.updatedAt
      });
    }),
    createAttachment: vi.fn(),
    createLabel: vi.fn(),
    deleteAttachment: vi.fn(),
    ensureDefaultLabels: vi.fn(),
    ensureSubscriptions: vi.fn(),
    findByKey: vi.fn(async (projectId: string, issueKey: string) => {
      return issues.get(`${projectId}:${issueKey}`) ?? null;
    }),
    findAttachment: vi.fn(),
    findIssueIdentityByKey: vi.fn(async (projectId: string, issueKey: string) => {
      const issue = issues.get(`${projectId}:${issueKey}`) ?? null;
      if (!issue) {
        return null;
      }

      return {
        assigneeUserId: issue.assigneeUserId,
        dueDate: issue.dueDate,
        id: issue.id,
        issueKey: issue.issueKey,
        parentIssueId: issue.parentIssueId,
        priority: issue.priority,
        projectId: issue.projectId,
        reporterUserId: issue.reporterUserId,
        state: issue.state,
        title: issue.title,
        triageStatus: issue.triageStatus
      };
    }),
    findLabelsByIds: vi.fn(async () => []),
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
    getSubscriptionState: vi.fn(),
    hasReaction: vi.fn(async () => false),
    listByProject: vi.fn(async (projectId: string) => {
      return [...issues.values()].filter((issue) => issue.projectId === projectId);
    }),
    listIssueSummariesByProject: vi.fn(async (input: {
      projectId: string;
      scope?: "all" | "assigned" | "created";
      userId?: string;
    }) => {
      return [...issues.values()]
        .filter((issue) => issue.projectId === input.projectId)
        .filter((issue) => {
          if (input.scope === "assigned") {
            return issue.assigneeUserId === input.userId;
          }

          if (input.scope === "created") {
            return issue.reporterUserId === input.userId;
          }

          return true;
        })
        .map(toIssueListItem);
    }),
    listLabels: vi.fn(async () => []),
    nextIssueNumber: vi.fn(async (projectId: string) => {
      const next = (numbers.get(projectId) ?? 0) + 1;
      numbers.set(projectId, next);
      return next;
    }),
    removeReaction: vi.fn(),
    save: vi.fn(async (issue: ReturnType<typeof createIssue>) => {
      issues.set(`${issue.projectId}:${issue.issueKey}`, issue);
    }),
    setSubscription: vi.fn(),
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

  it("creates and updates issue metadata for labels and due dates", async () => {
    const repository = makeRepository();
    const labels = [
      {
        id: "label_bug",
        projectId: "project_1",
        name: "Bug",
        color: "red",
        createdAt: "2026-04-25T00:00:00.000Z",
        updatedAt: "2026-04-25T00:00:00.000Z"
      },
      {
        id: "label_feature",
        projectId: "project_1",
        name: "Feature",
        color: "violet",
        createdAt: "2026-04-25T00:00:00.000Z",
        updatedAt: "2026-04-25T00:00:00.000Z"
      }
    ];

    const issue = await createIssueUseCase(repository, {
      assigneeUserId: "user_2",
      dueDate: "2026-05-01",
      labels: [labels[0]!],
      priority: "high",
      projectId: "project_1" as ProjectId,
      projectKey: "plat",
      reporterUserId: "user_1",
      state: "todo",
      title: "Track richer metadata"
    });

    expect(issue.assigneeUserId).toBe("user_2");
    expect(issue.dueDate).toBe("2026-05-01");
    expect(issue.labels.map((label) => label.id)).toEqual(["label_bug"]);
    expect(issue.priority).toBe("high");
    expect(issue.state).toBe("todo");

    const updated = await updateIssueUseCase(repository, {
      actor: "local",
      changes: {
        dueDate: null,
        labels: [labels[1]!]
      },
      issueKey: issue.issueKey,
      projectId: issue.projectId
    });

    expect(updated.issue.dueDate).toBeNull();
    expect(updated.issue.labels.map((label) => label.id)).toEqual(["label_feature"]);
  });

  it("creates a sub-issue linked to its parent issue", async () => {
    const repository = makeRepository();
    const parent = await createIssueUseCase(repository, {
      projectId: "project_1" as ProjectId,
      projectKey: "plat",
      reporterUserId: "user_1",
      title: "Parent issue"
    });

    const child = await createIssueUseCase(repository, {
      parentIssueId: parent.id,
      projectId: "project_1" as ProjectId,
      projectKey: "plat",
      reporterUserId: "user_1",
      title: "Child issue"
    });

    expect(child.parentIssueId).toBe(parent.id);
    expect(child.parent).toBeNull();
    expect(child.subIssues).toEqual([]);
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
        { state: "todo", label: "Queued", order: 0, accent: "blue", iconKey: "list_todo" },
        { state: "backlog", label: "Backlog", order: 1, accent: "slate", iconKey: "circle_dashed" },
        { state: "in_progress", label: "In progress", order: 2, accent: "amber", iconKey: "loader_circle" },
        { state: "done", label: "Done", order: 3, accent: "teal", iconKey: "check_circle_2" },
        { state: "canceled", label: "Canceled", order: 4, accent: "rose", iconKey: "ban" }
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

    expect(updated.issue.priority).toBe("high");
    expect(updated.issue.assigneeUserId).toBe("user_2");

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

    expect(commented.issue.comments).toHaveLength(1);
    expect(commented.issue.comments[0]?.body).toBe("Please inspect");

    const triaged = await triageIssueUseCase(repository, {
      actor: "local",
      assigneeUserId: "user_3",
      issueKey: issue.issueKey,
      priority: "urgent",
      projectId: issue.projectId
    });

    expect(triaged.issue.priority).toBe("urgent");
    expect(triaged.issue.assigneeUserId).toBe("user_3");
    expect(triaged.issue.triageStatus).toBe("pending");

    const accepted = await acceptTriageUseCase(repository, {
      actor: "local",
      issueKey: issue.issueKey,
      projectId: issue.projectId
    });

    expect(accepted.triageStatus).toBe("accepted");
  });
});
