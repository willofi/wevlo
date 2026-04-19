import { describe, expect, it } from "vitest";
import type { WorkspaceId } from "@wevlo/core";

import {
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  isWorkspaceInvitationExpired,
  revokeWorkspaceInvitation
} from "./workspace-invitation";

describe("workspace invitation domain", () => {
  it("creates pending invitations with an accept token and expiry", () => {
    const invitation = createWorkspaceInvitation({
      inviteeEmail: "teammate@example.com",
      invitedByUserId: "user_owner",
      role: "Member",
      workspaceId: "workspace_1" as WorkspaceId
    });

    expect(invitation.status).toBe("pending");
    expect(invitation.acceptToken).toMatch(/^invite_token_/);
    expect(new Date(invitation.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("marks accepted invitations as consumed", () => {
    const invitation = createWorkspaceInvitation({
      invitedByUserId: "user_owner",
      role: "Member",
      workspaceId: "workspace_1" as WorkspaceId
    });

    const accepted = acceptWorkspaceInvitation(invitation, "user_member");

    expect(accepted.status).toBe("accepted");
    expect(accepted.acceptedByUserId).toBe("user_member");
    expect(accepted.acceptToken).toBeNull();
    expect(accepted.acceptedAt).not.toBeNull();
  });

  it("can revoke and expire invitations", () => {
    const invitation = createWorkspaceInvitation({
      invitedByUserId: "user_owner",
      role: "Owner",
      workspaceId: "workspace_1" as WorkspaceId
    });

    const revoked = revokeWorkspaceInvitation(invitation);

    expect(revoked.status).toBe("revoked");
    expect(revoked.acceptToken).toBeNull();
    expect(
      isWorkspaceInvitationExpired(
        {
          ...invitation,
          expiresAt: "2020-01-01T00:00:00.000Z"
        },
        new Date("2020-01-02T00:00:00.000Z")
      )
    ).toBe(true);
  });
});
