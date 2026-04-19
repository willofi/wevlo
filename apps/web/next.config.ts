import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const appDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(appDir, "../..");

loadEnvConfig(workspaceRoot);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@wevlo/auth", "@wevlo/contracts", "@wevlo/ui-core", "@wevlo/ui-web"]
};

export default nextConfig;
