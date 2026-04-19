import { describe, expect, it, vi } from "vitest";

import { createWorkspaceUseCase } from "./create-workspace";

describe("createWorkspaceUseCase", () => {
  it("persists a newly created workspace", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saveMembership = vi.fn().mockResolvedValue(undefined);

    const workspace = await createWorkspaceUseCase(
      {
        findBySlug: vi.fn().mockResolvedValue(null),
        save,
        saveMembership
      },
      { name: "Acme", ownerUserId: "user_1", slug: "Acme" }
    );

    expect(workspace.slug).toBe("acme");
    expect(save).toHaveBeenCalledTimes(1);
    expect(saveMembership).toHaveBeenCalledTimes(1);
  });

  it("generates a workspace slug from the name when omitted", async () => {
    const workspace = await createWorkspaceUseCase(
      {
        findBySlug: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(undefined),
        saveMembership: vi.fn().mockResolvedValue(undefined)
      },
      { name: "Atlas Labs", ownerUserId: "user_1" }
    );

    expect(workspace.slug).toBe("atlas-labs");
  });

  it("retries generated workspace slugs when the first candidate is taken", async () => {
    const findBySlug = vi
      .fn()
      .mockResolvedValueOnce({
        createdAt: "2026-04-04T00:00:00.000Z",
        id: "workspace_existing",
        name: "Existing",
        slug: "atlas-labs"
      })
      .mockResolvedValueOnce(null);

    const workspace = await createWorkspaceUseCase(
      {
        findBySlug,
        save: vi.fn().mockResolvedValue(undefined),
        saveMembership: vi.fn().mockResolvedValue(undefined)
      },
      { name: "Atlas Labs", ownerUserId: "user_1" }
    );

    expect(workspace.slug).toBe("atlas-labs-2");
  });

  it("rejects duplicate workspace slugs", async () => {
    await expect(
      createWorkspaceUseCase(
        {
          findBySlug: vi.fn().mockResolvedValue({
            createdAt: "2026-04-04T00:00:00.000Z",
            id: "workspace_existing",
            name: "Existing",
            slug: "acme"
          }),
          save: vi.fn(),
          saveMembership: vi.fn()
        },
        { name: "Acme", ownerUserId: "user_1", slug: "acme" }
      )
    ).rejects.toThrowError(/already exists/);
  });
});
