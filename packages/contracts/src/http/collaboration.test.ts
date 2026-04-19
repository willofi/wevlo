import { describe, expect, it } from "vitest";

import {
  createProjectInvitationRequestSchema,
  createWorkspaceInvitationRequestSchema
} from "./collaboration";

describe("collaboration contracts", () => {
  it("keeps workspace invitations restricted to workspace roles", () => {
    expect(
      createWorkspaceInvitationRequestSchema.safeParse({
        email: "owner@example.com",
        role: "Owner"
      }).success
    ).toBe(true);

    expect(
      createWorkspaceInvitationRequestSchema.safeParse({
        email: "member@example.com",
        role: "Maintainer"
      }).success
    ).toBe(false);
  });

  it("keeps project invitations restricted to project roles", () => {
    expect(
      createProjectInvitationRequestSchema.safeParse({
        email: "planner@example.com",
        role: "Planner"
      }).success
    ).toBe(true);

    expect(
      createProjectInvitationRequestSchema.safeParse({
        email: "member@example.com",
        role: "Member"
      }).success
    ).toBe(false);
  });
});
