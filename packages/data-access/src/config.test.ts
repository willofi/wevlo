import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { findNearestEnvPath, requireRuntimeEnv, validateApiRuntimeEnv } from "./config";

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

describe("env path discovery", () => {
  const tempRoot = join(process.cwd(), ".tmp-config-test");

  afterEach(() => {
    rmSync(tempRoot, { force: true, recursive: true });
  });

  it("walks up parent directories to find the nearest root env file", () => {
    const nestedDir = join(tempRoot, "apps", "api");
    mkdirSync(nestedDir, { recursive: true });
    const envPath = join(tempRoot, ".env.local");
    writeFileSync(envPath, "WEVLO_INTERNAL_AUTH_TOKEN=test\n");

    expect(findNearestEnvPath(nestedDir)).toBe(envPath);
  });

  it("supports custom env file names", () => {
    const nestedDir = join(tempRoot, "apps", "web");
    mkdirSync(nestedDir, { recursive: true });
    const envLocalPath = join(tempRoot, ".env.local.local");
    writeFileSync(envLocalPath, "WEVLO_INTERNAL_AUTH_TOKEN=test\n");

    expect(findNearestEnvPath(nestedDir, ".env.local.local")).toBe(envLocalPath);
  });
});
