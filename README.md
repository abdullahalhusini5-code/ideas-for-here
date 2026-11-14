# Ideas for Here

[![checks](https://github.com/abdullahalhusini5-code/ideas-for-here/actions/workflows/ci.yml/badge.svg)](https://github.com/abdullahalhusini5-code/ideas-for-here/actions/workflows/ci.yml)

Live at **https://abdullahalhusini5-code.github.io/ideas-for-here/**

A catalog of small apps and projects for ordinary local problems, in plain English. Browse
all 31 briefs, narrow them with four questions, or open one card and get the first moves,
what you need, and the free pieces that apply.

Every idea states the time it takes, how it gets built, who it helps and the honest catch.
Filters live in the URL, so `?area=health`, `?time=weekend` and `?q=water` are shareable,
and `?idea=garden-calendar` opens one brief directly.

The catalog is a data file (`ideas.json`) fetched at load, and the same file is exposed as
an **MCP server**, so any MCP-capable AI agent can search it, read a brief, or submit a new
idea. No build step, no dependencies, no API keys, no accounts.

## Run it

Two ways, depending on what you want:

```powershell
# 1. Static, like GitHub Pages: the page reads ideas.json, read-only
python -m http.server 4173 --bind 127.0.0.1
#    open http://127.0.0.1:4173/

# 2. Dynamic, with a live API and MCP: zero dependencies, Node 18+
node server.mjs --port 4173
#    page      http://127.0.0.1:4173/
#    catalog   http://127.0.0.1:4173/api/ideas
#    validate  http://127.0.0.1:4173/api/validate
#    MCP       http://127.0.0.1:4173/mcp
```

`npm run serve`, `npm run mcp` and `npm run mcp:readonly` wrap the same commands.

Serve the folder over HTTP; opening `index.html` from disk no longer works, because the
page fetches the catalog and browsers block that on `file://`.

## Check it

One command runs everything CI runs:

```powershell
npm run verify
```

| Check | Command | What it proves |
|---|---|---|
| Catalog, schema, MCP, server | `npm test` | 62 checks: the catalog is valid, the schema agrees with the runtime rules, both transports answer, writes work on a temp copy, and the server's guardrails hold |
| Schema | `npm run check:schema` | `ideas.json` conforms to `ideas.schema.json`, and the schema uses no keyword the checker cannot enforce |
| Repo promises | `npm run check:repo` | the test count quoted in prose is true, there are zero runtime dependencies, and every dev dependency is pinned |
| HTML | `npm run check:html` | every page in the root is valid HTML (dev-only tool, never served) |
| Contrast | `npm run check:contrast` | both theme blocks agree, every text colour clears WCAG AA |
| Links | `npm run check:links` | every kit URL and every external link answers under 400; needs network |

GitHub Actions runs the first four on every push and pull request, on Node 20 and 22
(`.github/workflows/ci.yml`), and the link check every Monday
(`.github/workflows/links.yml`) — it opens an issue when a link breaks and closes it when
the link answers again. The browser checks are local: Playwright is not installed in CI.

`axe-core` and `html-validate` are **dev dependencies only**. Nothing from `node_modules`
is served, `dependencies` stays empty, and versions are exact so a checker cannot change
under the repo.

## Files

| File | Purpose |
|---|---|
| `index.html` | Structure, copy, both modes, privacy/licence/accessibility notes |
| `styles.css` | The whole visual system; variables at the top |
| `ideas.json` | **The catalog**: 31 ideas with `helps`/`watch`, areas, times, lanes, remix lists |
| `ideas.schema.json` | The published shape of `ideas.json`, for editors and CI |
| `ideas.js` | Loader: fetches `/api/ideas` when the local server says it exists, else `ideas.json` |
| `app.js` | Async boot, URL state, deep links, filtering, ranking, questionnaire, remix, rendering |
| `brain.html` | The four layers as an interactive scan, plus a seven-step MCP guide |
| `server.mjs` | Local static server + `/api/ideas` + `/api/validate` + `/mcp` (Streamable HTTP) |
| `matcher.mjs` | The shared search matcher: synonyms, a short suffix rule, one deterministic order |
| `mcp/core.mjs` | Catalog access, validation, search (via `matcher.mjs`), write rules, MCP tools/resources/prompts |
| `mcp/server.mjs` | MCP over stdio, with `--read-only` |
| `mcp/README.md` | Client configs for Claude Desktop/Code, Cursor, Codex, OpenCode; tool reference |
| `tools/test-mcp.mjs` | 62 checks: catalog, schema, stdio, writes on a temp copy, HTTP API and MCP |
| `tools/check-schema.mjs` | Checks `ideas.json` against `ideas.schema.json` (no dependencies) |
| `tools/schema-lite.mjs` | The small JSON Schema checker the two above use |
| `tools/check-links.js` | Re-checks every external link in the catalog and every page's local links |
| `tools/check-contrast.mjs` | Asserts both theme blocks agree and every text colour clears WCAG AA |
| `theme.js` | Light/dark switch: stored choice, falls back to the operating system, no flash |
| `.github/workflows/` | CI on every push, and the weekly link check that opens an issue |
| `LICENSE` | CC BY 4.0 for text and catalog, MIT for code |
| `robots.txt`, `sitemap.xml` | Crawler rules and the single canonical URL |
| `404.html` | Static not-found page for GitHub Pages |
| `favicon.svg`, `apple-touch-icon.png`, `og.png` | Icons and the 1200×630 share image |
| `DESIGN.md` | Why it works this way, including the static-vs-AI and data/MCP decisions |

## Add or edit an idea

`ideas.json` is the single source of truth. The shortest safe route is the MCP server, which
validates before it writes:

```powershell
node mcp\server.mjs
# then call ideas_add or ideas_update from your agent;
# reload http://127.0.0.1:4173/ to see it through /api/ideas
```

The shape of the file is published as `ideas.schema.json`, and `ideas.json` points at it with
`"$schema"`, so an editor with JSON support underlines a bad field as you type. Two rules that
a schema cannot express — ids must be unique, and every `area`/`minutes`/`lanes` value must
exist in the lists at the top of the file — are enforced by `validateCatalog()` in
`mcp/core.mjs` instead. Check both before committing:

```powershell
node tools\check-schema.mjs
node tools\test-mcp.mjs --data-only
```

`tools/schema-lite.mjs` is a deliberately small checker: it supports the keywords
`ideas.schema.json` uses and rejects any keyword it does not understand, so the schema cannot
quietly rely on a rule nothing enforces. It is not a general JSON Schema implementation.

Or edit the JSON directly. One idea looks like this:

```json
{
  "id": "unique-slug",
  "title": "Short, concrete name",
  "tagline": "One line of promise.",
  "describe": "Two or three sentences, plain English, no developer words.",
  "area": "food",
  "goals": ["ease", "learn"],
  "minutes": "weekend",
  "lanes": ["ready", "assistant"],
  "needs": ["A phone"],
  "steps": ["...", "...", "...", "..."],
  "helps": "Who this is actually for, in one or two sentences.",
  "watch": "The honest catch: what it will not do, or what the owner must keep doing.",
  "kit": {
    "data":    ["Name", "https://…", "why it's useful"],
    "prompt":  ["Name", "https://prompts.chat/prompts/<id>", "prompts.chat · Category"],
    "pattern": ["name", "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/<folder>", "what it demonstrates"],
    "publish": ["Netlify", "https://www.netlify.com/", "Free static hosting"]
  }
}
```

Allowed values: `area` is one of `food, money, home, family, health, learning, community,
work`; `minutes` is `weekend, evenings, month`; `lanes` are `ready, assistant, code`.

The hero figure, the "Thirty-one" in the intro and the catalog counter are all generated
from the catalog length at load, so the count needs no other edit. Then verify:

```powershell
node tools\test-mcp.mjs        # catalog shape, MCP tools, HTTP API
node tools\check-links.js      # every external URL returns 200
```

## MCP

Any MCP-capable agent can read the catalog. Full client configs are in
[`mcp/README.md`](mcp/README.md); a step-by-step walkthrough, with the four-layer map,
is on [`brain.html`](brain.html).

| Surface | What it gives an agent |
|---|---|
| Tools | `ideas_list`, `ideas_search`, `ideas_get`, `ideas_stats`, `ideas_suggest`, `ideas_validate`, `ideas_add`, `ideas_update` |
| Resources | `ideas://catalog`, `ideas://areas`, `ideas://stats`, and `ideas://idea/{id}` |
| Prompt | `plan-a-local-app` — turns one brief into a one-weekend plan |

Reading is always available. Writing needs a local stdio or HTTP server without
`--read-only`, and writes go to `ideas.json` on that machine.

`ideas_search` and the page's search field call the same `matcher.mjs`, so a query returns
the same ideas in the same order whichever one you ask.

## Provenance rules

1. Never invent a kit link. If there's no real source, ship fewer kit entries.
2. Data sources come from the local `public-apis` clone; patterns from `awesome-llm-apps`;
   prompts must be real `prompts.chat` IDs (verify the URL returns 200); hosts from `free-for-dev`.
3. Keep the visible copy free of developer vocabulary. The kit is where technical depth lives.

## Deploy

The page is plain static files, so any host works with no configuration:

- **Netlify** — drag the folder onto the dashboard, or `npx netlify-cli deploy --prod`
- **Vercel** — `npx vercel --prod`
- **Cloudflare Pages** — upload the folder
- **GitHub Pages** — commit to a repo, enable Pages on the root
- **Neocities** — upload the whole folder

Static hosts serve the page and `ideas.json`. They cannot run `server.mjs`, so there is no
`/api/ideas` and no `/mcp` there: the public page is data-driven but read-only, and a new
idea needs a commit. Run `server.mjs` (or `node mcp/server.mjs` over stdio) on a machine you
control for the live API and MCP.

## Licence and privacy

Text, the idea briefs and `ideas.json` are **CC BY 4.0**; the code is **MIT**. See
`LICENSE`. Reuse is welcome with credit and a link back.

The page sets no cookies, runs no analytics, loads no third-party scripts, and sends nothing
about you anywhere. It makes one same-origin request for the catalog (a second, the JSON
fallback, only if the first is unavailable). GitHub Pages
still records standard server logs as the host; the in-page privacy note says so plainly.

## Accessibility

- **Themes:** a light/dark toggle in the top bar (keyboard reachable, `aria-pressed`).
  Unset it follows the operating system; the choice is remembered in `localStorage`.
  WCAG AA contrast is enforced in both themes by `tools/check-contrast.mjs`.
- **Keyboard:** arrow keys switch Browse / Match me; Enter selects an answer and advances
  the questionnaire; focus moves to the results heading when matches appear, and a live
  region announces them.
- **Structure:** one `h1` per page, heading order never skips a level, real buttons with
  `aria-pressed` / `aria-expanded`, a skip link, and `prefers-reduced-motion` honoured.
- **Shortlist:** save ideas from any card; kept only in this browser (`localStorage`) and
  listed in their own tab, with keyboard reachable controls.
- **Everything works at 320 px wide, and nothing is injected by a build step.**
