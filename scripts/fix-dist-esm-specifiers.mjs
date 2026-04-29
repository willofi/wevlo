#!/usr/bin/env node

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const targetDir = process.argv[2];

if (!targetDir) {
  console.error("Usage: node scripts/fix-dist-esm-specifiers.mjs <dist-dir>");
  process.exit(1);
}

const root = path.resolve(process.cwd(), targetDir);

const hasFile = async (filePath) => {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
};

const resolveJsSpecifier = async (specifier, baseDir) => {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return specifier;
  }

  if (/\.(c|m)?js$/.test(specifier) || specifier.endsWith(".json") || specifier.endsWith(".node")) {
    return specifier;
  }

  const abs = path.resolve(baseDir, specifier);
  if (await hasFile(`${abs}.js`)) {
    return `${specifier}.js`;
  }
  if (await hasFile(path.join(abs, "index.js"))) {
    return `${specifier}/index.js`;
  }

  return specifier;
};

const rewriteInFile = async (filePath) => {
  const original = await readFile(filePath, "utf8");
  const baseDir = path.dirname(filePath);

  const pattern = /((?:import|export)\s+(?:[^"'`]*?\s+from\s+)?|import\()\s*["'](\.{1,2}\/[^"']+)["']/g;

  let mutated = "";
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(original)) !== null) {
    const [full, prefix, specifier] = match;
    const resolved = await resolveJsSpecifier(specifier, baseDir);
    const replacement = full.replace(specifier, resolved);
    mutated += original.slice(lastIndex, match.index) + replacement;
    lastIndex = match.index + full.length;
  }

  mutated += original.slice(lastIndex);

  if (mutated !== original) {
    await writeFile(filePath, mutated, "utf8");
  }
};

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(entryPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      await rewriteInFile(entryPath);
    }
  }
};

await walk(root);
