#!/usr/bin/env node
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import readline from "node:readline";

const DEFAULT_PORT = 27491;
const MODEL = "gpt-5.5";
const EFFORT = "medium";
const CONFIG_PATH = join(homedir(), ".graft-ai-helper.json");
const STYLE_PROPERTIES = [
  "backgroundColor",
  "border",
  "borderColor",
  "borderRadius",
  "boxShadow",
  "color",
  "display",
  "fontSize",
  "fontWeight",
  "gap",
  "lineHeight",
  "margin",
  "marginBottom",
  "marginTop",
  "maxWidth",
  "opacity",
  "padding",
  "paddingBottom",
  "paddingTop",
  "transform",
];

export const recipeOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "version", "domain", "prompt", "summary", "createdAt", "sourceUrl", "enabled", "actions"],
  properties: {
    id: { type: "string" },
    version: { type: "integer", enum: [1] },
    domain: { type: "string" },
    prompt: { type: "string" },
    summary: { type: "string" },
    createdAt: { type: "string" },
    sourceUrl: { type: "string" },
    enabled: { type: "boolean" },
    actions: {
      type: "array",
      minItems: 1,
      maxItems: 40,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "type",
          "target",
          "reason",
          "theme",
          "newText",
          "styles",
          "anchor",
          "position",
          "combo",
          "behavior",
        ],
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: ["theme", "hide", "textRewrite", "style", "move", "shortcut"],
          },
          target: signatureSchema(),
          reason: { type: "string" },
          theme: { ...themeSchema(), type: ["object", "null"] },
          newText: { type: ["string", "null"] },
          styles: { ...styleSchema(), type: ["object", "null"] },
          anchor: { ...signatureSchema(), type: ["object", "null"] },
          position: { type: ["string", "null"], enum: ["before", "after", "start", "end", null] },
          combo: { type: ["string", "null"] },
          behavior: { type: ["string", "null"], enum: ["click", "focus", "toggleHidden", "hide", null] },
        },
      },
    },
  },
};

function signatureSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["selectorPath", "primarySelector", "tagName", "id", "classes", "sourceUrl"],
    properties: {
      selectorPath: { type: "string" },
      primarySelector: { type: "string" },
      tagName: { type: "string" },
      id: { type: "string" },
      classes: { type: "array", items: { type: "string" } },
      sourceUrl: { type: "string" },
    },
  };
}

function baseActionProperties(type) {
  return {
    id: { type: "string" },
    type: { type: "string", enum: [type] },
    target: signatureSchema(),
    reason: { type: "string" },
  };
}

function actionSchema(type) {
  return {
    type: "object",
    additionalProperties: true,
    required: ["type", "target", "reason"],
    properties: baseActionProperties(type),
  };
}

function formatCodexError(error) {
  const message =
    typeof error?.message === "string"
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (!message) {
    return "Codex app-server failed";
  }
  try {
    const parsed = JSON.parse(message);
    return parsed?.error?.message || parsed?.message || message;
  } catch {
    return message;
  }
}

function themeSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["preset", "mode", "palette", "density", "radius", "contrast"],
    properties: {
      preset: {
        type: "string",
        enum: ["modern", "calm", "minimal", "editorial", "focus"],
      },
      mode: {
        type: "string",
        enum: ["preserve", "light", "dark"],
      },
      palette: {
        type: "string",
        enum: ["slate", "blue", "green", "violet", "rose", "amber"],
      },
      density: {
        type: "string",
        enum: ["compact", "comfortable", "spacious"],
      },
      radius: {
        type: "string",
        enum: ["subtle", "soft", "round"],
      },
      contrast: {
        type: "string",
        enum: ["normal", "high"],
      },
    },
  };
}

function styleSchema() {
  const properties = {};
  for (const key of STYLE_PROPERTIES) {
    properties[key] = { type: ["string", "null"] };
  }
  return {
    type: "object",
    additionalProperties: false,
    required: STYLE_PROPERTIES,
    properties,
  };
}

export function buildCodexPrompt({ prompt, context }) {
  return [
    "You are Graft AI Rewriter. Return only a JSON object matching the provided output schema.",
    "Create safe browser-extension recipe actions for the current page and domain.",
    "For full-page restyle requests, the first action must be a theme action targeting the html element.",
    "Use this exact html target for theme actions: {\"selectorPath\":\"html\",\"primarySelector\":\"html\",\"tagName\":\"html\",\"id\":\"\",\"classes\":[],\"sourceUrl\":context.page.url}.",
    "For broad visual prompts like modern, cleaner, calmer, prettier, restyle, or full redesign, return exactly one theme action unless the user explicitly asks to hide, rewrite, move, or add shortcuts.",
    "Do not add individual style actions to html, body, main, header, nav, aside, sidebar, or large layout containers for broad restyle prompts.",
    "Use individual style actions only for a few specific fixes requested by the user.",
    "If context.updateMode is true, treat context.existingRecipes as the current saved version and return one replacement recipe that incorporates the requested change.",
    "Do not generate JavaScript. Do not invent selectors. Use only selectors/signatures from context.elements or context.selectedElement.",
    "Every action must include all schema fields. Set fields that do not apply to null.",
    "For style actions, set unused style properties to null.",
    "Set theme.mode to preserve unless the user explicitly asks for light or dark mode.",
    "Never make text and background low contrast. Preserve readability over aesthetics.",
    "Prefer small, reversible changes. Keep reasons short and user-facing.",
    "",
    `User prompt: ${prompt}`,
    "",
    "Page context JSON:",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

function readOrCreateToken() {
  if (process.env.GRAFT_AI_HELPER_TOKEN) {
    return process.env.GRAFT_AI_HELPER_TOKEN.trim();
  }
  try {
    if (existsSync(CONFIG_PATH)) {
      const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
      if (typeof parsed.token === "string" && parsed.token.length > 16) {
        return parsed.token;
      }
    }
  } catch {
    // ignore corrupt config and rotate below
  }
  const token = randomBytes(32).toString("base64url");
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ token }, null, 2) + "\n", "utf8");
  return token;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

function extractJsonObject(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new Error("Codex returned an empty response");
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Codex did not return JSON");
  }
}

function extractCompletedAgentText(params) {
  const item = params?.item;
  if (!item || item.type !== "agentMessage") {
    return "";
  }
  return typeof item.text === "string" ? item.text : "";
}

export function validateRecipe(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Recipe must be an object");
  }
  const actions = Array.isArray(value.actions) ? value.actions : [];
  if (actions.length === 0) {
    throw new Error("Recipe has no actions");
  }
  const domain = String(value.domain || fallback.domain || "").replace(/^www\./, "").toLowerCase();
  if (!domain) {
    throw new Error("Recipe is missing domain");
  }
  return {
    id: String(value.id || `graft-ai-${Date.now()}-${randomBytes(4).toString("hex")}`),
    version: 1,
    domain,
    prompt: String(value.prompt || fallback.prompt || "").slice(0, 2000),
    summary: String(value.summary || "AI rewrite").slice(0, 500),
    actions,
    createdAt: String(value.createdAt || new Date().toISOString()),
    sourceUrl: String(value.sourceUrl || fallback.sourceUrl || "").slice(0, 1000),
    enabled: value.enabled === false ? false : true,
  };
}

export async function runCodexRewrite({ prompt, context, codexBin = "codex" }) {
  const proc = spawn(codexBin, ["app-server"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const rl = readline.createInterface({ input: proc.stdout });
  let nextId = 1;
  let threadId = null;
  let finalText = "";
  let completedAgentText = "";
  let codexNotificationError = "";
  let stderr = "";

  const pending = new Map();
  const send = (method, params, id = nextId++) => {
    proc.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, method });
    });
  };
  const notify = (method, params) => {
    proc.stdin.write(`${JSON.stringify({ method, params })}\n`);
  };

  const completed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("Codex app-server timed out"));
    }, 85_000);

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (!finalText && code !== 0) {
        clearTimeout(timer);
        reject(new Error(stderr.trim() || `codex app-server exited with ${code}`));
      }
    });

    rl.on("line", (line) => {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      if (message.id !== undefined && pending.has(message.id)) {
        const item = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
          item.reject(new Error(message.error.message || `${item.method} failed`));
        } else {
          item.resolve(message.result || {});
        }
        return;
      }
      if (message.method === "item/agentMessage/delta") {
        finalText += message.params?.delta || message.params?.text || "";
      }
      if (message.method === "item/completed") {
        const text = extractCompletedAgentText(message.params);
        if (text) {
          completedAgentText = text;
        }
      }
      if (message.method === "error") {
        codexNotificationError = formatCodexError(message.params?.error);
      }
      if (message.method === "turn/completed") {
        clearTimeout(timer);
        if (!completedAgentText && !finalText && codexNotificationError) {
          reject(new Error(codexNotificationError));
          return;
        }
        resolve(completedAgentText || finalText);
      }
    });
  });

  await send("initialize", {
    clientInfo: {
      name: "graft_ai_helper",
      title: "Graft AI Helper",
      version: "0.1.0",
    },
  }, 0);
  notify("initialized", {});
  const thread = await send("thread/start", {
    ephemeral: true,
    model: MODEL,
    approvalPolicy: "never",
  });
  threadId = thread.thread?.id;
  if (!threadId) {
    throw new Error("Codex did not create a thread");
  }
  await send("turn/start", {
    threadId,
    model: MODEL,
    effort: EFFORT,
    approvalPolicy: "never",
    input: [{ type: "text", text: buildCodexPrompt({ prompt, context }) }],
    outputSchema: recipeOutputSchema,
  });
  const text = await completed;
  proc.kill("SIGTERM");
  return validateRecipe(extractJsonObject(text), {
    domain: context?.domain,
    prompt,
    sourceUrl: context?.page?.url,
  });
}

export function startServer({ port = DEFAULT_PORT, token = readOrCreateToken() } = {}) {
  const server = createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }
    if (req.method !== "POST" || req.url !== "/rewrite") {
      sendJson(res, 404, { ok: false, error: "Not found" });
      return;
    }
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${token}`) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return;
    }
    try {
      const body = await readJsonBody(req);
      const prompt = String(body.prompt || "").trim();
      if (!prompt) {
        sendJson(res, 400, { ok: false, error: "Missing prompt" });
        return;
      }
      const recipe = await runCodexRewrite({ prompt, context: body.context || {} });
      sendJson(res, 200, { ok: true, recipe });
    } catch (error) {
      console.error(
        "[graft-ai-helper] rewrite failed:",
        error instanceof Error ? error.stack || error.message : error
      );
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Rewrite failed",
      });
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`graft-ai-helper listening on http://127.0.0.1:${port}`);
    console.log(`token: ${token}`);
    console.log("Paste this token into Graft > AI Rewriter > Local helper.");
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const portArg = process.argv.find((arg) => arg.startsWith("--port="));
  const port = portArg ? Number(portArg.slice("--port=".length)) : DEFAULT_PORT;
  startServer({ port });
}
