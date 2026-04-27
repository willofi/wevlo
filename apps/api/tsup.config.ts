import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  bundle: true,
  noExternal: [/^@wevlo\/.*/],
  external: [
    "fastify",
    "pg",
    "kysely",
    "zod",
    "dotenv",
    "@fastify/cors",
    "@fastify/multipart",
    "@aws-sdk/client-s3"
  ],
  shims: true,
  outDir: "dist",
  platform: "node",
  sourcemap: true,
});
