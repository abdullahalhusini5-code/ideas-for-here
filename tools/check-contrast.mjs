#!/usr/bin/env node
/* The theme, checked rather than eyeballed.
 *
 *   1. The dark palette is written twice (once for the operating system, once
 *      for the toggle), so the two blocks must define the same tokens with the
 *      same values.
 *   2. Every token the light block defines must exist in the dark block, and
 *      the other way round: adding a colour without a dark value is the usual
 *      way a theme rots.
 *   3. Every var(--token) used in the CSS must be defined (a fallback such as
 *      var(--dot, var(--muted)) is allowed).
 *   4. Text colours must clear WCAG AA against the surfaces they sit on, in
 *      both themes.
 *   5. Both pages must load theme.js and offer the switch.
 *
 * No dependencies. Exits 1 on the first category with problems, after listing
 * all of them.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const MEDIA_SELECTOR = ':root:not([data-theme="light"]) {';
const ATTR_SELECTOR = ':root[data-theme="dark"] {';

/* ---------- reading a block out of a stylesheet ---------- */

function blockAfter(css, selector, label) {
  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`${label}: cannot find ${selector.trim()}`);
  const open = at + selector.length - 1;
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`${label}: ${selector.trim()} never closes`);
}

function tokens(block) {
  const found = {};
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const name = match[1];
    const value = match[2].replace(/\s+/g, " ").trim();
    if (name in found) throw new Error(`${name} is declared twice in one block`);
    found[name] = value;
  }
  return found;
}

/* ---------- colour maths ---------- */

function parseColour(value) {
  const text = String(value).trim();
  let match = /^#([0-9a-f]{3})$/i.exec(text);
  if (match) {
    const [r, g, b] = match[1].split("").map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  match = /^#([0-9a-f]{6})$/i.exec(text);
  if (match) {
    const n = parseInt(match[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  match = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(text);
  if (match) {
    return { r: +match[1], g: +match[2], b: +match[3], a: match[4] === undefined ? 1 : +match[4] };
  }
  return null;
}

function luminance({ r, g, b }) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const one = luminance(a);
  const two = luminance(b);
  const light = Math.max(one, two);
  const dark = Math.min(one, two);
  return (light + 0.05) / (dark + 0.05);
}

/* ---------- what has to be readable ---------- */

/* [label, foreground, background, minimum ratio]. AA is 4.5 for body-size text
   and 3 for large text; nothing here is large except the display type, which
   shares the ink colour and clears far more than 4.5 anyway. */
const PAIRS = [
  ["body text", "--ink", "--paper", 4.5],
  ["body text on a card", "--ink", "--paper-2", 4.5],
  ["secondary text", "--ink-soft", "--paper", 4.5],
  ["secondary text on a card", "--ink-soft", "--paper-2", 4.5],
  ["quiet text", "--muted", "--paper", 4.5],
  ["quiet text on a card", "--muted", "--paper-2", 4.5],
  ["links", "--accent-ink", "--paper", 4.5],
  ["links on a card", "--accent-ink", "--paper-2", 4.5],
  ["small accent text", "--accent", "--paper", 4.5],
  ["button text", "--paper", "--ink", 4.5],
  ["small print on a chosen answer", "--on-ink-soft", "--ink", 4.5],
  ["placeholder", "--placeholder", "--paper-2", 4.5]
];

/* brain.html shares the ink on paper palette but has no search field and no
   chosen-answer state, so it checks the pairs it actually renders. */
const PAIRS_BRAIN = PAIRS.filter(([, fg, bg]) =>
  ["--placeholder", "--on-ink-soft"].indexOf(fg) === -1 &&
  ["--placeholder", "--on-ink-soft"].indexOf(bg) === -1);

/* ---------- run ---------- */

const problems = [];
const notes = [];
let pairCount = 0;

const FILES = [
  { file: "styles.css", pairs: PAIRS },
  { file: "brain.html", pairs: PAIRS_BRAIN }
];

for (const target of FILES) {
  const css = read(target.file);

  let light;
  let media;
  let attr;
  try {
    light = tokens(blockAfter(css, ":root {", target.file));
    media = tokens(blockAfter(css, MEDIA_SELECTOR, target.file));
    attr = tokens(blockAfter(css, ATTR_SELECTOR, target.file));
  } catch (err) {
    problems.push(err.message);
    continue;
  }

  /* 1. the two dark blocks agree */
  for (const name of new Set([...Object.keys(media), ...Object.keys(attr)])) {
    if (!(name in media)) problems.push(`${target.file}: ${name} is in the toggle block but not the system block`);
    else if (!(name in attr)) problems.push(`${target.file}: ${name} is in the system block but not the toggle block`);
    else if (media[name] !== attr[name]) {
      problems.push(`${target.file}: ${name} differs — system "${media[name]}" vs toggle "${attr[name]}"`);
    }
  }

  /* 2. the two palettes cover the same colours. Typography and spacing tokens
     (--serif, --pad) are not colours and are allowed to be defined once. */
  const isColour = (value) => parseColour(value) !== null;
  for (const [name, value] of Object.entries(light)) {
    if (isColour(value) && !(name in attr)) problems.push(`${target.file}: ${name} has no dark value`);
  }
  for (const [name, value] of Object.entries(attr)) {
    if (isColour(value) && !(name in light)) problems.push(`${target.file}: ${name} is dark-only`);
  }

  /* 3. every var() resolves */
  for (const match of css.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,)?/gi)) {
    const name = match[1];
    if (name in light) continue;
    if (match[2]) continue; /* var(--x, fallback) is fine */
    problems.push(`${target.file}: var(${name}) is never defined`);
  }

  /* 4. contrast, light and dark */
  for (const [label, fg, bg, min] of target.pairs) {
    for (const [theme, set] of [["light", light], ["dark", attr]]) {
      if (!(fg in set) || !(bg in set)) {
        problems.push(`${target.file}: ${theme} ${label} needs ${fg} and ${bg}`);
        continue;
      }
      const one = parseColour(set[fg]);
      const two = parseColour(set[bg]);
      if (!one || !two || one.a !== 1 || two.a !== 1) {
        notes.push(`${target.file}: ${theme} ${label} is not an opaque pair, not measured`);
        continue;
      }
      pairCount += 1;
      const ratio = contrast(one, two);
      if (ratio < min) {
        problems.push(
          `${target.file}: ${theme} ${label} is ${ratio.toFixed(2)}:1, under ${min.toFixed(1)}:1 ` +
          `(${fg} ${set[fg]} on ${bg} ${set[bg]})`
        );
      }
    }
  }
}

/* 5. both pages carry the switch and the script that drives it */
for (const page of ["index.html", "brain.html"]) {
  const html = read(page);
  if (!/<script src="theme\.js"><\/script>/.test(html)) {
    problems.push(`${page}: does not load theme.js, so the switch cannot work`);
  }
  if (!/id="theme-toggle"/.test(html)) problems.push(`${page}: has no #theme-toggle`);
  if (!/id="theme-toggle"[^>]*aria-pressed="false"/.test(html)) {
    problems.push(`${page}: #theme-toggle must start with aria-pressed="false"`);
  }
}

/* ---------- report ---------- */

if (problems.length) {
  console.log(`check-contrast: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  problems.forEach((problem) => console.log("  - " + problem));
  notes.forEach((note) => console.log("  note: " + note));
  process.exit(1);
}

notes.forEach((note) => console.log("  note: " + note));
console.log(
  `check-contrast: OK — ${pairCount} colour pairs clear AA across both themes, ` +
  `and ${FILES.length} token blocks stay in step`
);
