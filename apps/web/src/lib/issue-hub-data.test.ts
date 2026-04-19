import { describe, expect, it } from "vitest";

import { getProjectHref } from "@/lib/issue-hub-data";

describe("getProjectHref", () => {
  it("uses the project root as the canonical issues home", () => {
    expect(getProjectHref("atlas", "HUB")).toBe("/atlas/HUB");
    expect(getProjectHref("atlas", "HUB", "issues")).toBe("/atlas/HUB");
  });

  it("keeps non-issues routes addressable", () => {
    expect(getProjectHref("atlas", "HUB", "board")).toBe("/atlas/HUB/board");
    expect(getProjectHref("atlas", "HUB", "triage")).toBe("/atlas/HUB/triage");
    expect(getProjectHref("atlas", "HUB", "new")).toBe("/atlas/HUB/issues/new");
  });
});
