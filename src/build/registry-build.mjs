import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(__dirname, "../tweaks/registry.js");

/** @typedef {"MAIN" | "ISOLATED"} ScriptWorld */
/** @typedef {"document_start" | "document_idle" | "document_end"} RunAt */

/**
 * @typedef {object} RegistryEntrypoint
 * @property {string} path
 * @property {ScriptWorld} world
 * @property {RunAt} runAt
 */

/**
 * @typedef {object} RegistryTweak
 * @property {string} id
 * @property {string[]} hostTargets
 * @property {RegistryEntrypoint[]} entrypoints
 * @property {string[]} [matchPatterns]
 */

/**
 * Loads TWEAK_REGISTRY from registry.js (eval in module scope).
 */
export function loadRegistry() {
  const source = readFileSync(registryPath, "utf8");
  const fn = new Function(`${source}; return TWEAK_REGISTRY;`);
  return /** @type {{ tweaks: RegistryTweak[], defaultExcludeMatches: string[], globalMatchPatterns: string[] }} */ (
    fn()
  );
}

export const DEFAULT_EXCLUDE_MATCHES = [
  "*://chrome.google.com/*",
  "*://chromewebstore.google.com/*",
  "*://microsoftedge.microsoft.com/*",
  "*://addons.mozilla.org/*",
  "*://newtab/*",
];

export const GLOBAL_MATCH_PATTERNS = ["http://*/*", "https://*/*"];

export const YOUTUBE_MATCH_PATTERNS = [
  "https://youtube.com/*",
  "https://www.youtube.com/*",
  "https://m.youtube.com/*",
  "https://music.youtube.com/*",
  "https://*.youtube.com/*",
];

/**
 * @param {string} target
 */
export function hostTargetToMatchPatterns(target) {
  if (target === "*") {
    return [...GLOBAL_MATCH_PATTERNS];
  }

  const host = target.replace(/^\*\./, "");
  if (target.startsWith("*.")) {
    return [`https://*.${host}/*`, `http://*.${host}/*`];
  }

  return [`https://${host}/*`, `http://${host}/*`];
}

/**
 * @param {RegistryTweak} tweak
 */
export function tweakMatchPatterns(tweak) {
  if (Array.isArray(tweak.matchPatterns) && tweak.matchPatterns.length > 0) {
    return tweak.matchPatterns;
  }

  const patterns = new Set();
  for (const target of tweak.hostTargets || []) {
    for (const pattern of hostTargetToMatchPatterns(target)) {
      patterns.add(pattern);
    }
  }
  return [...patterns];
}

/**
 * @param {import("../tweaks/registry.js").TWEAK_REGISTRY} registry
 */
export function buildContentScripts(registry) {
  const exclude =
    registry.defaultExcludeMatches?.length > 0
      ? registry.defaultExcludeMatches
      : DEFAULT_EXCLUDE_MATCHES;

  /** @type {Array<Record<string, unknown>>} */
  const scripts = [];

  for (const tweak of registry.tweaks) {
    const matches = tweakMatchPatterns(tweak);
    for (const entry of tweak.entrypoints) {
      const block = {
        matches,
        exclude_matches: exclude,
        js: [entry.path],
        run_at: entry.runAt || "document_start",
      };
      if (entry.world === "MAIN") {
        block.world = "MAIN";
      }
      scripts.push(block);
    }
  }

  return scripts;
}

/**
 * @param {import("../tweaks/registry.js").TWEAK_REGISTRY} registry
 */
export function listEntrypointCopyPaths(registry) {
  const paths = new Set([
    "src/background/service_worker.js",
    "src/lib/extension-bail.js",
  ]);

  for (const tweak of registry.tweaks) {
    for (const entry of tweak.entrypoints) {
      paths.add(entry.path);
    }
  }

  return [...paths];
}
