import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";

import { getRequestIdentity } from "./dev-session.js";
import { UnauthorizedError } from "./errors.js";

const buildRequest = (headers: Record<string, string | string[] | undefined>): FastifyRequest =>
  ({
    headers
  }) as FastifyRequest;

describe("getRequestIdentity", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    process.env.WEVLO_INTERNAL_AUTH_TOKEN = "internal-secret";
    delete process.env.ALLOW_DEV_AUTH;
    delete process.env.WEVLO_DEV_USER_ID;
  });

  it("accepts authenticated internal headers", () => {
    const identity = getRequestIdentity(
      buildRequest({
        "x-wevlo-auth-provider": "google",
        "x-wevlo-internal-token": "internal-secret",
        "x-wevlo-provider-user-id": "google-123",
        "x-wevlo-user-email": "owner@example.com",
        "x-wevlo-user-id": "user_1",
        "x-wevlo-user-name": "Owner"
      })
    );

    expect(identity).toMatchObject({
      email: "owner@example.com",
      name: "Owner",
      provider: "google",
      providerUserId: "google-123",
      userIdHint: "user_1"
    });
  });

  it("falls back to dev auth only when explicitly enabled", () => {
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.WEVLO_DEV_USER_ID = "user_demo_owner";

    const identity = getRequestIdentity(
      buildRequest({
        "x-dev-user-id": "user_ava"
      })
    );

    expect(identity).toMatchObject({
      email: null,
      name: "user_ava",
      provider: "dev",
      providerUserId: "user_ava"
    });
  });

  it("rejects requests without valid auth context", () => {
    expect(() => getRequestIdentity(buildRequest({}))).toThrow(UnauthorizedError);
  });
});
