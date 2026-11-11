#!/usr/bin/env node
/* Ideas for Here — MCP server over stdio.
 *
 * Any MCP-capable agent can run `node mcp/server.mjs` from this folder.
 * Pass --read-only to hide writes (ideas_add / ideas_update).
 * stdout carries protocol messages only; diagnostics go to stderr.
 */
import readline from "node:readline";
import { createRpcHandler, RpcError } from "./core.mjs";

const readOnly = process.argv.includes("--read-only");
const handle = createRpcHandler({ readOnly });

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function errorFor(err) {
  return {
    code: err instanceof RpcError ? err.code : -32603,
    message: err && err.message ? err.message : "Internal error"
  };
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", async (line) => {
  const raw = line.trim();
  if (!raw) return;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }

  const batch = Array.isArray(parsed);
  const messages = batch ? parsed : [parsed];
  const replies = [];

  for (const message of messages) {
    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      if (message && message.id !== undefined) {
        replies.push({ jsonrpc: "2.0", id: message.id, error: { code: -32600, message: "Invalid Request" } });
      }
      continue;
    }
    /* Notifications (no id), including notifications/initialized, need no reply. */
    if (message.id === undefined) continue;

    try {
      const result = await handle(message.method, message.params || {});
      replies.push({ jsonrpc: "2.0", id: message.id, result });
    } catch (err) {
      replies.push({ jsonrpc: "2.0", id: message.id, error: errorFor(err) });
    }
  }

  if (!replies.length) return;
  if (batch) send(replies);
  else send(replies[0]);
});

rl.on("close", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
