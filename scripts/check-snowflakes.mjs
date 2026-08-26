import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const skipDir = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  "prisma",
]);
const skipFile = new Set(["package-lock.json", "package.json"]);
const snowflake = /\b[0-9]{17,19}\b/;
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skipDir.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (skipFile.has(name)) continue;
    if (!/\.(ts|js|mjs|cjs|json|yml|yaml|env|md)$/.test(name) && name !== ".env.example") {
      continue;
    }
    const text = readFileSync(full, "utf8");
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (snowflake.test(line)) {
        hits.push(`${relative(root, full)}:${i + 1}:${line.trim()}`);
      }
    });
  }
}

walk(root);
if (hits.length) {
  console.error("Hardcoded snowflake-like IDs:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("No hardcoded snowflakes.");
