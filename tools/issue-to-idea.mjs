#!/usr/bin/env node
/* Turn a "New idea" issue body into a validated ideas.json entry.
 *
 *   node tools/issue-to-idea.mjs --body body.md            # print, write nothing
 *   node tools/issue-to-idea.mjs --body body.md --write    # append to ideas.json
 *   node tools/issue-to-idea.mjs --body body.md --check-links --write
 *
 * GitHub renders an issue form as `### Label` followed by the value, so this
 * parses by label. That shape is stable but not a contract, hence: a tolerant
 * reader (any heading depth, stray colons, `_No response_` for an empty field),
 * a fixture in tools/fixtures so the parser is tested against the real shape,
 * and a dry run by default so a human sees the object before it lands.
 *
 * The same module is imported by the tests; main() only runs when this file is
 * executed directly.
 */

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import {
  readCatalog, writeCatalog, buildIdea, validateCatalog, today, labelFor
} from "../mcp/core.mjs";

export class IssueError extends Error {
  constructor(message) {
    super(message);
    this.name = "IssueError";
  }
}

/* The form's labels, in the order the form asks them. The keys are internal. */
export const FORM_FIELDS = {
  title: "Idea title",
  tagline: "One-line summary",
  describe: "What it is",
  helps: "Who it helps",
  watch: "The honest catch",
  area: "Area",
  time: "How much time",
  lane: "How it is built",
  goal: "What you want out of it",
  steps: "First moves",
  needs: "What you already need",
  kit: "Free pieces",
  links: "Link check"
};

/* The four goals, in the same words the page asks the question with. */
export const GOAL_LABELS = [
  ["Making daily life easier", "ease"],
  ["Bringing in a little money", "earn"],
  ["Being useful to people nearby", "help"],
  ["Learning something by doing it", "learn"]
];

/* Kit rows are keyed by what the piece is for; these are the six keys the
   catalog already uses. Any word is accepted, but the form offers these. */
export const KIT_KEYS = ["data", "data2", "prompt", "prompt2", "pattern", "publish"];

const NO_RESPONSE = /^_?no response_?$/i;

function normalise(text) {
  return String(text)
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[:.]+$/, "")
    .trim()
    .toLowerCase();
}

/* Split a form-shaped body into normalised label -> raw block. */
export function parseIssueBody(text) {
  const sections = new Map();
  let key = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const heading = /^#{2,5}\s+(.*\S)\s*$/.exec(raw.trim());
    if (heading) {
      key = normalise(heading[1]);
      if (!sections.has(key)) sections.set(key, []);
      continue;
    }
    if (key !== null) sections.get(key).push(raw);
  }
  const out = {};
  for (const [name, lines] of sections) {
    out[name] = lines.join("\n").replace(/<!--[\s\S]*?-->/g, "").trim();
  }
  return out;
}

/* A field's value, or "" when the form left it blank. GitHub writes
   `_No response_` into optional fields, and an empty textarea renders as
   nothing at all — both mean the same thing here. */
export function fieldValue(sections, label) {
  const raw = sections[normalise(label)];
  if (raw === undefined) return "";
  const value = raw.trim();
  return NO_RESPONSE.test(value) ? "" : value;
}

/* Lines of a textarea, with list markers and numbering removed. */
export function listLines(value) {
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "").trim())
    .filter((line) => line && !NO_RESPONSE.test(line));
}

/* `- [X] Some label` rows from a checkbox group. */
export function checkedRows(value) {
  return String(value)
    .split(/\r?\n/)
    .map((line) => /^\s*[-*+]\s*\[([ xX])\]\s*(.+?)\s*$/.exec(line))
    .filter(Boolean)
    .map((m) => ({ checked: m[1].toLowerCase() === "x", label: m[2] }));
}

/* Needs are comma-separated in the form, and each entry is short. */
export function splitNeeds(value) {
  return listLines(value)
    .flatMap((line) => line.split(/[,;]/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireField(sections, key) {
  const value = fieldValue(sections, FORM_FIELDS[key]);
  if (!value) {
    throw new IssueError(`“${FORM_FIELDS[key]}” is empty, and the form marks it required.`);
  }
  return value;
}

function pickFrom(list, text, what) {
  const wanted = normalise(text);
  const hit = list.find((item) => normalise(item.label) === wanted || normalise(item.id) === wanted);
  if (!hit) {
    const options = list.map((item) => item.label).join("; ");
    throw new IssueError(`“${text.trim()}” is not one of the ${what}: ${options}.`);
  }
  return hit.id;
}

function goalId(text) {
  const wanted = normalise(text);
  const hit = GOAL_LABELS.find(([label]) => normalise(label) === wanted);
  if (!hit) {
    throw new IssueError(
      `“${text.trim()}” is not one of the goals: ${GOAL_LABELS.map(([label]) => label).join("; ")}.`
    );
  }
  return hit[1];
}

/* `kind | Name | https://link | note`, one row per line. Returns {} if empty. */
export function parseKit(value) {
  const kit = {};
  const lines = String(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const at = i + 1;
    if (NO_RESPONSE.test(line)) return;
    const parts = line.split("|").map((part) => part.trim());
    if (parts.length !== 4) {
      throw new IssueError(
        `“Free pieces” line ${at} needs four parts — kind | name | https://link | note — and has ${parts.length}.`
      );
    }
    const [key, name, url, note] = parts;
    if (!/^[a-z][a-z0-9]*$/i.test(key)) {
      throw new IssueError(`“Free pieces” line ${at}: “${key}” is not a word. Use one of ${KIT_KEYS.join(", ")}.`);
    }
    if (!/^https?:\/\/\S+$/i.test(url)) {
      throw new IssueError(`“Free pieces” line ${at}: “${url}” is not an http(s) link.`);
    }
    if (!name || !note) {
      throw new IssueError(`“Free pieces” line ${at} needs both a name and a note.`);
    }
    if (kit[key]) {
      /* data2 and prompt2 exist for a second row; anything else would silently
         overwrite, so say so instead. */
      throw new IssueError(`“Free pieces” line ${at}: ${key} is already used. Use ${key}2 for a second row.`);
    }
    kit[key] = [name, url, note];
  });
  return kit;
}

export function requireLinkCheck(sections) {
  const rows = checkedRows(fieldValue(sections, FORM_FIELDS.links));
  const hit = rows.find((row) => /every link/i.test(row.label));
  if (!hit) {
    throw new IssueError("“Link check” is missing. The form asks the contributor to confirm every link opens.");
  }
  if (!hit.checked) {
    throw new IssueError("“Link check” is not ticked. Confirm that every link opens before converting the issue.");
  }
}

/* Form-shaped text -> a validated idea object. Throws IssueError with the
   form's own label so the maintainer knows which field to go back to. */
export function ideaFromIssue(text, data) {
  const sections = parseIssueBody(text);
  requireLinkCheck(sections);

  const steps = listLines(requireField(sections, "steps"));
  if (steps.length < 3) {
    throw new IssueError(`“First moves” needs at least three lines; the issue has ${steps.length}.`);
  }
  const needs = splitNeeds(fieldValue(sections, FORM_FIELDS.needs));

  const idea = buildIdea(data, {
    title: requireField(sections, "title"),
    tagline: requireField(sections, "tagline"),
    describe: requireField(sections, "describe"),
    helps: requireField(sections, "helps"),
    watch: requireField(sections, "watch"),
    area: pickFrom(data.areas, requireField(sections, "area"), "areas"),
    minutes: pickFrom(data.times, requireField(sections, "time"), "times"),
    lanes: [pickFrom(data.lanes, requireField(sections, "lane"), "build lanes")],
    goals: [goalId(requireField(sections, "goal"))],
    steps,
    needs,
    kit: parseKit(fieldValue(sections, FORM_FIELDS.kit))
  });
  return idea;
}

/* Every kit URL must answer before it is written. Off by default so the
   conversion works offline; on, it is the provenance rule made mechanical. */
export async function checkKitLinks(idea, { timeout = 20000 } = {}) {
  const failures = [];
  for (const [key, [, url]] of Object.entries(idea.kit || {})) {
    let response;
    try {
      response = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "ideas-for-here issue-to-idea link check" },
        signal: AbortSignal.timeout(timeout)
      });
    } catch (err) {
      failures.push(`${key}: ${url} — ${err.message}`);
      continue;
    }
    if (response.status >= 400) failures.push(`${key}: ${url} — HTTP ${response.status}`);
  }
  if (failures.length) {
    throw new IssueError(`These kit links do not open:\n  ${failures.join("\n  ")}`);
  }
}

function argValue(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const next = argv[i + 1];
  return next && !next.startsWith("--") ? next : null;
}

function readBody(argv) {
  const file = argValue(argv, "--body");
  if (file === "-") return fs.readFileSync(0, "utf8");
  if (file) return fs.readFileSync(file, "utf8");
  if (!process.stdin.isTTY) return fs.readFileSync(0, "utf8");
  throw new IssueError("No issue body. Pass --body <file>, or pipe the body in on stdin.");
}

function describeIdea(idea, data) {
  const area = data.areas.find((a) => a.id === idea.area);
  const time = data.times.find((t) => t.id === idea.minutes);
  const lane = data.lanes.find((l) => l.id === idea.lanes[0]);
  const goal = GOAL_LABELS.find(([, id]) => id === idea.goals[0]);
  return [
    `“${idea.title}”`,
    `  id      ${idea.id}`,
    `  area    ${area ? area.label : idea.area}`,
    `  time    ${time ? time.label : idea.minutes}`,
    `  built   ${lane ? lane.label : idea.lanes[0]}`,
    `  goal    ${goal ? goal[0] : idea.goals[0]}`,
    `  steps   ${idea.steps.length}`,
    `  needs   ${idea.needs.length}`,
    `  kit     ${Object.keys(idea.kit).length} ${Object.keys(idea.kit).length === 1 ? "row" : "rows"}`
  ].join("\n");
}

async function main(argv) {
  const write = argv.includes("--write");
  const links = argv.includes("--check-links");

  const body = readBody(argv);
  const file = argValue(argv, "--file") || undefined;
  const data = readCatalog(file);

  const idea = ideaFromIssue(body, data);
  console.log(describeIdea(idea, data));

  if (links) {
    await checkKitLinks(idea);
    console.log(`All ${Object.keys(idea.kit || {}).length} kit links answer.`);
  }

  console.log("");
  console.log(JSON.stringify(idea, null, 2));

  if (!write) {
    console.log("");
    console.log("Nothing written. Re-run with --write to append it to ideas.json.");
    return;
  }

  data.ideas.push(idea);
  const errors = validateCatalog(data);
  if (errors.length) {
    throw new IssueError(`That idea would make the catalog invalid:\n  ${errors.join("\n  ")}`);
  }
  data.updated = today();
  data.updatedLabel = labelFor(data.updated);
  writeCatalog(data, file);
  console.log("");
  console.log(`Added ${idea.id}. The catalog now has ${data.ideas.length} ideas, updated ${data.updatedLabel}.`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`issue-to-idea: ${err.message}`);
    process.exit(1);
  });
}
