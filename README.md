# Ideas for Here

Live at **https://abdullahalhusini5-code.github.io/ideas-for-here/**

A static page that gives local people app and project ideas in plain English — browsable
as a catalog, or narrowed by four questions. Every idea is a concrete brief with the first
moves; where it fits, it also carries the free pieces to start: a data source, a pattern, a
starter prompt, or a free place to publish. Each card states the time, build route, what you
need and how many free pieces it holds before you open it; each kit adds who the idea helps
and what to watch out for.

No build step. No server. No API keys. No requests after the page loads.

## Run it

Any static file server works:

```powershell
python -m http.server 4173 --bind 127.0.0.1
# open http://127.0.0.1:4173/
```

Opening `index.html` directly from disk also works.

## Files

| File | Purpose |
|---|---|
| `index.html` | Structure, copy, both modes, privacy/licence/accessibility notes |
| `styles.css` | The whole visual system; variables at the top |
| `ideas.js` | The catalog — 31 ideas, per-idea `helps`/`watch` briefs, and the remix word lists |
| `app.js` | Filtering, ranking, questionnaire, remix, rendering, suggest-tile placement |
| `LICENSE` | CC BY 4.0 for text and catalog, MIT for code |
| `robots.txt`, `sitemap.xml` | Crawler rules and the single canonical URL |
| `404.html` | Static not-found page for GitHub Pages |
| `favicon.svg`, `apple-touch-icon.png`, `og.png` | Icons and the 1200×630 share image |
| `DESIGN.md` | Why it works this way, including the static-vs-AI decision |
| `tools/check-links.js` | Re-checks every external link in the catalog |

## Add or edit an idea

Add an object to `IDEAS` in `ideas.js`, and its `helps` / `watch` text to the `BRIEF` map
just above the remix lists (both fields may also be written inline on the idea):

```js
{
  id: "unique-slug",
  title: "Short, concrete name",
  tagline: "One line of promise.",
  describe: "Two or three sentences, plain English, no developer words.",
  area: "food",                       // food|money|home|family|health|learning|community|work
  goals: ["ease", "learn"],           // ease|earn|help|learn
  minutes: "weekend",                 // weekend|evenings|month
  lanes: ["ready", "assistant"],      // ready|assistant|code
  needs: ["A phone"],
  steps: ["...", "...", "...", "..."],
  helps: "Who this is actually for, in one or two sentences.",
  watch: "The honest catch: what it will not do, or what the owner must keep doing.",
  kit: {
    data:    ["Name", "https://…", "why it's useful"],
    prompt:  ["Name", "https://prompts.chat/prompts/<id>", "prompts.chat · Category"],
    pattern: ["name", "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/<folder>", "what it demonstrates"],
    publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
  }
}
```

The idea count in the hero, the catalog counter and "Thirty-one" in the intro are all
generated from `IDEAS.length` at load, so adding or removing an idea needs no other edit.
Then check every external link:

```powershell
node tools\check-links.js
```

## Provenance rules

1. Never invent a kit link. If there's no real source, ship fewer kit entries.
2. Data sources come from the local `public-apis` clone; patterns from `awesome-llm-apps`;
   prompts must be real `prompts.chat` IDs (verify the URL returns 200); hosts from `free-for-dev`.
3. Keep the visible copy free of developer vocabulary. The kit is where technical depth lives.

## Deploy

It is plain static files; any of these work with no configuration:

- **Netlify** — drag the folder onto the dashboard, or `npx netlify-cli deploy --prod`
- **Vercel** — `npx vercel --prod`
- **Cloudflare Pages** — upload the folder
- **GitHub Pages** — commit to a repo, enable Pages on the root
- **Neocities** — upload the whole folder

Nothing needs to be built before uploading.

## Licence and privacy

Text, the idea briefs and `ideas.js` are **CC BY 4.0**; the code is **MIT**. See
`LICENSE`. Reuse is welcome with credit and a link back.

The page sets no cookies, runs no analytics and makes no requests after load. GitHub
Pages still records standard server logs as the host; the in-page privacy note says so
plainly. No third-party scripts are loaded.
