# Design — Ideas for Here

## The problem it solves

A local person — a shopkeeper, a teacher, a student, a parent — hears "build an app"
and has no idea what to build or where to start. Generic idea lists are written for
developers ("build a CRUD app with an ORM") and are useless to them.

This page does one thing: **shows ordinary people small, concrete things worth building
for the place they live, in language they already speak, with a realistic first step.**

## The one decision that shaped everything

**Ranking is static arithmetic, not live AI generation.**

| Option | Cost | Risk | Chosen |
|---|---|---|---|
| LLM generates ideas per visit | Server + API key + per-visit money; rate limits; can hallucinate unusable ideas | High | No |
| Model-driven ranking of a fixed catalog | Still needs a server and a key | Medium | No |
| **Weighted scoring over a curated catalog** | **Zero. No server, no key, one data file** | **None** | **Yes** |

Consequences that turned out to be features:

- The page deploys anywhere static, including free tiers, with no backend.
- The result is identical for everyone with the same answers, so it can be reviewed and argued with.
- Every result prints the reasons ("it sits in community… it fits one weekend… no coding needed"),
  because a score you can't inspect is indistinguishable from magic.
- The "generator" feel is preserved by the **remix** block: a deterministic three-way
  combination (topic × format × constraint) that produces a new brief on each shuffle.
  Same delight, no model, no cost.

## Ways in

**Browse.** Full catalog, filtered by area, available time, and how the person wants to
build it, plus free-text search. Every card carries the facts needed before opening it —
roughly how long, how it is built, what you need, and how many free pieces the kit holds —
and expands into a *build kit* with who it helps, the first moves, and the honest catch.

**Match me.** Four questions, one screen each, then a ranked shortlist:

1. What do you want out of this? → `ease` / `earn` / `help` / `learn`
2. Which part of life should it touch? → one of 8 areas
3. How much time do you really have? → `weekend` / `evenings` / `month`
4. How do you want to build it? → `ready` / `assistant` / `code`

### Scoring

```
area match          +5
goal match          +3
time exact match    +2   (adjacent time bucket +1)
build-lane match    +2
```

Top three are shown in full (description, the first moves, what you'll need, and the
starting links that apply). The next eight appear as a compact list that jumps into the
catalog with the area filter already applied.

Ties break by how many of your four answers matched, then alphabetically — never
randomly — so the same answers always give the same page.

## The data model

`ideas.json` is the single source of truth — for the page, the checker and the MCP server.
It holds:

```json
{
  "updated": "2026-11-11", "updatedLabel": "11 November 2026",
  "areas": [], "times": [], "lanes": [],
  "ideas": [ { "id, title, tagline, describe, area, goals, minutes, lanes,
               needs, steps, helps, watch, kit" } ],
  "remix": { "topics": [], "formats": [], "constraints": [] }
}
```

`helps` and `watch` are fields on each idea, not a separate map: one record is one idea, so
there is nothing to merge and nothing to drift. `helps` also appears on the match result.

`kit` is the provenance requirement made concrete. Every entry it contains resolves to a
real page — `app.js` renders a non-http value as plain text rather than a dead link:

- **data** — a free source from the `public-apis` index (e.g. Open-Meteo, Frankfurter)
- **pattern** — a runnable shape from `awesome-llm-apps` (RAG chain, vision RAG, data-viz agent)
- **prompt** — a real starter prompt on `prompts.chat`, with its live URL
- **publish** — a free host from `free-for-dev` (Netlify, Vercel, Render, Neocities)

Every external URL in the catalog was checked (HTTP 200) before publishing, and
`tools/check-links.js` re-runs that check. Nothing on the page is invented; where an idea
has no natural source, it simply has fewer kit entries rather than a fabricated one. Most
ideas carry two or three pieces, not all four — the card shows what applies.

### Loading, and why the page is dynamic

`ideas.js` is a loader, not the catalog. At boot it fetches the catalog once:

1. `/api/ideas` — only when the local server (`server.mjs`) is serving the page. That server
   prepends one flag line to `ideas.js`, so the public static file never asks for an endpoint
   that would 404 and never logs a console error.
2. `ideas.json` — the static fallback used by GitHub Pages and any other static host.

Both return the same document, so the page behaves identically; the API simply means a
locally added idea appears on reload without a commit. If neither source answers, the grid
shows a short note with the fix instead of an empty page.

### Shareable state

Filters and search are written to the URL with `history.replaceState`: `?area=`, `?time=`,
`?lane=`, `?q=`. A filtered view can be bookmarked or sent to a neighbour. `?idea=<id>`
opens that card, scrolls it into place below the header (`scroll-margin-top`), and then
strips the parameter so a reload does not re-trigger the jump. Invalid ids and values are
ignored rather than trusted, so a hand-edited URL degrades to the full catalog.

### The MCP layer

One handler, `mcp/core.mjs`, serves two transports: stdio (`mcp/server.mjs`) for desktop
agents, and Streamable HTTP at `/mcp` from `server.mjs`. It exposes eight tools (list,
search, get, stats, suggest, validate, add, update), three resources plus an
`ideas://idea/{id}` template, and one planning prompt. Reads always work; writes validate
the whole catalog first, then replace `ideas.json` atomically, and are refused under
`--read-only`.

This is the deliberate split: **the public page stays static and read-only, because GitHub
Pages cannot run a Node process.** MCP requires a local checkout or a self-hosted
`server.mjs`. Nothing about the visitor's page depends on that server being up.

## Content rules

- Written for a neighbour, not a developer. No "API", "CRUD", "stack" in the visible copy.
- One concrete local pain per idea, named specifically: the water cut, the school letter,
  the price of eggs, the medicine Mum forgets.
- Every idea must be finishable by one person, and startable for zero money.
- Difficulty is stated honestly in the build lane, not hidden behind "anyone can do this".

## Visual direction

Warm paper (`#f7f3ea`), ink text, one terracotta accent, hairline rules, a serif display
face against a sans body, mono for labels and index numbers. Deliberately closer to a
printed community noticeboard than to a SaaS landing page: no colour gradients, no glass,
no purple. (The only gradient is a 3%-opacity CSS rule used to fake paper grain, and it
disappears in print.) Cards form a continuous hairline grid, and the catalog reads like an
index.

Three layout decisions carry the details without adding noise:

- **The hero is two columns above 1040 px.** The right column is a plain "what a card
  gives you" panel, so the headline does not have to explain the whole page.
- **Card metadata is a set of wrap tokens, not a `·`-joined sentence.** Time, lanes, needs
  and free-piece count each break cleanly, so no line ever starts with a stranded dot, on
  any width.
- **The grid ends with a dashed "suggest an idea" tile that fills the leftover cells of the
  last row.** A short catalog leaves a gap; that gap becomes the invitation to add to it.
  The tile is sized in JS and re-sized on window resize.

Below the catalog, a separate **Start tonight** section gives three steps for someone who
would rather invent their own brief than pick one: name the problem in one sentence, do
the first move on paper, show it to one person. It is hidden in print with the other
chrome.

Accessibility: real buttons with `aria-pressed` / `aria-expanded`, a live region for the
result count, visible focus rings, `prefers-reduced-motion` honoured, contrast ≥ 5:1 for
body and muted text, and the whole thing still works at 320 px wide.

## What was deliberately left out

- Accounts, saved favourites, analytics, cookies — none, and none needed.
- A public write API — the hosted page has no server process, so catalog writes stay local
  (MCP or a JSON edit); anyone can still file an idea through GitHub.
- Arabic/RTL — the page is English by request. The type and layout choices are CSS
  variables, so a second language would be a translation pass, not a rewrite.
- Live AI generation — see above. It can be added later as an optional endpoint without
  touching the catalog or the ranking.

## Making it a real page, not a demo

A catalog that claims "no account, no tracking" has to also say who runs it, what happens
to your data, and what you may do with the text. Four short notes carry that in plain
English — privacy, licence, accessibility, how it is made — plus a dated "last updated"
stamp, a real contact route, and real files behind every claim: `LICENSE` (CC BY 4.0 for
text and catalog, MIT for code), `robots.txt`, `sitemap.xml`, `404.html`, icons and a
1200×630 share image.

The copy pass cut rather than added: the hero lost a clause, each section head lost a
sentence, the match aside lost a paragraph, and the footer's long provenance essay became
a three-column index. Legal text is the deliberate exception, and it is kept short enough
to actually be read. The privacy note states the one thing the page cannot control —
GitHub Pages keeps ordinary server logs as the host.

The machine-readable surface is documented beside the code, not buried in the README:
`mcp/README.md` carries client configs, the tool table, and the limits (localhost bind, one
writer, reload to see writes). An agent reading this repository can connect without asking
a person how.
