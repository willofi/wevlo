import { describe, expect, it } from "vitest";

import { can, canWorkspace } from "./policy";

describe("authorization policy", () => {
  it("lets owners view, invite, and manage the workspace", () => {
    expect(canWorkspace("Owner", "workspace.view")).toBe(true);
    expect(canWorkspace("Owner", "workspace.invite")).toBe(true);
    expect(canWorkspace("Owner", "workspace.manage")).toBe(true);
  });

  it("keeps developers on read-only workspace access", () => {
    expect(canWorkspace("Developer", "workspace.view")).toBe(true);
    expect(canWorkspace("Developer", "workspace.invite")).toBe(false);
    expect(canWorkspace("Developer", "workspace.manage")).toBe(false);
  });

  it("keeps members in read-only workspace access", () => {
    expect(canWorkspace("Member", "workspace.view")).toBe(true);
    expect(canWorkspace("Member", "workspace.invite")).toBe(false);
    expect(canWorkspace("Member", "workspace.manage")).toBe(false);
  });

  it("lets owners delete projects", () => {
    expect(can("Owner", "project.delete")).toBe(true);
  });

  it("prevents developers from managing integrations", () => {
    expect(can("Developer", "integration.manage")).toBe(false);
  });

  it("lets planners prioritize work without workspace administration", () => {
    expect(can("Planner", "issue.prioritize")).toBe(true);
    expect(can("Planner", "issue.edit")).toBe(true);
  });
});
