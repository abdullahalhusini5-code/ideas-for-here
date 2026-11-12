// Checks every link the site can render. Not part of the site.
// 1. Structural: every catalog kit URL must be absolute http(s), never a filesystem path.
// 2. Structural: every href/src in every page must be http(s), an in-page anchor, a data:
//    URI, mailto/tel, or a local file that actually exists.
// 3. Network: every external URL must answer < 400.
const fs = require("fs");
const path = require("path");

const SITE_PREFIX = "/ideas-for-here/";
const failures = [];

/* ---------- 1. catalog kit links ---------- */

const { ideas: IDEAS } = JSON.parse(fs.readFileSync(path.resolve("ideas.json"), "utf8"));

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

/* ---------- 2. every page on disk ---------- */

const pages = ["index.html", "brain.html", "404.html"];
if (fs.existsSync("ideas")) {
  for (const file of fs.readdirSync("ideas")) {
    if (file.endsWith(".html")) pages.push(`ideas/${file}`);
  }
}

const external = new Set();
let localRefs = 0;

for (const page of pages) {
  if (!fs.existsSync(page)) {
    failures.push(`page is missing: ${page}`);
    continue;
  }
  const html = fs.readFileSync(page, "utf8");
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]);

  for (const ref of refs) {
    if (/^https?:\/\//i.test(ref)) { external.add(ref); continue; }
    if (ref.startsWith("//")) { external.add("https:" + ref); continue; }
    if (/^(#|data:|mailto:|tel:|javascript:)/i.test(ref)) continue;

    localRefs += 1;
    let local = ref.split(/[?#]/)[0];
    if (!local) continue;
    if (local.startsWith("/")) {
      if (!local.startsWith(SITE_PREFIX)) {
        failures.push(`${page}: absolute path outside ${SITE_PREFIX}: ${ref}`);
        continue;
      }
      local = local.slice(SITE_PREFIX.length) || "index.html";
    }
    if (local.endsWith("/")) local += "index.html";
    if (!fs.existsSync(path.resolve(local))) {
      failures.push(`${page}: ${ref} does not exist at ${local}`);
    }
  }
}

/* ---------- 3. network ---------- */

const urls = [...new Set([...kitLinks, ...external])];
const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i;

(async () => {
  const rows = [];
  for (const u of urls) {
    if (LOOPBACK.test(u)) {
      // Documented addresses for a server the reader runs themselves; nothing to fetch.
      rows.push(["local", u]);
      continue;
    }
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

  console.log(`\npages: ${pages.length} | local refs: ${localRefs} | kit entries: ${kitLinks.length} | unique URLs checked: ${rows.length}`);
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
