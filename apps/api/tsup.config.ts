import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  bundle: true,
  noExternal: [/^@wevlo\/.*/], // 내부 패키지만 번들링
  shims: true,
  outDir: "dist",
  platform: "node",
  sourcemap: true,
});
