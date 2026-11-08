// Checks every link the site can render. Not part of the site.
// 1. Structural: every catalog kit URL must be absolute http(s), never a filesystem path.
// 2. Structural: every href in index.html must be http(s), an in-page anchor, a data:
//    URI, or a local file that actually exists.
// 3. Network: every external URL must answer < 400.
const fs = require("fs");
const path = require("path");

const failures = [];

/* ---------- 1. catalog kit links ---------- */

const { IDEAS } = new Function(
  fs.readFileSync("ideas.js", "utf8") + "; return { IDEAS };"
)();

const kitLinks = [];
IDEAS.forEach((idea) => {
  Object.entries(idea.kit || {}).forEach(([key, item]) => {
    if (!item) return;
    if (!Array.isArray(item) || item.length < 2) {
      failures.push(`malformed kit entry: ${idea.id}.${key}`);
      return;
    }
    if (!/^https?:\/\//i.test(item[1])) {
      failures.push(`non-http kit href: ${idea.id}.${key} -> ${item[1]}`);
      return;
    }
    kitLinks.push(item[1]);
  });
});

/* ---------- 2. index.html hrefs ---------- */

const html = fs.readFileSync("index.html", "utf8");
const htmlHrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map((m) => m[1]);
htmlHrefs.forEach((href) => {
  if (/^https?:\/\//i.test(href)) return;
  if (href.startsWith("#")) return;
  if (href.startsWith("data:")) return;
  const local = href.split(/[?#]/)[0];
  if (local && fs.existsSync(path.resolve(local))) return;
  failures.push(`index.html href is not http(s) and not a local file: ${href}`);
});

/* ---------- 3. network ---------- */

const urls = [...new Set([...kitLinks, ...htmlHrefs.filter((h) => /^https?:\/\//i.test(h))])];

(async () => {
  const rows = [];
  for (const u of urls) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);
      const r = await fetch(u, { redirect: "follow", signal: c.signal, headers: { "user-agent": "Mozilla/5.0" } });
      clearTimeout(t);
      rows.push([r.status, u]);
    } catch (e) {
      rows.push(["ERR:" + e.name, u]);
    }
  }

  rows.forEach(([s, u]) => console.log(String(s).padEnd(8), u));

  const suspicious = rows.filter(([s]) => Number(s) >= 400 || String(s).startsWith("ERR:"));
  suspicious.forEach(([s, u]) => failures.push(`http ${s}: ${u}`));

  console.log(`\nkit entries: ${kitLinks.length} | unique URLs checked: ${rows.length}`);
  if (failures.length) {
    console.log(`\nFAILURES (${failures.length}):`);
    failures.forEach((f) => console.log("  - " + f));
    process.exitCode = 1;
  } else {
    console.log("all links OK");
  }
  // Fetch keeps sockets alive; exit deterministically once the report is written.
  process.exit(process.exitCode || 0);
})();
