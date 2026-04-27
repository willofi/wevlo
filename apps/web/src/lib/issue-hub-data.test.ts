import { describe, expect, it } from "vitest";

import { getProjectHref } from "./issue-hub-data";

describe("getProjectHref", () => {
  it("uses the project root as the canonical issues home", () => {
    expect(getProjectHref("atlas", "HUB")).toBe("/atlas/HUB");
    expect(getProjectHref("atlas", "HUB", "issues")).toBe("/atlas/HUB?view=list");
  });

  it("maps shell views and compose state to query params", () => {
    expect(getProjectHref("atlas", "HUB", "board")).toBe("/atlas/HUB?view=board");
    expect(getProjectHref("atlas", "HUB", "triage")).toBe("/atlas/HUB");
    expect(getProjectHref("atlas", "HUB", "new")).toBe("/atlas/HUB?compose=1");
  });
});
