import { describe, expect, it } from "vitest";

import { buildInternalAuthHeaders, buildLoginHref, getDemoUser, isWorkspaceVisible, sanitizeReturnPath } from "./session";

describe("auth session helpers", () => {
  it("looks up demo users by id", () => {
    const user = getDemoUser("user_demo_owner");

    expect(user?.name).toBe("Demo Owner");
    expect(user?.role).toBe("Owner");
  });

  it("guards against open redirects", () => {
    expect(sanitizeReturnPath("https://example.com")).toBe("/");
    expect(sanitizeReturnPath("//evil.example")).toBe("/");
    expect(sanitizeReturnPath("/workspace/atlas")).toBe("/workspace/atlas");
  });

  it("requires the workspace slug to be present in the session scope", () => {
    expect(
      isWorkspaceVisible(
        {
          workspaceSlugs: ["atlas"]
        },
        "atlas"
      )
    ).toBe(true);
    expect(
      isWorkspaceVisible(
        {
          workspaceSlugs: []
        },
        "atlas"
      )
    ).toBe(false);
  });

  it("builds a login href with an encoded return path", () => {
    expect(buildLoginHref("/workspace/atlas")).toBe("/login?next=%2Fworkspace%2Fatlas");
  });

  it("builds internal auth headers from a session", () => {
    expect(
      buildInternalAuthHeaders(
        {
          provider: "google",
          providerUserId: "google-123",
          userEmail: "owner@example.com",
          userId: "user_1",
          userName: "Owner"
        },
        "secret-token"
      )
    ).toMatchObject({
      "x-wevlo-auth-provider": "google",
      "x-wevlo-internal-token": "secret-token",
      "x-wevlo-provider-user-id": "google-123",
      "x-wevlo-user-email": "owner@example.com",
      "x-wevlo-user-id": "user_1",
      "x-wevlo-user-name": "Owner"
    });
  });
});
