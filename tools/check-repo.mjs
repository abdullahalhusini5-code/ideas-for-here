#!/usr/bin/env node
/* Checks the promises the repo makes about itself.
 *
 *   1. The test count quoted in prose matches the number of tests the suite declares.
 *   2. The package has no runtime dependencies, and every dev dependency is pinned.
 *   3. The lockfile CI installs from is present.
 *
 * No dependencies, no network, fast enough to run on every push.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const problems = [];

/* ---------- 1. the quoted test count ---------- */

const suite = read("tools/test-mcp.mjs");
const declared = (suite.match(/^\s*await test\(/gm) || []).length;

const claims = [
  ["README.md", /(\d+) checks/g],
  ["mcp/README.md", /(\d+) checks/g],
  ["brain.html", /(\d+) passed/g]
];

for (const [file, pattern] of claims) {
  const found = [...read(file).matchAll(pattern)].map((m) => Number(m[1]));
  if (!found.length) {
    problems.push(`${file}: no "N ${pattern.source.includes("passed") ? "passed" : "checks"}" claim found — the wording changed, so this check went blind`);
  }
  for (const n of found) {
    if (n !== declared) problems.push(`${file}: says ${n}, but the suite declares ${declared} tests`);
  }
}

/* ---------- 2. dependency policy ---------- */

const pkg = JSON.parse(read("package.json"));
const runtime = Object.keys(pkg.dependencies || {});
if (runtime.length) {
  problems.push(`runtime dependencies are forbidden, found: ${runtime.join(", ")}`);
}
for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    problems.push(`dev dependency ${name} is not pinned to an exact version (${version})`);
  }
}

/* ---------- 3. lockfile ---------- */

if (!fs.existsSync(path.join(ROOT, "package-lock.json"))) {
  problems.push("package-lock.json is missing; CI installs with npm ci");
}

/* ---------- report ---------- */

if (problems.length) {
  console.log(`check-repo: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}

const dev = Object.keys(pkg.devDependencies || {}).length;
console.log(`check-repo: OK — ${declared} tests, ${claims.length} quoted counts agree, 0 runtime deps, ${dev} pinned dev deps`);
