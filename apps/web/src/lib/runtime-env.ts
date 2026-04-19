import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { loadEnvFile } from "node:process";

const findNearestEnvPath = (startDir: string = process.cwd()): string | null => {
  let currentDir = startDir;
  const { root } = parse(startDir);

  while (true) {
    const candidate = join(currentDir, ".env");

    if (existsSync(candidate)) {
      return candidate;
    }

    if (currentDir === root) {
      return null;
    }

    currentDir = dirname(currentDir);
  }
};

const envPath = findNearestEnvPath();

if (envPath) {
  loadEnvFile(envPath);
}

export const isDevAuthEnabled = (): boolean => {
  return process.env.ALLOW_DEV_AUTH === "1" || process.env.ALLOW_DEV_AUTH === "true";
};

export const isGoogleOAuthConfigured = (): boolean => {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
};

export const getAuthSecret = (): string => {
  return process.env.AUTH_SECRET ?? "wevlo-dev-auth-secret";
};

export const getInternalAuthToken = (): string => {
  return process.env.WEVLO_INTERNAL_AUTH_TOKEN ?? "wevlo-internal-dev-token";
};

export const getWebApiBaseUrl = (): string => {
  return process.env.WEVLO_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";
};
