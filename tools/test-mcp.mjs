#!/usr/bin/env node
/* Ideas for Here — checks for the catalog and the MCP servers.
 *
 *   node tools/test-mcp.mjs             full suite (data + stdio + HTTP)
 *   node tools/test-mcp.mjs --data-only data validation only
 *
 * No test framework, no dependencies, no network.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_FILE, readCatalog, validateCatalog, REQUIRED_STRINGS } from "../mcp/core.mjs";
import { validate as validateSchema, lintSchema } from "./schema-lite.mjs";
import { matchQuery } from "../matcher.mjs";
import { badgesFor, nextAnswers, GOAL_ORDER } from "../match.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_ONLY = process.argv.includes("--data-only");
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

async function testData() {
  console.log("\nCatalog");
  const data = readCatalog();

  await test("ideas.json is valid", () => {
    const errors = validateCatalog(data);
    assert.deepEqual(errors, []);
  });

  await test("31 ideas with unique ids", () => {
    assert.equal(data.ideas.length, 31);
    assert.equal(new Set(data.ideas.map((i) => i.id)).size, 31);
  });

  await test("every idea has helps and watch", () => {
    for (const idea of data.ideas) {
      assert.ok(idea.helps && idea.helps.length > 40, `${idea.id} needs helps`);
      assert.ok(idea.watch && idea.watch.length > 40, `${idea.id} needs watch`);
    }
  });

  await test("every kit row has an http link", () => {
    for (const idea of data.ideas) {
      for (const [key, row] of Object.entries(idea.kit)) {
        assert.ok(/^https?:\/\//.test(row[1]), `${idea.id}.${key}`);
      }
    }
  });

  await test("remix lists are present", () => {
    assert.ok(data.remix.topics.length >= 10);
    assert.ok(data.remix.formats.length >= 5);
    assert.ok(data.remix.constraints.length >= 5);
  });

  /* ------------------------------------------------------------------ */
  /* Schema: the published contract must agree with the runtime rules.   */
  /* ------------------------------------------------------------------ */

  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "ideas.schema.json"), "utf8"));

  await test("ideas.schema.json uses only supported keywords", () => {
    assert.deepEqual(lintSchema(schema), []);
  });

  await test("ideas.json conforms to the schema", () => {
    assert.deepEqual(validateSchema(data, schema), []);
  });

  await test("schema and validator require the same idea fields", () => {
    const fromSchema = schema.$defs.idea.required.slice().sort();
    const fromValidator = [...REQUIRED_STRINGS, "goals", "lanes", "needs", "steps", "kit"].sort();
    assert.deepEqual(fromSchema, fromValidator);
  });

  /* Each fixture breaks one rule. `reject` says who must catch it:
   *   "both"      a shape rule the schema and validateCatalog agree on
   *   "schema"    a shape rule the runtime validator leaves to the schema
   *   "validator" a cross-idea rule a JSON Schema cannot express (unique ids)
   * The split is deliberate and asserted, so neither side can grow a silent gap. */
  const clone = () => JSON.parse(JSON.stringify(data));
  const fixtures = [
    { name: "id in capitals", reject: "both", edit: (d) => { d.ideas[0].id = "Water-Tank"; } },
    { name: "empty title", reject: "both", edit: (d) => { d.ideas[0].title = ""; } },
    { name: "no goals", reject: "both", edit: (d) => { d.ideas[0].goals = []; } },
    { name: "unknown goal", reject: "schema", edit: (d) => { d.ideas[0].goals = ["fame"]; } },
    { name: "unknown lane", reject: "both", edit: (d) => { d.ideas[0].lanes = ["vibes"]; } },
    { name: "unknown area", reject: "validator", edit: (d) => { d.ideas[0].area = "space"; } },
    { name: "two steps", reject: "both", edit: (d) => { d.ideas[0].steps = ["one", "two"]; } },
    { name: "kit row too short", reject: "both", edit: (d) => { d.ideas[0].kit = { x: ["name", "https://example.com"] }; } },
    { name: "kit row not a URL", reject: "both", edit: (d) => { d.ideas[0].kit = { x: ["name", "ftp://example.com", "note"] }; } },
    { name: "needs is not a list", reject: "both", edit: (d) => { d.ideas[0].needs = "a phone"; } },
    { name: "no helps", reject: "both", edit: (d) => { delete d.ideas[0].helps; } },
    { name: "no remix", reject: "both", edit: (d) => { delete d.remix; } },
    { name: "colour is a word", reject: "schema", edit: (d) => { d.areas[0].colour = "red"; } },
    { name: "date is not ISO", reject: "schema", edit: (d) => { d.updated = "11/11/2026"; } },
    { name: "unknown idea field", reject: "schema", edit: (d) => { d.ideas[0].vibe = "good"; } },
    { name: "duplicate id", reject: "validator", edit: (d) => { d.ideas[1].id = d.ideas[0].id; } },
  ];

  await test("every bad fixture is rejected by the right checker", () => {
    for (const f of fixtures) {
      const bad = clone();
      f.edit(bad);
      const schemaErrors = validateSchema(bad, schema);
      const validatorErrors = validateCatalog(bad);
      const wantsSchema = f.reject === "both" || f.reject === "schema";
      const wantsValidator = f.reject === "both" || f.reject === "validator";
      assert.equal(schemaErrors.length > 0, wantsSchema,
        `${f.name}: schema ${wantsSchema ? "should" : "should not"} reject, got ${schemaErrors.length} error(s)`);
      assert.equal(validatorErrors.length > 0, wantsValidator,
        `${f.name}: validator ${wantsValidator ? "should" : "should not"} reject, got ${validatorErrors.length} error(s)`);
    }
  });
}

/* ------------------------------------------------------------------ */
/* stdio helper                                                        */
/* ------------------------------------------------------------------ */

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, 800);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill();
  });
}

function startStdio(env = {}, args = []) {
  const child = spawn(process.execPath, [path.join(ROOT, "mcp", "server.mjs"), ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let buffer = "";
  let nextId = 1;
  const waiters = new Map();
  const stderr = [];

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let at;
    while ((at = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, at).trim();
      buffer = buffer.slice(at + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      const waiter = waiters.get(message.id);
      if (waiter) {
        waiters.delete(message.id);
        waiter(message);
      }
    }
  });

  return {
    stderr,
    request(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(id);
          reject(new Error(`timeout waiting for ${method}`));
        }, 5000);
        waiters.set(id, (message) => {
          clearTimeout(timer);
          if (message.error) reject(new Error(`${method}: ${message.error.message}`));
          else resolve(message.result);
        });
        child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      });
    },
    notify(method, params = {}) {
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
    },
    stop() {
      return stopChild(child);
    }
  };
}

/* ------------------------------------------------------------------ */
/* stdio                                                               */
/* ------------------------------------------------------------------ */

async function testStdio() {
  console.log("\nMCP over stdio (read-only)");
  const tmp = path.join(os.tmpdir(), `ideas-mcp-original-${process.pid}.json`);
  fs.copyFileSync(DATA_FILE, tmp);
  const client = startStdio({ IDEAS_DATA: tmp }, ["--read-only"]);

  try {
    const init = await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-suite", version: "1" }
    });
    await test("initialize returns the server identity", () => {
      assert.equal(init.serverInfo.name, "ideas-for-here");
      assert.equal(init.protocolVersion, "2025-06-18");
      assert.ok(init.capabilities.tools);
    });
    client.notify("notifications/initialized");

    const tools = await client.request("tools/list");
    await test("tools/list exposes the catalog tools", () => {
      const names = tools.tools.map((t) => t.name);
      for (const name of ["ideas_list", "ideas_search", "ideas_get", "ideas_stats", "ideas_suggest", "ideas_validate", "ideas_add", "ideas_update"]) {
        assert.ok(names.includes(name), `missing ${name}`);
      }
    });

    const got = await client.request("tools/call", { name: "ideas_get", arguments: { id: "garden-calendar" } });
    await test("ideas_get returns a full brief", () => {
      assert.equal(got.isError, false);
      assert.match(got.content[0].text, /Who it helps:/);
      assert.equal(got.structuredContent.id, "garden-calendar");
      assert.match(got.structuredContent.url, /\?idea=garden-calendar$/);
    });

    const search = await client.request("tools/call", { name: "ideas_search", arguments: { query: "water" } });
    await test("ideas_search finds water-related ideas", () => {
      assert.equal(search.isError, false);
      assert.ok(search.structuredContent.count >= 1);
    });

    const stats = await client.request("tools/call", { name: "ideas_stats", arguments: {} });
    await test("ideas_stats counts 31 ideas", () => {
      assert.equal(stats.structuredContent.total, 31);
    });

    const valid = await client.request("tools/call", { name: "ideas_validate", arguments: {} });
    await test("ideas_validate says the catalog is valid", () => {
      assert.equal(valid.structuredContent.valid, true);
    });

    const resource = await client.request("resources/read", { uri: "ideas://idea/garden-calendar" });
    await test("resources/read returns one idea", () => {
      const idea = JSON.parse(resource.contents[0].text);
      assert.equal(idea.id, "garden-calendar");
    });

    const resources = await client.request("resources/list");
    await test("resources/list includes the catalog", () => {
      assert.ok(resources.resources.some((r) => r.uri === "ideas://catalog"));
    });

    const prompt = await client.request("prompts/get", {
      name: "plan-a-local-app",
      arguments: { idea_id: "garden-calendar", audience: "a balcony gardener" }
    });
    await test("prompts/get builds a planning prompt", () => {
      assert.equal(prompt.messages.length, 1);
      assert.match(prompt.messages[0].content.text, /balcony gardener/);
    });

    const blocked = await client.request("tools/call", {
      name: "ideas_add",
      arguments: {
        title: "Blocked idea", tagline: "No.", describe: "No.",
        area: "community", minutes: "weekend", lanes: ["ready"],
        steps: ["One", "Two", "Three"], helps: "Nobody.", watch: "It is blocked."
      }
    });
    await test("read-only server refuses ideas_add", () => {
      assert.equal(blocked.isError, true);
      assert.match(blocked.content[0].text, /read-only/);
    });
  } finally {
    await client.stop();
    fs.rmSync(tmp, { force: true });
  }
}

async function testWrites() {
  console.log("\nMCP writes (temporary catalog)");
  const tmp = path.join(os.tmpdir(), `ideas-mcp-write-${process.pid}.json`);
  fs.copyFileSync(DATA_FILE, tmp);
  const client = startStdio({ IDEAS_DATA: tmp });

  try {
    await client.request("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    client.notify("notifications/initialized");

    const added = await client.request("tools/call", {
      name: "ideas_add",
      arguments: {
        title: "A temporary test idea",
        tagline: "Only exists in the test.",
        describe: "This idea is written to a temporary catalog and deleted with it.",
        area: "community",
        minutes: "weekend",
        lanes: ["ready"],
        needs: ["A phone"],
        steps: ["Write it down.", "Show it to one neighbour.", "Try it for a week."],
        helps: "The test suite, and nobody else.",
        watch: "It must never reach the real catalog.",
        kit: { publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"] }
      }
    });
    await test("ideas_add writes a new idea", () => {
      assert.equal(added.isError, false);
      const data = JSON.parse(fs.readFileSync(tmp, "utf8"));
      assert.equal(data.ideas.length, 32);
      assert.equal(data.ideas.at(-1).title, "A temporary test idea");
    });

    const id = added.structuredContent.id;
    const updated = await client.request("tools/call", {
      name: "ideas_update",
      arguments: { id, tagline: "Updated by the test." }
    });
    await test("ideas_update changes one field", () => {
      assert.equal(updated.isError, false);
      const data = JSON.parse(fs.readFileSync(tmp, "utf8"));
      assert.equal(data.ideas.find((i) => i.id === id).tagline, "Updated by the test.");
    });

    const before = fs.readFileSync(tmp);
    const refused = await client.request("tools/call", {
      name: "ideas_update",
      arguments: { id, area: "nowhere" }
    });
    await test("a rejected update leaves the file byte-identical", () => {
      assert.equal(refused.isError, true);
      assert.ok(before.equals(fs.readFileSync(tmp)), "file changed after a rejected write");
    });

    const bad = await client.request("tools/call", {
      name: "ideas_add",
      arguments: {
        title: "Missing pieces", tagline: "No.", describe: "No.",
        area: "nowhere", minutes: "weekend", lanes: ["ready"],
        steps: ["One", "Two", "Three"], helps: "None.", watch: "None."
      }
    });
    await test("ideas_add rejects an unknown area", () => {
      assert.equal(bad.isError, true);
    });
  } finally {
    await client.stop();
    fs.rmSync(tmp, { force: true });
  }
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

function startHttp() {
  const child = spawn(process.execPath, [path.join(ROOT, "server.mjs"), "--port", "0", "--read-only"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"]
  });
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("HTTP server did not start")), 6000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = /http:\/\/127\.0\.0\.1:(\d+)\//.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve({ child, base: `http://127.0.0.1:${match[1]}` });
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`HTTP server exited with ${code}`));
    });
  });
}

async function rpc(base, method, params = {}, headers = {}) {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  assert.equal(res.status, 200);
  const message = await res.json();
  assert.equal(message.error, undefined, message.error && message.error.message);
  return { result: message.result, headers: res.headers };
}

async function testHttp() {
  console.log("\nMCP over HTTP + live API");
  const { child, base } = await startHttp();
  try {
    const api = await fetch(`${base}/api/ideas`);
    await test("GET /api/ideas returns the catalog", async () => {
      assert.equal(api.status, 200);
      assert.equal(api.headers.get("cache-control"), "no-store");
      const data = await api.json();
      assert.equal(data.ideas.length, 31);
    });

    const home = await fetch(`${base}/`);
    await test("GET / serves the page", async () => {
      assert.equal(home.status, 200);
      const html = await home.text();
      assert.match(html, /Ideas for Here/);
    });

    const init = await rpc(base, "initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    await test("POST /mcp initializes and sets a session id", () => {
      assert.equal(init.result.serverInfo.name, "ideas-for-here");
      assert.ok(init.headers.get("mcp-session-id"));
    });

    await test("POST /mcp sends no CORS headers", () => {
      assert.equal(init.headers.get("access-control-allow-origin"), null);
    });

    const session = init.headers.get("mcp-session-id");
    const got = await rpc(base, "tools/call", { name: "ideas_get", arguments: { id: "meter-reader" } }, { "Mcp-Session-Id": session });
    await test("POST /mcp calls a tool", () => {
      assert.equal(got.result.structuredContent.id, "meter-reader");
    });

    const getMcp = await fetch(`${base}/mcp`);
    await test("GET /mcp is rejected clearly", () => {
      assert.equal(getMcp.status, 405);
      assert.equal(getMcp.headers.get("allow"), "POST, DELETE, OPTIONS");
    });

    const badJson = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{"
    });
    await test("invalid JSON returns 400 with a parse error", async () => {
      assert.equal(badJson.status, 400);
      const body = await badJson.json();
      assert.equal(body.error.code, -32700);
    });

    const notification = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
    });
    await test("a notification returns 202 and no body", () => {
      assert.equal(notification.status, 202);
    });

    const batch = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        { jsonrpc: "2.0", id: 1, method: "ping" },
        { jsonrpc: "2.0", id: 2, method: "tools/list" }
      ])
    });
    await test("a batch is answered with an array", async () => {
      const replies = await batch.json();
      assert.ok(Array.isArray(replies));
      assert.equal(replies.length, 2);
      assert.deepEqual(replies[0].result, {});
      assert.ok(replies[1].result.tools);
    });

    const backslash = await fetch(`${base}/x%5C..%5C.git%5Cconfig`);
    await test("encoded backslashes cannot escape the folder", () => {
      assert.equal(backslash.status, 403);
    });

    const upperMcp = await fetch(`${base}/MCP/core.mjs`);
    await test("case does not expose the mcp folder", () => {
      assert.equal(upperMcp.status, 403);
    });

    const validate = await fetch(`${base}/api/validate`);
    await test("GET /api/validate reports a valid catalog", async () => {
      const body = await validate.json();
      assert.equal(body.valid, true);
      assert.deepEqual(body.errors, []);
    });
  } finally {
    await stopChild(child);
  }
}

/* ------------------------------------------------------------------ */
/* Server guardrails                                                  */
/* ------------------------------------------------------------------ */

function startHttpGuard(args = [], env = {}) {
  const child = spawn(process.execPath, [path.join(ROOT, "server.mjs"), ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  return new Promise((resolve, reject) => {
    let out = "", err = "", done = false;
    const timer = setTimeout(() => { done = true; child.kill(); reject(new Error("guardrail server did not start")); }, 6000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (c) => { out += c; });
    child.stderr.on("data", (c) => { err += c; });
    const giveUp = (code) => { if (done) return; done = true; clearTimeout(timer); child.removeListener("exit", giveUp); reject(new Error(`server exited with code ${code}; stderr: ${err}`)); };
    child.on("exit", giveUp);
    child.stdout.on("data", () => {
      const match = /http:\/\/([^\s:/]+):(\d+)\//.exec(out);
      if (match) {
        done = true;
        clearTimeout(timer);
        child.removeListener("exit", giveUp);
        resolve({ child, base: `http://127.0.0.1:${match[2]}`, host: match[1], out, err });
      }
    });
  });
}

async function postRaw(base, path, body, headers = {}) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body
  });
}

async function testGuardrails() {
  console.log("\nServer guardrails");

  const { child: c1, base: b1 } = await startHttpGuard(["--port", "0", "--read-only"]);
  try {
    const health = await fetch(`${b1}/health`);
    await test("binds to loopback by default", async () => {
      assert.equal(health.status, 200);
      const body = await health.json();
      assert.equal(body.ok, true);
    });

    const big = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { padding: "x".repeat(300_000) } });
    const tooLarge = await postRaw(b1, "/mcp", big);
    await test("/mcp bodies over 256 KB get 413", () => {
      assert.equal(tooLarge.status, 413);
    });

    const crossOrigin = await postRaw(b1, "/mcp", JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }), { origin: "https://evil.example" });
    await test("a cross-site Origin is refused", () => {
      assert.equal(crossOrigin.status, 403);
    });

    const crossSite = await postRaw(b1, "/mcp", JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }), { "sec-fetch-site": "cross-site" });
    await test("Sec-Fetch-Site: cross-site is refused", () => {
      assert.equal(crossSite.status, 403);
    });

    const sameOrigin = await postRaw(b1, "/mcp", JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }), { origin: `http://127.0.0.1:${new URL(b1).port}` });
    await test("a same-origin Origin is allowed", async () => {
      assert.equal(sameOrigin.status, 200);
      const body = await sameOrigin.json();
      assert.equal(body.jsonrpc, "2.0");
    });

    const noOrigin = await postRaw(b1, "/mcp", JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));
    await test("no Origin header is allowed", async () => {
      assert.equal(noOrigin.status, 200);
    });

    const modules = await fetch(`${b1}/node_modules/axe-core/axe.min.js`);
    await test("/node_modules is not served", () => {
      assert.equal(modules.status, 403);
    });

    const dotfile = await fetch(`${b1}/.gitignore`);
    await test("dotfiles are not served", () => {
      assert.equal(dotfile.status, 403);
    });

    const statuses = [];
    for (let i = 0; i < 25; i += 1) {
      statuses.push((await postRaw(b1, "/mcp", JSON.stringify({ jsonrpc: "2.0", id: i, method: "initialize", params: {} }))).status);
    }
    await test("a token bucket eventually answers 429", () => {
      assert.ok(statuses.includes(429), `expected a 429 among ${JSON.stringify(statuses)}`);
    });
  } finally {
    await stopChild(c1);
  }

  /* Explicit --host with a non-loopback address starts and warns. */
  const { child: c2, err: err2 } = await startHttpGuard(["--host", "0.0.0.0", "--port", "0", "--read-only"]);
  await stopChild(c2);
  await test("explicit --host 0.0.0.0 starts and warns", () => {
    assert.ok(/warning/i.test(err2), `expected a warning in stderr, got: ${err2}`);
  });

  /* A non-loopback HOST without --host is refused outright. */
  const serverPath = path.join(ROOT, "server.mjs");
  const refused = spawn(process.execPath, [serverPath], {
    cwd: ROOT,
    env: { ...process.env, HOST: "0.0.0.0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let refusedErr = "";
  refused.stderr.setEncoding("utf8");
  refused.stderr.on("data", (c) => { refusedErr += c; });
  const refusedCode = await new Promise((resolve) => {
    refused.on("exit", (code) => resolve(code));
    setTimeout(() => { try { refused.kill(); } catch {}; resolve(refused.exitCode); }, 4000);
  });
  await test("non-loopback HOST without --host is refused", () => {
    assert.equal(refusedCode, 1);
    assert.ok(/Refusing to bind/.test(refusedErr), `expected refusal in stderr, got: ${refusedErr}`);
  });
}

/* Search matcher                                                     */
/* ------------------------------------------------------------------ */

async function testMatcher() {
  console.log("\nSearch matcher");
  const data = readCatalog();
  const areaLabelOf = (id) => {
    const a = data.areas.find((x) => x.id === id);
    return a ? a.label : "";
  };

  /* query -> expected idea ids. Regenerate with tools/gen-table.mjs if the
     matcher or the catalog changes; this table is the deliberate contract. */
  const cases = [
    ["water", ["bill-split", "building-board", "garden-calendar", "meter-reader", "outage-map"]],
    ["rubbish", ["pothole-report"]],
    ["school", ["bread-coach", "chores-allowance", "first-cv", "fridge-recipes", "hobby-coach",
      "lost-found", "medicine-reminder", "school-deadlines", "volunteer-shifts", "weekend-kids"]],
    ["egg", ["market-prices"]],
    ["invoice", ["trade-invoice"]],
    ["celebration", ["gift-budget"]],
    ["baking", ["bread-coach", "home-baker-catalog"]],
    ["car", ["appointment-log", "building-board", "car-service", "two-currencies"]],
    ["cv", ["first-cv"]],
    ["paperwork", ["appointment-log", "car-service", "paperwork-checklist", "school-deadlines"]],
    ["waste", ["pothole-report"]],
    ["bikes", ["skill-swap"]],
    ["medicine", ["appointment-log", "medicine-reminder"]],
    ["water calorie", []],
    ["gibberishxyz", []]
  ];

  function check(query, expected) {
    const got = data.ideas
      .filter((idea) => matchQuery(idea, query, areaLabelOf(idea.area)))
      .map((idea) => idea.id)
      .sort();
    assert.deepEqual(got, expected);
  }

  await test("search matches “water”", () => {
    check("water", ["bill-split", "building-board", "garden-calendar", "meter-reader", "outage-map"]);
  });
  await test("search matches “rubbish”", () => {
    check("rubbish", ["pothole-report"]);
  });
  await test("search matches “school”", () => {
    check("school", ["bread-coach", "chores-allowance", "first-cv", "fridge-recipes", "hobby-coach",
      "lost-found", "medicine-reminder", "school-deadlines", "volunteer-shifts", "weekend-kids"]);
  });
  await test("search matches “egg”", () => {
    check("egg", ["market-prices"]);
  });
  await test("search matches “invoice”", () => {
    check("invoice", ["trade-invoice"]);
  });
  await test("search matches “celebration”", () => {
    check("celebration", ["gift-budget"]);
  });
  await test("search matches “baking”", () => {
    check("baking", ["bread-coach", "home-baker-catalog"]);
  });
  await test("search matches “car”", () => {
    check("car", ["appointment-log", "building-board", "car-service", "two-currencies"]);
  });
  await test("search matches “cv”", () => {
    check("cv", ["first-cv"]);
  });
  await test("search matches “paperwork”", () => {
    check("paperwork", ["appointment-log", "car-service", "paperwork-checklist", "school-deadlines"]);
  });
  await test("search matches “waste”", () => {
    check("waste", ["pothole-report"]);
  });
  await test("search matches “bikes”", () => {
    check("bikes", ["skill-swap"]);
  });
  await test("search matches “medicine”", () => {
    check("medicine", ["appointment-log", "medicine-reminder"]);
  });
  await test("search matches “water calorie”", () => {
    check("water calorie", []);
  });
  await test("search matches “gibberishxyz”", () => {
    check("gibberishxyz", []);
  });

  await test("search matcher rejects an empty query", () => {
    for (const idea of data.ideas) {
      assert.equal(matchQuery(idea, "", areaLabelOf(idea.area)), false);
      assert.equal(matchQuery(idea, "   ", areaLabelOf(idea.area)), false);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Match badges and the something-different walk                       */
/* ------------------------------------------------------------------ */

async function testMatch() {
  console.log("\nMatch badges and the walk");
  const data = readCatalog();
  const idea = (id) => data.ideas.find((i) => i.id === id);
  const garden = idea("garden-calendar");   /* food, weekend, ease+learn, all lanes */
  const bread = idea("bread-coach");        /* food, evenings, learn+ease, ready+assistant */
  const market = idea("market-prices");     /* money, weekend, ease+earn */
  const texts = (list) => list.map((b) => b.text);

  await test("an area match shows the area badge", () => {
    const list = badgesFor({ area: "food", goal: null, time: null, lane: null }, garden);
    assert.deepEqual(texts(list), ["food"]);
    assert.equal(list[0].mark, "\u2713");
    assert.equal(list[0].kind, "hit");
  });

  await test("a goal match shows the goal badge", () => {
    const list = badgesFor({ area: null, goal: "learn", time: null, lane: null }, garden);
    assert.deepEqual(texts(list), ["learning"]);
    assert.equal(list[0].kind, "hit");
  });

  await test("an exact time match shows the time badge", () => {
    const list = badgesFor({ area: null, goal: null, time: "weekend", lane: null }, garden);
    assert.deepEqual(texts(list), ["weekend"]);
    assert.equal(list[0].mark, "\u2713");
  });

  await test("an adjacent time match shows a near badge", () => {
    const list = badgesFor({ area: null, goal: null, time: "weekend", lane: null }, bread);
    assert.deepEqual(texts(list), ["evenings"]);
    assert.equal(list[0].mark, "~");
    assert.equal(list[0].kind, "near");
  });

  await test("a build-lane match shows the lane badge", () => {
    const list = badgesFor({ area: null, goal: null, time: null, lane: "ready" }, garden);
    assert.deepEqual(texts(list), ["no code"]);
  });

  await test("answers that hit nothing fall back to one closest-fit badge", () => {
    const odd = { area: "health", minutes: "month", goals: ["help"], lanes: ["code"] };
    const list = badgesFor({ area: "food", goal: "earn", time: "weekend", lane: "ready" }, odd);
    assert.equal(list.length, 1);
    assert.equal(list[0].kind, "fallback");
    assert.equal(list[0].text, "closest fit");
  });

  await test("a badge appears only when its scoring branch scored", () => {
    const list = badgesFor({ area: "money", goal: "learn", time: "weekend", lane: "ready" }, garden);
    assert.deepEqual(texts(list), ["learning", "weekend", "no code"]);
  });

  const areas = data.areas.map((a) => a.id);
  const start = { area: "food", goal: "ease", time: "weekend", lane: "ready" };

  await test("the walk is deterministic for one starting answer set", () => {
    const a = nextAnswers(start, areas);
    const b = nextAnswers(start, areas);
    assert.deepEqual(a, b);
    assert.deepEqual(a.changed.map((c) => c.key), ["from-goal", "from-area"]);
  });

  await test("the walk keeps the time and build lane", () => {
    const step = nextAnswers(start, areas);
    assert.equal(step.answers.time, "weekend");
    assert.equal(step.answers.lane, "ready");
  });

  await test("the walk visits every area before repeating one", () => {
    let answers = { ...start };
    const seen = [];
    for (let i = 0; i < areas.length; i += 1) {
      const step = nextAnswers(answers, areas);
      answers = step.answers;
      seen.push(answers.area);
    }
    assert.equal(new Set(seen).size, areas.length);
    assert.equal(seen[0], areas[(areas.indexOf(start.area) + 1) % areas.length]);
  });

  await test("the walk reaches every goal in the question order", () => {
    let answers = { ...start };
    const seen = [];
    for (let i = 0; i < GOAL_ORDER.length; i += 1) {
      answers = nextAnswers(answers, areas).answers;
      seen.push(answers.goal);
    }
    assert.equal(new Set(seen).size, GOAL_ORDER.length);
  });
}

/* ------------------------------------------------------------------ */

await testData();
if (!DATA_ONLY) {
  await testStdio();
  await testWrites();
  await testHttp();
  await testMatcher();
  await testMatch();
  await testGuardrails();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
