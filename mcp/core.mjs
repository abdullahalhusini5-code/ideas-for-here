/* Ideas for Here — shared catalog + MCP logic.
 *
 * Zero dependencies. Used by the stdio server (mcp/server.mjs) and by the
 * local HTTP server (server.mjs), which exposes the same handler at /mcp.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SITE = "https://abdullahalhusini5-code.github.io/ideas-for-here";
export const VERSION = "1.0.0";
export const DATA_FILE = process.env.IDEAS_DATA
  ? path.resolve(process.env.IDEAS_DATA)
  : fileURLToPath(new URL("../ideas.json", import.meta.url));

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export class RpcError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

export function readCatalog(file = DATA_FILE) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeCatalog(data, file = DATA_FILE) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
}

export function labelFor(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const REQUIRED_STRINGS = ["id", "title", "tagline", "describe", "area", "minutes", "helps", "watch"];

export function validateCatalog(data) {
  const errors = [];
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return ["catalog is not an object"];
  }
  for (const key of ["areas", "times", "lanes", "ideas"]) {
    if (!Array.isArray(data[key])) errors.push(`${key} must be an array`);
  }
  if (!data.remix || typeof data.remix !== "object") errors.push("remix must be an object");
  if (errors.length) return errors;

  const areaIds = new Set(data.areas.map((a) => a.id));
  const timeIds = new Set(data.times.map((t) => t.id));
  const laneIds = new Set(data.lanes.map((l) => l.id));
  const ids = new Set();

  data.ideas.forEach((idea, i) => {
    const at = `ideas[${i}]${idea && idea.id ? ` (${idea.id})` : ""}`;
    if (!idea || typeof idea !== "object" || Array.isArray(idea)) {
      errors.push(`${at} is not an object`);
      return;
    }
    for (const field of REQUIRED_STRINGS) {
      if (typeof idea[field] !== "string" || !idea[field].trim()) {
        errors.push(`${at}.${field} must be a non-empty string`);
      }
    }
    if (typeof idea.id === "string" && !/^[a-z0-9-]+$/.test(idea.id)) {
      errors.push(`${at}.id must contain only a-z, 0-9 and hyphens`);
    }
    if (ids.has(idea.id)) errors.push(`${at}.id is duplicated`);
    ids.add(idea.id);

    if (!areaIds.has(idea.area)) errors.push(`${at}.area is not one of ${[...areaIds].join(", ")}`);
    if (!timeIds.has(idea.minutes)) errors.push(`${at}.minutes is not one of ${[...timeIds].join(", ")}`);
    if (!Array.isArray(idea.goals) || !idea.goals.length) errors.push(`${at}.goals must be a non-empty array`);
    if (!Array.isArray(idea.lanes) || !idea.lanes.length) errors.push(`${at}.lanes must be a non-empty array`);
    else idea.lanes.forEach((lane) => {
      if (!laneIds.has(lane)) errors.push(`${at}.lanes contains unknown lane ${lane}`);
    });
    if (!Array.isArray(idea.needs)) errors.push(`${at}.needs must be an array`);
    if (!Array.isArray(idea.steps) || idea.steps.length < 3) errors.push(`${at}.steps needs at least three steps`);
    if (!idea.kit || typeof idea.kit !== "object" || Array.isArray(idea.kit)) {
      errors.push(`${at}.kit must be an object`);
    } else {
      for (const [key, row] of Object.entries(idea.kit)) {
        if (!Array.isArray(row) || row.length < 3) {
          errors.push(`${at}.kit.${key} must be [name, url, note]`);
          continue;
        }
        if (typeof row[0] !== "string" || !row[0].trim()) errors.push(`${at}.kit.${key}[0] name missing`);
        if (typeof row[1] !== "string" || !/^https?:\/\//i.test(row[1])) errors.push(`${at}.kit.${key}[1] must be an http(s) URL`);
        if (typeof row[2] !== "string" || !row[2].trim()) errors.push(`${at}.kit.${key}[2] note missing`);
      }
    }
  });

  return errors;
}

export function areaOf(data, idea) {
  return data.areas.find((a) => a.id === idea.area) || { id: idea.area, label: idea.area, colour: "#999" };
}

export function timeOf(data, idea) {
  return (data.times.find((t) => t.id === idea.minutes) || { label: idea.minutes }).label;
}

export function lanesOf(data, idea) {
  return idea.lanes.map((id) => (data.lanes.find((l) => l.id === id) || { label: id }).label);
}

export function publicIdea(data, idea) {
  return {
    ...idea,
    areaLabel: areaOf(data, idea).label,
    timeLabel: timeOf(data, idea),
    laneLabels: lanesOf(data, idea),
    url: `${SITE}/?idea=${encodeURIComponent(idea.id)}`
  };
}

export function ideaText(data, idea) {
  const lines = [
    `${idea.title} — ${idea.tagline}`,
    `Area: ${areaOf(data, idea).label} · Time: ${timeOf(data, idea)} · Build: ${lanesOf(data, idea).join("; ")}`,
    "",
    idea.describe,
    "",
    `Who it helps: ${idea.helps}`,
    `What to watch for: ${idea.watch}`,
    "",
    "First moves:",
    ...idea.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    `Needs: ${idea.needs.length ? idea.needs.join(", ") : "nothing special"}`,
    `Free pieces: ${Object.keys(idea.kit).length}`,
    `Page: ${SITE}/?idea=${encodeURIComponent(idea.id)}`
  ];
  return lines.join("\n");
}

function snippet(text, query, radius = 70) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return text.slice(0, radius * 2) + (text.length > radius * 2 ? "…" : "");
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + query.length + radius);
  return `${start ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export function searchIdeas(data, query, limit = 10) {
  const q = String(query || "").trim();
  if (!q) return [];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = [];
  for (const idea of data.ideas) {
    const title = idea.title.toLowerCase();
    const tagline = idea.tagline.toLowerCase();
    const body = [
      idea.describe, idea.id, areaOf(data, idea).label, idea.helps, idea.watch,
      (idea.needs || []).join(" "), (idea.steps || []).join(" "),
      ...Object.values(idea.kit || {}).map((row) => row[0])
    ].join(" ").toLowerCase();
    let score = 0;
    let matchedAll = true;
    for (const w of words) {
      let hit = 0;
      if (title.includes(w)) hit += 5;
      if (tagline.includes(w)) hit += 3;
      if (body.includes(w)) hit += 1;
      if (!hit) matchedAll = false;
      score += hit;
    }
    if (!matchedAll) continue;
    scored.push({ idea, score, where: title.includes(words[0]) ? idea.title : snippet(idea.describe, words[0]) });
  }
  scored.sort((a, b) => b.score - a.score || a.idea.title.localeCompare(b.idea.title));
  return scored.slice(0, Math.max(1, Math.min(50, limit)));
}

function asString(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new RpcError(-32602, `${field} must be a non-empty string`);
  return value.trim();
}

function asStringArray(value, field, { min = 0 } = {}) {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !v.trim())) {
    throw new RpcError(-32602, `${field} must be an array of non-empty strings`);
  }
  if (value.length < min) throw new RpcError(-32602, `${field} needs at least ${min} entries`);
  return value.map((v) => v.trim());
}

function cleanKit(kit) {
  if (kit === undefined) return undefined;
  if (!kit || typeof kit !== "object" || Array.isArray(kit)) {
    throw new RpcError(-32602, "kit must be an object of [name, url, note] rows");
  }
  const out = {};
  for (const [key, row] of Object.entries(kit)) {
    if (!/^[a-z][a-z0-9]*$/i.test(key)) throw new RpcError(-32602, `kit key ${key} must be a word`);
    if (!Array.isArray(row) || row.length < 3) throw new RpcError(-32602, `kit.${key} must be [name, url, note]`);
    const [name, url, note] = row.map((v) => String(v).trim());
    if (!name || !note) throw new RpcError(-32602, `kit.${key} needs a name and a note`);
    if (!/^https?:\/\//i.test(url)) throw new RpcError(-32602, `kit.${key} url must start with http(s)://`);
    out[key] = [name, url, note];
  }
  return out;
}

export function buildIdea(data, input) {
  const title = asString(input.title, "title");
  const area = asString(input.area, "area");
  const minutes = asString(input.minutes, "minutes");
  if (!data.areas.some((a) => a.id === area)) {
    throw new RpcError(-32602, `area must be one of ${data.areas.map((a) => a.id).join(", ")}`);
  }
  if (!data.times.some((t) => t.id === minutes)) {
    throw new RpcError(-32602, `minutes must be one of ${data.times.map((t) => t.id).join(", ")}`);
  }
  const lanes = asStringArray(input.lanes, "lanes", { min: 1 });
  lanes.forEach((lane) => {
    if (!data.lanes.some((l) => l.id === lane)) {
      throw new RpcError(-32602, `lanes must be among ${data.lanes.map((l) => l.id).join(", ")}`);
    }
  });

  const base = slugify(title);
  let id = base || `idea-${Date.now().toString(36)}`;
  let n = 2;
  while (data.ideas.some((i) => i.id === id)) id = `${base}-${n++}`;

  const goals = input.goals === undefined ? ["ease"] : asStringArray(input.goals, "goals", { min: 1 });
  const idea = {
    id,
    title,
    tagline: asString(input.tagline, "tagline"),
    describe: asString(input.describe, "describe"),
    area,
    goals,
    minutes,
    lanes,
    needs: input.needs === undefined ? [] : asStringArray(input.needs, "needs"),
    steps: asStringArray(input.steps, "steps", { min: 3 }),
    kit: cleanKit(input.kit) || {},
    helps: asString(input.helps, "helps"),
    watch: asString(input.watch, "watch")
  };
  return idea;
}

const UPDATE_FIELDS = ["title", "tagline", "describe", "area", "goals", "minutes", "lanes", "needs", "steps", "kit", "helps", "watch"];

export function updateIdea(data, input) {
  const id = asString(input.id, "id");
  const idea = data.ideas.find((i) => i.id === id);
  if (!idea) throw new RpcError(-32602, `no idea with id ${id}`);
  for (const field of UPDATE_FIELDS) {
    if (input[field] === undefined) continue;
    if (["goals", "lanes", "needs", "steps"].includes(field)) {
      idea[field] = asStringArray(input[field], field, { min: field === "lanes" || field === "steps" ? 1 : 0 });
    } else if (field === "kit") {
      idea.kit = cleanKit(input.kit);
    } else {
      idea[field] = asString(input[field], field);
    }
  }
  if (!data.areas.some((a) => a.id === idea.area)) {
    throw new RpcError(-32602, `area must be one of ${data.areas.map((a) => a.id).join(", ")}`);
  }
  if (!data.times.some((t) => t.id === idea.minutes)) {
    throw new RpcError(-32602, `minutes must be one of ${data.times.map((t) => t.id).join(", ")}`);
  }
  idea.lanes.forEach((lane) => {
    if (!data.lanes.some((l) => l.id === lane)) {
      throw new RpcError(-32602, `lanes must be among ${data.lanes.map((l) => l.id).join(", ")}`);
    }
  });
  return idea;
}

/* ------------------------------------------------------------------ */
/* MCP surface                                                         */
/* ------------------------------------------------------------------ */

export const TOOLS = [
  {
    name: "ideas_list",
    title: "List ideas",
    description: "List the catalog, optionally filtered by area, available time or build lane. Returns compact records with a page link.",
    inputSchema: {
      type: "object",
      properties: {
        area: { type: "string", description: "Area id: food, money, home, family, health, learning, community or work." },
        time: { type: "string", enum: ["weekend", "evenings", "month"], description: "How much time the project takes." },
        lane: { type: "string", enum: ["ready", "assistant", "code"], description: "How it is built: ready-made tools, with an AI assistant, or by writing code." },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 31 }
      },
      additionalProperties: false
    }
  },
  {
    name: "ideas_search",
    title: "Search ideas",
    description: "Plain-text search across titles, briefs, needs, steps and free pieces. Use this when the person describes a local problem.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words from the problem, e.g. 'water cut building' or 'school letter'." },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 8 }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "ideas_get",
    title: "Get one idea",
    description: "Return the full brief for one idea: who it helps, the catch, first moves, what you need, free pieces and a page link.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "The idea id, e.g. garden-calendar." } },
      required: ["id"],
      additionalProperties: false
    }
  },
  {
    name: "ideas_stats",
    title: "Catalog stats",
    description: "Counts by area, time and build lane, plus the catalog date.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "ideas_suggest",
    title: "Suggest a new idea",
    description: "Turn a described problem into a prefilled GitHub issue URL. Does not write to the catalog.",
    inputSchema: {
      type: "object",
      properties: {
        problem: { type: "string", description: "The problem in the person's own words." },
        area: { type: "string", description: "Optional area id to mention in the issue." }
      },
      required: ["problem"],
      additionalProperties: false
    }
  },
  {
    name: "ideas_validate",
    title: "Validate the catalog",
    description: "Check ideas.json for missing fields, unknown areas, duplicate ids and bad kit links.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "ideas_add",
    title: "Add an idea",
    description: "Add an idea to ideas.json. Disabled in read-only mode. The page shows it on the next reload when served by the local server.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        tagline: { type: "string", description: "One line of promise." },
        describe: { type: "string", description: "Two or three plain-English sentences." },
        area: { type: "string" },
        goals: { type: "array", items: { type: "string", enum: ["ease", "earn", "help", "learn"] } },
        minutes: { type: "string", enum: ["weekend", "evenings", "month"] },
        lanes: { type: "array", items: { type: "string", enum: ["ready", "assistant", "code"] } },
        needs: { type: "array", items: { type: "string" } },
        steps: { type: "array", items: { type: "string" }, minItems: 3 },
        helps: { type: "string", description: "Who this is actually for." },
        watch: { type: "string", description: "The honest catch." },
        kit: {
          type: "object",
          description: "Free pieces: each value is [name, http(s) url, note].",
          additionalProperties: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 }
        }
      },
      required: ["title", "tagline", "describe", "area", "minutes", "lanes", "steps", "helps", "watch"],
      additionalProperties: false
    }
  },
  {
    name: "ideas_update",
    title: "Update an idea",
    description: "Change fields on an existing idea by id. Disabled in read-only mode.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        tagline: { type: "string" },
        describe: { type: "string" },
        area: { type: "string" },
        goals: { type: "array", items: { type: "string" } },
        minutes: { type: "string", enum: ["weekend", "evenings", "month"] },
        lanes: { type: "array", items: { type: "string" } },
        needs: { type: "array", items: { type: "string" } },
        steps: { type: "array", items: { type: "string" } },
        helps: { type: "string" },
        watch: { type: "string" },
        kit: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } }
      },
      required: ["id"],
      additionalProperties: false
    }
  }
];

export const RESOURCES = [
  {
    uri: "ideas://catalog",
    name: "Ideas catalog",
    description: "The whole ideas.json document: areas, times, lanes, 31 idea briefs, and the remix word lists.",
    mimeType: "application/json"
  },
  {
    uri: "ideas://areas",
    name: "Areas of life",
    description: "The eight areas, their ids and colours.",
    mimeType: "application/json"
  },
  {
    uri: "ideas://stats",
    name: "Catalog stats",
    description: "Counts by area, time and build lane.",
    mimeType: "application/json"
  }
];

export const RESOURCE_TEMPLATES = [
  {
    uriTemplate: "ideas://idea/{id}",
    name: "One idea",
    description: "A single idea brief by id, e.g. ideas://idea/garden-calendar.",
    mimeType: "application/json"
  }
];

export const PROMPTS = [
  {
    name: "plan-a-local-app",
    title: "Plan a local app",
    description: "Turn one catalog idea into a plain-language, one-weekend plan with a first step tonight.",
    arguments: [
      { name: "idea_id", description: "The idea id to use, e.g. garden-calendar.", required: true },
      { name: "audience", description: "Who will use it, in one sentence.", required: false }
    ]
  }
];

function statsOf(data) {
  const count = (list, key) => list.reduce((acc, item) => {
    const value = item[key];
    if (Array.isArray(value)) value.forEach((v) => { acc[v] = (acc[v] || 0) + 1; });
    else acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  return {
    total: data.ideas.length,
    updated: data.updated,
    byArea: count(data.ideas, "area"),
    byTime: count(data.ideas, "minutes"),
    byLane: count(data.ideas, "lanes")
  };
}

export function createRpcHandler({ readOnly = false, file = DATA_FILE } = {}) {
  const load = () => readCatalog(file);

  async function callTool(name, args = {}) {
    const data = load();
    switch (name) {
      case "ideas_list": {
        let list = data.ideas;
        if (args.area) list = list.filter((i) => i.area === args.area);
        if (args.time) list = list.filter((i) => i.minutes === args.time);
        if (args.lane) list = list.filter((i) => i.lanes.includes(args.lane));
        const limit = Math.max(1, Math.min(50, Number(args.limit) || 31));
        list = list.slice(0, limit);
        const compact = list.map((i) => ({
          id: i.id, title: i.title, tagline: i.tagline,
          area: i.area, minutes: i.minutes, lanes: i.lanes,
          url: `${SITE}/?idea=${encodeURIComponent(i.id)}`
        }));
        const text = list.length
          ? list.map((i) => `- ${i.title} (${i.id}) — ${i.tagline}`).join("\n")
          : "No ideas match those filters.";
        return { text, data: { count: compact.length, total: data.ideas.length, ideas: compact } };
      }
      case "ideas_search": {
        const query = asString(args.query, "query");
        const rows = searchIdeas(data, query, args.limit || 8);
        const text = rows.length
          ? rows.map((r) => `- ${r.idea.title} (${r.idea.id}) — ${r.idea.tagline}\n  ${r.where}`).join("\n")
          : `Nothing in the catalog matched “${query}”. Try fewer words, or use ideas_suggest to propose it.`;
        return {
          text,
          data: {
            query,
            count: rows.length,
            matches: rows.map((r) => ({
              id: r.idea.id, title: r.idea.title, tagline: r.idea.tagline,
              why: r.where, url: `${SITE}/?idea=${encodeURIComponent(r.idea.id)}`
            }))
          }
        };
      }
      case "ideas_get": {
        const id = asString(args.id, "id");
        const idea = data.ideas.find((i) => i.id === id);
        if (!idea) throw new RpcError(-32602, `no idea with id ${id}`);
        return { text: ideaText(data, idea), data: publicIdea(data, idea) };
      }
      case "ideas_stats": {
        const stats = statsOf(data);
        return {
          text: `${stats.total} ideas, updated ${stats.updated}.\n` +
            `By area: ${Object.entries(stats.byArea).map(([k, v]) => `${k} ${v}`).join(", ")}.\n` +
            `By time: ${Object.entries(stats.byTime).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
          data: stats
        };
      }
      case "ideas_suggest": {
        const problem = asString(args.problem, "problem");
        const title = `Idea: ${problem.length > 64 ? problem.slice(0, 61).trimEnd() + "…" : problem}`;
        const body = [
          "**The problem**",
          problem,
          "",
          args.area ? `**Area:** ${args.area}` : "",
          "",
          "**What I already know**",
          "<!-- four facts you could tell a neighbour -->",
          "",
          "_Suggested through the Ideas for Here MCP server._"
        ].filter((line) => line !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
        const url = "https://github.com/abdullahalhusini5-code/ideas-for-here/issues/new" +
          `?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=idea`;
        return { text: `Open this link to file the idea:\n${url}`, data: { url, title, body } };
      }
      case "ideas_validate": {
        const errors = validateCatalog(data);
        return {
          text: errors.length ? `${errors.length} problem(s):\n- ${errors.join("\n- ")}` : "The catalog is valid.",
          data: { valid: errors.length === 0, errors }
        };
      }
      case "ideas_add": {
        if (readOnly) throw new RpcError(-32000, "The server is read-only.");
        const idea = buildIdea(data, args);
        data.ideas.push(idea);
        const errors = validateCatalog(data);
        if (errors.length) throw new RpcError(-32602, `That idea would make the catalog invalid: ${errors.join("; ")}`);
        data.updated = today();
        data.updatedLabel = labelFor(data.updated);
        writeCatalog(data, file);
        return {
          text: `Added “${idea.title}” (${idea.id}). Open ${SITE}/?idea=${idea.id} after the page is reloaded.`,
          data: publicIdea(data, idea)
        };
      }
      case "ideas_update": {
        if (readOnly) throw new RpcError(-32000, "The server is read-only.");
        const idea = updateIdea(data, args);
        const errors = validateCatalog(data);
        if (errors.length) throw new RpcError(-32602, `That change would make the catalog invalid: ${errors.join("; ")}`);
        data.updated = today();
        data.updatedLabel = labelFor(data.updated);
        writeCatalog(data, file);
        return {
          text: `Updated “${idea.title}” (${idea.id}).`,
          data: publicIdea(data, idea)
        };
      }
      default:
        throw new RpcError(-32602, `unknown tool ${name}`);
    }
  }

  return async function handle(method, params = {}) {
    switch (method) {
      case "initialize":
        return {
          protocolVersion: typeof params.protocolVersion === "string" ? params.protocolVersion : "2025-06-18",
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false }
          },
          serverInfo: { name: "ideas-for-here", version: VERSION },
          instructions:
            "A catalog of 31 small, local app ideas in plain English. " +
            "Use ideas_search when someone describes a local problem, ideas_get for the full brief, " +
            "and ideas_suggest to turn a new problem into a GitHub issue. " +
            "ideas_add and ideas_update write to the local catalog and are disabled in read-only mode."
        };

      case "ping":
        return {};

      case "tools/list":
        return { tools: TOOLS };

      case "tools/call": {
        const name = asString(params.name, "name");
        const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
        try {
          const { text, data } = await callTool(name, args);
          const result = { content: [{ type: "text", text }], isError: false };
          if (data !== undefined) result.structuredContent = data;
          return result;
        } catch (err) {
          if (err instanceof RpcError) {
            return { content: [{ type: "text", text: err.message }], isError: true };
          }
          throw err;
        }
      }

      case "resources/list":
        return { resources: RESOURCES };

      case "resources/templates/list":
        return { resourceTemplates: RESOURCE_TEMPLATES };

      case "resources/read": {
        const uri = asString(params.uri, "uri");
        const data = load();
        if (uri === "ideas://catalog") {
          return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
        }
        if (uri === "ideas://areas") {
          return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data.areas, null, 2) }] };
        }
        if (uri === "ideas://stats") {
          return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(statsOf(data), null, 2) }] };
        }
        const match = /^ideas:\/\/idea\/([a-z0-9-]+)$/.exec(uri);
        if (match) {
          const idea = data.ideas.find((i) => i.id === match[1]);
          if (!idea) throw new RpcError(-32602, `no idea with id ${match[1]}`);
          return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(publicIdea(data, idea), null, 2) }] };
        }
        throw new RpcError(-32602, `unknown resource ${uri}`);
      }

      case "prompts/list":
        return { prompts: PROMPTS };

      case "prompts/get": {
        const name = asString(params.name, "name");
        if (name !== "plan-a-local-app") throw new RpcError(-32602, `unknown prompt ${name}`);
        const ideaId = asString((params.arguments || {}).idea_id, "idea_id");
        const data = load();
        const idea = data.ideas.find((i) => i.id === ideaId);
        if (!idea) throw new RpcError(-32602, `no idea with id ${ideaId}`);
        const audience = (params.arguments || {}).audience;
        const text = [
          `Help me plan “${idea.title}” for ${audience || "an ordinary neighbour, not a developer"}.`,
          "",
          ideaText(data, idea),
          "",
          "Write: (1) the one-sentence problem this solves, (2) a four-step first version I could finish in one weekend,",
          "(3) what I need and what each free piece is for, (4) the honest catch from “what to watch for,”",
          "(5) one thing to do in the next twenty minutes. Use plain English, no developer jargon."
        ].join("\n");
        return {
          description: `A one-weekend plan for ${idea.title}.`,
          messages: [{ role: "user", content: { type: "text", text } }]
        };
      }

      default:
        throw new RpcError(-32601, `method not found: ${method}`);
    }
  };
}
