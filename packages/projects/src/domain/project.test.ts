import { describe, expect, it } from "vitest";
import type { WorkspaceId } from "@wevlo/core";

import { createProject } from "./project";

describe("createProject", () => {
  it("defaults projects to private visibility and owner membership", () => {
    const project = createProject({
      workspaceId: "workspace_1" as WorkspaceId,
      name: "Platform",
      key: "plat",
      ownerUserId: "user_1"
    });

    expect(project.visibility).toBe("private");
    expect(project.memberships[0]?.role).toBe("Owner");
    expect(project.key).toBe("PLAT");
  });
});
