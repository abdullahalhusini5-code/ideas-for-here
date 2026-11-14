# Contributing an idea

This catalogue is thirty-one small apps and projects for local life. A good addition is
one somebody could start this weekend, not a startup pitch.

## Suggest one

Open the **[New idea](https://github.com/abdullahalhusini5-code/ideas-for-here/issues/new?template=new-idea.yml)**
issue form. It asks for one field per key in the catalog, so nothing gets lost in a
paragraph.

Sending an issue needs a free GitHub account — the only account anywhere near this
project, and only for contributing. Reading the page needs none.

## What gets accepted

- **Plain words.** Write for a neighbour, not a developer. "Borrow the drill, not buy it"
  is right. "Peer-to-peer equipment rental platform" is not. Developer vocabulary is not
  forbidden, it just moves into the build kit, which is where the technical depth lives.
- **An honest catch.** `watch` is the most useful field on the card: what will go wrong,
  or what the owner must keep doing. A suggestion with no downside has not been thought
  through yet.
- **Three or more first moves.** Each one afternoon-sized and in order.
- **Only links that open.** Never invent one. If a piece has no real source, the kit is
  shorter. A shorter kit is welcome; a dead link is not.
- **No personal data, no marketing, no product.** An idea here is a thing a person can
  make for the place they live.

## What happens next

Someone reads every issue and replies either way. A maintainer may rewrite the wording
before it lands — the same idea in plainer words is a better contribution, not a worse
one.

Once an issue is accepted, it is converted by command rather than by hand-copying:

```powershell
# the issue body, as GitHub renders it, saved to a file
node tools\issue-to-idea.mjs --body body.md
```

That prints the object it built and writes nothing. Review it. Then:

```powershell
node tools\issue-to-idea.mjs --body body.md --check-links --write
```

- `--check-links` fetches every kit URL and refuses any that does not answer.
- `--write` appends the idea, re-validates the whole catalog, bumps `updated`, and
  replaces `ideas.json` atomically. If anything is invalid, nothing is written.
- The `id` is derived from the title, so it never has to be invented. If the slug is
  taken, the script appends `-2`.

The parser reads the form's own labels. If a label in
`.github/ISSUE_TEMPLATE/new-idea.yml` changes, update `FORM_FIELDS` in
`tools/issue-to-idea.mjs` too — a test fails when the two drift apart.

## Before you commit

```powershell
npm run verify     # catalog, schema, MCP, server, HTML, contrast, repo promises
```

If you changed the catalog, also run `npm run check:links` (it needs network) to confirm
every external URL still answers.

## Licence

Text and catalog are CC BY 4.0; the code is MIT. By contributing you agree to publish
under those terms.
