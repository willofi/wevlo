import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";

import { config as loadDotenv } from "dotenv";

export const findNearestEnvPath = (
  startDir: string = process.cwd(),
  envFileName: string = ".env.local"
): string | null => {
  let currentDir = startDir;
  const { root } = parse(startDir);

  while (true) {
    const candidate = join(currentDir, envFileName);

    if (existsSync(candidate)) {
      return candidate;
    }

    if (currentDir === root) {
      return null;
    }

    currentDir = dirname(currentDir);
  }
};

const isProductionRuntime = process.env.NODE_ENV === "production";
const envPath = isProductionRuntime
  ? findNearestEnvPath(process.cwd(), ".env.local.production") ?? findNearestEnvPath(process.cwd(), ".env.local")
  : findNearestEnvPath(process.cwd(), ".env.local.local") ?? findNearestEnvPath(process.cwd(), ".env.local");

if (envPath) {
  loadDotenv({ path: envPath });
}

const defaultDatabaseUrl = "postgres://wevlo:wevlo@127.0.0.1:5432/wevlo";

const getNonEmptyEnv = (name: string): string | null => {
  const value = process.env[name];

  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getDatabaseUrl = (): string => {
  return getNonEmptyEnv("DATABASE_URL") ?? defaultDatabaseUrl;
};

export const getDevUserId = (): string => {
  return getNonEmptyEnv("WEVLO_DEV_USER_ID") ?? "user_demo_owner";
};

export const isDevAuthAllowed = (): boolean => {
  const value = getNonEmptyEnv("ALLOW_DEV_AUTH");

  return value === "1" || value === "true";
};

export const getInternalAuthToken = (): string => {
  return getNonEmptyEnv("WEVLO_INTERNAL_AUTH_TOKEN") ?? "wevlo-internal-dev-token";
};

export const requireRuntimeEnv = (name: string): string => {
  const value = getNonEmptyEnv(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const validateApiRuntimeEnv = (): void => {
  requireRuntimeEnv("WEVLO_INTERNAL_AUTH_TOKEN");

  if (!isDevAuthAllowed()) {
    requireRuntimeEnv("DATABASE_URL");
  }
};
