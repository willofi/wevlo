import { describe, expect, it } from "vitest";

import { createProjectRequestSchema } from "./project";
import { createWorkspaceRequestSchema } from "./workspace";

describe("workspace and project creation contracts", () => {
  it("allows workspace creation without an explicit slug", () => {
    expect(
      createWorkspaceRequestSchema.safeParse({
        name: "Atlas Labs"
      }).success
    ).toBe(true);
  });

  it("allows project creation without an explicit key", () => {
    expect(
      createProjectRequestSchema.safeParse({
        name: "Issue Hub"
      }).success
    ).toBe(true);
  });
});
