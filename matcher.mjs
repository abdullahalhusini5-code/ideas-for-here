/* Shared, dependency-free text matcher.
 *
 * Used by the page (app.js), the MCP server (mcp/core.mjs) and the tests, so
 * search behaves identically everywhere. Deterministic: no locale-dependent
 * collation, no randomness, one fixed synonym table and a short suffix list.
 *
 * A query matches an idea when every one of its words is found (as a word or
 * a stemmed synonym) in the idea's title, tagline, id, description, who it
 * helps, the watch, its needs, its steps and its free-piece names.
 */

const SYNONYMS = {
  rubbish: ["waste", "refuse", "bins", "recycling"],
  waste: ["rubbish", "refuse", "bins", "recycling"],
  bins: ["rubbish", "waste", "recycling"],
  recycling: ["rubbish", "waste", "bins"],
  school: ["parents", "teacher", "evening"],
  parents: ["school", "teacher", "evening"],
  teacher: ["school", "parents", "evening"],
  evening: ["school", "parents", "teacher"],
  water: ["leak", "pipe", "supply", "outage"],
  leak: ["water", "pipe", "outage"],
  eggs: ["groceries", "food", "price"],
  receipts: ["invoices", "expenses", "bills"],
  invoices: ["receipts", "expenses", "bills"],
  medicine: ["prescription", "pharmacy"],
  prescription: ["medicine", "pharmacy"],
  pharmacy: ["medicine", "prescription"]
};

const SUFFIXES = ["es", "ed", "ing", "s"];

/* Strip one short suffix. Kept deliberately small: "ideas" becomes "idea",
   "bins" becomes "bin", but "gas" is never cut to "ga". */
export function stem(word) {
  for (const suffix of SUFFIXES) {
    if (word.length > 4 && word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return word.slice(0, word.length - suffix.length);
    }
  }
  return word;
}

/* The word itself, its stem, its synonyms and the stems of its synonyms. */
export function wordVariants(token) {
  const variants = new Set([token, stem(token)]);
  for (const syn of SYNONYMS[token] || []) {
    variants.add(syn);
    variants.add(stem(syn));
  }
  return variants;
}

function ideaWords(idea, extra) {
  const parts = [
    idea.title, idea.tagline, idea.id, idea.describe, idea.helps, idea.watch,
    ...(idea.needs || []), ...(idea.steps || []),
    ...Object.values(idea.kit || {}).map((row) => row[0])
  ];
  if (extra) parts.push(extra);
  return parts.join(" ").toLowerCase();
}

/* True when every query word matches the idea. */
export function matchQuery(idea, query, extra) {
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const hay = ideaWords(idea, extra);
  return words.every((w) => [...wordVariants(w)].some((v) => hay.includes(v)));
}
