import { afterEach, describe, expect, it, vi } from "vitest";

import { requireRuntimeEnv, validateApiRuntimeEnv } from "./config";

describe("runtime env validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires explicitly required variables", () => {
    vi.stubEnv("WEVLO_INTERNAL_AUTH_TOKEN", "");
    expect(() => requireRuntimeEnv("WEVLO_INTERNAL_AUTH_TOKEN")).toThrow(/WEVLO_INTERNAL_AUTH_TOKEN/);
    vi.stubEnv("WEVLO_INTERNAL_AUTH_TOKEN", "secret");
    expect(requireRuntimeEnv("WEVLO_INTERNAL_AUTH_TOKEN")).toBe("secret");
  });

  it("allows default database URL only when dev auth is enabled", () => {
    vi.stubEnv("WEVLO_INTERNAL_AUTH_TOKEN", "secret");
    vi.stubEnv("ALLOW_DEV_AUTH", "true");

    expect(() => validateApiRuntimeEnv()).not.toThrow();

    vi.stubEnv("ALLOW_DEV_AUTH", "false");
    vi.stubEnv("DATABASE_URL", "");

    expect(() => validateApiRuntimeEnv()).toThrow(/DATABASE_URL/);
  });
});
