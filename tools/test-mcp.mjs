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
import { DATA_FILE, readCatalog, validateCatalog } from "../mcp/core.mjs";

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

await testData();
if (!DATA_ONLY) {
  await testStdio();
  await testWrites();
  await testHttp();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
