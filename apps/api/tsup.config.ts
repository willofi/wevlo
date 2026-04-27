import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  bundle: true,
  noExternal: [/^@wevlo\/.*/],
  shims: true,
  outDir: "dist",
  platform: "node",
  sourcemap: true,
});
