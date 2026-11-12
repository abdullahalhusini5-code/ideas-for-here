#!/usr/bin/env node
/* Checks ideas.json against ideas.schema.json, and the schema against itself.
 *
 *   node tools/check-schema.mjs           check the real catalog
 *   node tools/check-schema.mjs FILE...   check other catalogs (e.g. a fixture)
 *
 * No dependencies, no network. `validateCatalog()` in mcp/core.mjs stays the
 * runtime authority; this is the published contract in executable form.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate, lintSchema } from "./schema-lite.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_FILE = path.join(ROOT, "ideas.schema.json");

const schema = JSON.parse(fs.readFileSync(SCHEMA_FILE, "utf8"));
const schemaErrors = lintSchema(schema);
if (schemaErrors.length) {
  console.log(`ideas.schema.json is not usable (${schemaErrors.length}):`);
  schemaErrors.forEach((e) => console.log("  - " + e));
  process.exit(1);
}

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [path.join(ROOT, "ideas.json")];

let failed = false;
for (const target of targets) {
  const label = path.relative(ROOT, path.resolve(target)) || target;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.resolve(target), "utf8"));
  } catch (err) {
    console.log(`${label}: cannot read (${err.message})`);
    failed = true;
    continue;
  }
  const errors = validate(data, schema);
  if (errors.length) {
    failed = true;
    console.log(`${label}: ${errors.length} problem${errors.length === 1 ? "" : "s"}`);
    errors.slice(0, 40).forEach((e) => console.log("  - " + e));
    if (errors.length > 40) console.log(`  … and ${errors.length - 40} more`);
  } else {
    const ideas = Array.isArray(data.ideas) ? data.ideas.length : 0;
    console.log(`${label}: OK — schema keywords all supported, ${ideas} ideas conform`);
  }
}

process.exit(failed ? 1 : 0);
