import { describe, expect, it, vi } from "vitest";

import { createProjectUseCase } from "./create-project";

describe("createProjectUseCase", () => {
  it("persists a project for a workspace member", async () => {
    const save = vi.fn().mockResolvedValue(undefined);

    const project = await createProjectUseCase(
      {
        findByKey: vi.fn().mockResolvedValue(null),
        isWorkspaceMember: vi.fn().mockResolvedValue(true),
        save
      },
      {
        key: "plat",
        name: "Platform",
        ownerUserId: "user_1",
        workspaceId: "workspace_1"
      }
    );

    expect(project.key).toBe("PLAT");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("generates a project key from the project name when omitted", async () => {
    const project = await createProjectUseCase(
      {
        findByKey: vi.fn().mockResolvedValue(null),
        isWorkspaceMember: vi.fn().mockResolvedValue(true),
        save: vi.fn().mockResolvedValue(undefined)
      },
      {
        name: "Issue Hub",
        ownerUserId: "user_1",
        workspaceId: "workspace_1"
      }
    );

    expect(project.key).toBe("IH");
  });

  it("retries generated project keys when the first candidate is taken", async () => {
    const findByKey = vi
      .fn()
      .mockResolvedValueOnce({
        createdAt: "2026-04-04T00:00:00.000Z",
        id: "project_existing",
        key: "IH",
        memberships: [],
        name: "Existing",
        updatedAt: "2026-04-04T00:00:00.000Z",
        visibility: "private",
        workspaceId: "workspace_1"
      })
      .mockResolvedValueOnce(null);

    const project = await createProjectUseCase(
      {
        findByKey,
        isWorkspaceMember: vi.fn().mockResolvedValue(true),
        save: vi.fn().mockResolvedValue(undefined)
      },
      {
        name: "Issue Hub",
        ownerUserId: "user_1",
        workspaceId: "workspace_1"
      }
    );

    expect(project.key).toBe("IH2");
  });

  it("rejects duplicate explicit project keys", async () => {
    await expect(
      createProjectUseCase(
        {
          findByKey: vi.fn().mockResolvedValue({
            createdAt: "2026-04-04T00:00:00.000Z",
            id: "project_existing",
            key: "PLAT",
            memberships: [],
            name: "Existing",
            updatedAt: "2026-04-04T00:00:00.000Z",
            visibility: "private",
            workspaceId: "workspace_1"
          }),
          isWorkspaceMember: vi.fn().mockResolvedValue(true),
          save: vi.fn()
        },
        {
          key: "plat",
          name: "Platform",
          ownerUserId: "user_1",
          workspaceId: "workspace_1"
        }
      )
    ).rejects.toThrowError(/already exists/i);
  });

  it("rejects users outside the workspace", async () => {
    await expect(
      createProjectUseCase(
        {
          findByKey: vi.fn().mockResolvedValue(null),
          isWorkspaceMember: vi.fn().mockResolvedValue(false),
          save: vi.fn()
        },
        {
          key: "plat",
          name: "Platform",
          ownerUserId: "user_1",
          workspaceId: "workspace_1"
        }
      )
    ).rejects.toThrowError(/membership required/i);
  });
});
