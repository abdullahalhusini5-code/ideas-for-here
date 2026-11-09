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
| **Weighted scoring over a curated catalog** | **Zero. No server, no key, no requests after load** | **None** | **Yes** |

Consequences that turned out to be features:

- The page deploys anywhere static, including free tiers, with no backend.
- The result is identical for everyone with the same answers, so it can be reviewed and argued with.
- Every result prints the reasons ("it sits in community… it fits one weekend… no coding needed"),
  because a score you can't inspect is indistinguishable from magic.
- The "generator" feel is preserved by the **remix** block: a deterministic three-way
  combination (topic × format × constraint) that produces a new brief on each shuffle.
  Same delight, no model, no cost.

## Two ways in

**Browse.** Full catalog, filtered by area, available time, and how the person wants to
build it, plus free-text search. Every card expands into a *build kit*.

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

Each idea in `ideas.js`:

```js
{
  id, title, tagline, describe,        // plain English, no jargon
  area,                                // one of 8
  goals: [], minutes, lanes: [],       // ranking dimensions
  needs: [], steps: [],                // what it takes, four moves
  kit: { data, data2, prompt, prompt2, pattern, publish }
}
```

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

Accessibility: real buttons with `aria-pressed` / `aria-expanded`, a live region for the
result count, visible focus rings, `prefers-reduced-motion` honoured, contrast ≥ 5:1 for
body and muted text, and the whole thing still works at 320 px wide.

## What was deliberately left out

- Accounts, saved favourites, analytics, cookies — none, and none needed.
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
