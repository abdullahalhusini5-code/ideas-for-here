# Ideas for Here — MCP server

The catalog is exposed as an [MCP](https://modelcontextprotocol.io) server, so any
MCP-capable agent can search the 31 briefs, read one in full, check the catalog, or
submit a new idea — without scraping the page.

Two transports, one handler (`mcp/core.mjs`):

| Transport | Command | Use |
|---|---|---|
| stdio | `node mcp/server.mjs` | Desktop clients (Claude Desktop, Cursor, Codex, OpenCode) |
| Streamable HTTP | `node server.mjs` → `http://127.0.0.1:4173/mcp` | Anything that can POST JSON-RPC |

No dependencies, no API keys, no network calls. Node 18 or newer.

## Start it

```powershell
# stdio, read + write
node mcp\server.mjs

# stdio, read only: ideas_add and ideas_update are refused
node mcp\server.mjs --read-only

# HTTP: page, /api/ideas, /api/validate and /mcp on one port
node server.mjs --port 4173
```

`npm run mcp`, `npm run mcp:readonly` and `npm run serve` do the same thing.

Set `IDEAS_DATA` to point at a different catalog file (tests use this so they never touch
the real one):

```powershell
$env:IDEAS_DATA = "C:\path\to\copy.json"; node mcp\server.mjs
```

Writes are atomic (temporary file, then rename) and the whole catalog is validated before
anything is saved. An invalid edit is rejected and the file is left untouched.

## Tools

| Tool | Arguments | Returns |
|---|---|---|
| `ideas_list` | `area?`, `time?`, `lane?`, `limit?` | Compact records: id, title, tagline, area, minutes, lanes, page link |
| `ideas_search` | `query`, `limit?` | Ranked matches with a snippet of *why* it matched |
| `ideas_get` | `id` | Full brief: who it helps, the catch, first moves, needs, free pieces, page link |
| `ideas_stats` | — | Counts by area, time and build lane, and the catalog date |
| `ideas_suggest` | `problem`, `area?` | A prefilled GitHub issue URL. Does not write anything |
| `ideas_validate` | — | `{ valid, errors }` for the whole catalog |
| `ideas_add` | title, tagline, describe, area, minutes, lanes, steps, helps, watch, … | Writes to `ideas.json`; disabled with `--read-only` |
| `ideas_update` | `id` plus any fields to change | Writes to `ideas.json`; disabled with `--read-only` |

Valid ids: areas `food, money, home, family, health, learning, community, work`; times
`weekend, evenings, month`; lanes `ready, assistant, code`.

Every tool returns both a human-readable text block and `structuredContent` JSON, so an
agent can quote the text or chain on the data.

## Resources and prompt

| Kind | URI / name | Content |
|---|---|---|
| Resource | `ideas://catalog` | The whole `ideas.json` |
| Resource | `ideas://areas` | The eight areas with ids and colours |
| Resource | `ideas://stats` | The same counts as `ideas_stats` |
| Template | `ideas://idea/{id}` | One idea, e.g. `ideas://idea/garden-calendar` |
| Prompt | `plan-a-local-app` | `idea_id` (required), `audience` → a one-weekend plan in plain English |

## Connect a client

Paths below assume this folder is `C:\Users\User\Desktop\test`; use your own absolute path.
Keep the backslashes doubled inside JSON.

### Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ideas-for-here": {
      "command": "node",
      "args": ["C:\\Users\\User\\Desktop\\test\\mcp\\server.mjs", "--read-only"]
    }
  }
}
```

Restart Claude Desktop; the tools appear under the connector menu.

### Claude Code

```powershell
claude mcp add ideas-for-here -- node "C:\Users\User\Desktop\test\mcp\server.mjs" --read-only
claude mcp add --transport http ideas-http http://127.0.0.1:4173/mcp
```

### Cursor

Create `.cursor\mcp.json` in a project (or `%USERPROFILE%\.cursor\mcp.json` globally):

```json
{
  "mcpServers": {
    "ideas-for-here": {
      "command": "node",
      "args": ["C:\\Users\\User\\Desktop\\test\\mcp\\server.mjs", "--read-only"]
    }
  }
}
```

### Codex

In `~/.codex/config.toml`:

```toml
[mcp_servers.ideas-for-here]
command = "node"
args = ["C:\\Users\\User\\Desktop\\test\\mcp\\server.mjs", "--read-only"]
```

### OpenCode

In `opencode.json` (project or global):

```json
{
  "mcp": {
    "ideas-for-here": {
      "type": "local",
      "command": ["node", "C:\\Users\\User\\Desktop\\test\\mcp\\server.mjs", "--read-only"],
      "enabled": true
    }
  }
}
```

### Anything that speaks HTTP

Start `node server.mjs --port 4173`, then point the client at
`http://127.0.0.1:4173/mcp`. Send `initialize` first; the server returns an
`Mcp-Session-Id`, but it is informational — this implementation accepts any value or none,
and `DELETE` is a no-op. A bare `GET /mcp` returns `405` with
`Allow: POST, DELETE, OPTIONS` — this server answers POST only, it does not hold an SSE
stream open.

## Try it without a client

The test suite drives both transports end to end:

```powershell
node tools\test-mcp.mjs            # 62 checks: data, schema, stdio, writes on a temp copy, HTTP
node tools\test-mcp.mjs --data-only
```

A one-line manual check:

```powershell
'{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"ideas_search","arguments":{"query":"water"}}}' |
  node mcp\server.mjs
```

## Limits worth knowing

- **No auth, localhost by default.** `server.mjs` binds `127.0.0.1`. Do not expose it to a
  network without putting an authenticating proxy in front; `ideas_add` and `ideas_update`
  write to the file on disk.
- **No CORS.** `/mcp` sends no cross-origin headers, so a page on another origin cannot drive
  it; browsers fail the preflight. Connect from an agent, CLI or local page instead.
- **GitHub Pages cannot run this.** Static hosting has no Node process, so the public page
  is data-driven but read-only. MCP needs `node mcp/server.mjs` next to a local checkout, or
  `node server.mjs` on a machine you control.
- **One file, one writer.** Two servers editing `ideas.json` at the same time can lose an
  edit; run one writer.
- **Reload to see writes.** The page reads the catalog on load, so a new idea appears on
  refresh, not instantly.
