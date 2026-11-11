#!/usr/bin/env node
/* Ideas for Here — local dynamic server.
 *
 *   node server.mjs [--port 4173] [--host 127.0.0.1] [--read-only]
 *
 * Serves the static page, a live /api/ideas endpoint backed by ideas.json,
 * and the same MCP handler at /mcp over Streamable HTTP. Zero dependencies.
 * The public GitHub Pages site keeps working without this server; it reads
 * ideas.json directly and stays read-only.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRpcHandler, readCatalog, validateCatalog, DATA_FILE, RpcError } from "./mcp/core.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback) {
  const at = process.argv.indexOf(name);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}

const PORT = Number(argValue("--port", process.env.PORT || 4173));
const HOST = argValue("--host", process.env.HOST || "127.0.0.1");
const READ_ONLY = process.argv.includes("--read-only");
const handleRpc = createRpcHandler({ readOnly: READ_ONLY });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version"
};

function send(res, status, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body || "", "utf8");
  res.writeHead(status, {
    "Content-Length": payload.length,
    ...CORS,
    ...headers
  });
  if (res.req && res.req.method === "HEAD") res.end();
  else res.end(payload);
}

function json(res, status, value, headers = {}) {
  send(res, status, JSON.stringify(value), {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
}

function resolveStatic(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const rel = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  if (!rel || rel.startsWith(".") || rel.split("/").some((part) => part.startsWith("."))) return null;
  if (/^(mcp|tools)(\/|$)/.test(rel)) return null;
  const full = path.resolve(ROOT, rel);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  return full;
}

function readBody(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleMcp(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method === "DELETE") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, "Use POST for MCP.\n", { Allow: "POST, DELETE, OPTIONS", "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    json(res, 413, { jsonrpc: "2.0", id: null, error: { code: -32600, message: err.message } });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    json(res, 200, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }

  const batch = Array.isArray(parsed);
  const messages = batch ? parsed : [parsed];
  const replies = [];
  let sawInitialize = false;
  let sawNotification = false;

  for (const message of messages) {
    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      if (message && message.id !== undefined) {
        replies.push({ jsonrpc: "2.0", id: message.id, error: { code: -32600, message: "Invalid Request" } });
      }
      continue;
    }
    if (message.method === "initialize") sawInitialize = true;
    if (message.id === undefined) {
      sawNotification = true;
      continue;
    }
    try {
      const result = await handleRpc(message.method, message.params || {});
      replies.push({ jsonrpc: "2.0", id: message.id, result });
    } catch (err) {
      replies.push({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: err instanceof RpcError ? err.code : -32603,
          message: err && err.message ? err.message : "Internal error"
        }
      });
    }
  }

  const session = req.headers["mcp-session-id"] || (sawInitialize ? crypto.randomUUID() : null);
  const headers = {};
  if (session) headers["Mcp-Session-Id"] = String(session);

  if (!replies.length) {
    if (sawNotification) {
      res.writeHead(202, { ...CORS, ...headers });
      res.end();
      return;
    }
    json(res, 200, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Empty request" } }, headers);
    return;
  }

  json(res, 200, batch ? replies : replies[0], headers);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

  if (url.pathname === "/health") {
    json(res, 200, { ok: true, readOnly: READ_ONLY, ideas: readCatalog().ideas.length });
    return;
  }

  if (url.pathname === "/api/ideas" && (req.method === "GET" || req.method === "HEAD")) {
    try {
      const data = readCatalog();
      json(res, 200, data, { "Cache-Control": "no-store" });
    } catch (err) {
      json(res, 500, { error: "Could not read ideas.json", detail: err.message });
    }
    return;
  }

  if (url.pathname === "/api/validate" && (req.method === "GET" || req.method === "HEAD")) {
    try {
      const errors = validateCatalog(readCatalog());
      json(res, 200, { valid: errors.length === 0, errors }, { "Cache-Control": "no-store" });
    } catch (err) {
      json(res, 500, { valid: false, errors: [err.message] });
    }
    return;
  }

  if (url.pathname === "/mcp") {
    await handleMcp(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const file = resolveStatic(url.pathname);
  if (!file) {
    send(res, 403, "Not found.\n", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  let stat;
  try {
    stat = fs.statSync(file);
    if (stat.isDirectory()) stat = fs.statSync(path.join(file, "index.html"));
  } catch {
    const notFound = path.join(ROOT, "404.html");
    if (fs.existsSync(notFound)) {
      send(res, 404, fs.readFileSync(notFound), { "Content-Type": MIME[".html"] });
    } else {
      send(res, 404, "Not found.\n", { "Content-Type": "text/plain; charset=utf-8" });
    }
    return;
  }

  const target = stat.isDirectory() ? path.join(file, "index.html") : file;
  try {
    let body = fs.readFileSync(target);
    const ext = path.extname(target).toLowerCase();
    /* Only this server can serve /api/ideas, so tell the loader it exists.
     * Prepended, because the loader reads the flag as it runs. The static
     * file on GitHub Pages has no such line and never probes the endpoint. */
    if (url.pathname === "/ideas.js") {
      body = Buffer.concat([Buffer.from('window.CATALOG_API = "api/ideas";\n', "utf8"), body]);
    }
    send(res, 200, body, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
  } catch {
    send(res, 404, "Not found.\n", { "Content-Type": "text/plain; charset=utf-8" });
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Try: node server.mjs --port ${PORT + 1}`);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const actual = server.address().port;
  console.log(`Ideas for Here — http://${HOST}:${actual}/`);
  console.log(`  catalog API   http://${HOST}:${actual}/api/ideas`);
  console.log(`  validation    http://${HOST}:${actual}/api/validate`);
  console.log(`  MCP (HTTP)    http://${HOST}:${actual}/mcp`);
  console.log(`  data file     ${DATA_FILE}`);
  if (READ_ONLY) console.log("  read-only     ideas_add and ideas_update are disabled");
});
