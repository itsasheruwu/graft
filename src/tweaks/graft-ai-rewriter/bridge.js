(function () {
  "use strict";

  const SOURCE = "graft-ai-rewriter";
  const MESSAGE_STATE = "GRAFT_AI_REWRITER_STATE";
  const MESSAGE_OPEN = "GRAFT_AI_REWRITER_OPEN";
  const MESSAGE_GENERATE = "GRAFT_AI_REWRITER_GENERATE";
  const MESSAGE_RESULT = "GRAFT_AI_REWRITER_RESULT";
  const MESSAGE_SAVE = "GRAFT_AI_REWRITER_SAVE";
  const MESSAGE_REVERT = "GRAFT_AI_REWRITER_REVERT";
  const MESSAGE_REVERTED = "GRAFT_AI_REWRITER_REVERTED";

  const ENABLED_KEY = "graftAiRewriterEnabled";
  const RECIPES_KEY = "graftAiRecipesByDomain";
  const HELPER_PORT_KEY = "graftAiHelperPort";
  const HELPER_TOKEN_KEY = "graftAiHelperToken";

  const SYNC_DEFAULTS = {
    [ENABLED_KEY]: true,
  };

  const LOCAL_DEFAULTS = {
    [RECIPES_KEY]: {},
    [HELPER_PORT_KEY]: 27491,
    [HELPER_TOKEN_KEY]: "",
  };
  const THEME_PRESETS = new Set(["modern", "calm", "minimal", "editorial", "focus"]);
  const THEME_MODES = new Set(["preserve", "light", "dark"]);
  const THEME_PALETTES = new Set(["slate", "blue", "green", "violet", "rose", "amber"]);
  const THEME_DENSITIES = new Set(["compact", "comfortable", "spacious"]);
  const THEME_RADII = new Set(["subtle", "soft", "round"]);
  const THEME_CONTRASTS = new Set(["normal", "high"]);

  function normalizeDomain(domain) {
    if (!domain) {
      return location.hostname.replace(/^www\./, "").toLowerCase();
    }
    return String(domain).replace(/^www\./, "").toLowerCase();
  }

  function normalizeSignature(signature) {
    if (!signature || typeof signature !== "object") {
      return null;
    }
    const classes = Array.isArray(signature.classes)
      ? signature.classes.filter(Boolean).map(String).slice(0, 16)
      : [];
    const normalized = {
      selectorPath:
        typeof signature.selectorPath === "string" ? signature.selectorPath : "",
      primarySelector:
        typeof signature.primarySelector === "string" ? signature.primarySelector : "",
      tagName:
        typeof signature.tagName === "string"
          ? signature.tagName.toLowerCase()
          : "",
      id: typeof signature.id === "string" ? signature.id : "",
      classes,
      sourceUrl: typeof signature.sourceUrl === "string" ? signature.sourceUrl : "",
    };
    if (!normalized.selectorPath && !normalized.primarySelector && !normalized.tagName) {
      return null;
    }
    return normalized;
  }

  function normalizeTheme(theme) {
    if (!theme || typeof theme !== "object") {
      return null;
    }
    const normalized = {
      preset: typeof theme.preset === "string" ? theme.preset : "",
      mode: typeof theme.mode === "string" ? theme.mode : "",
      palette: typeof theme.palette === "string" ? theme.palette : "",
      density: typeof theme.density === "string" ? theme.density : "",
      radius: typeof theme.radius === "string" ? theme.radius : "",
      contrast: typeof theme.contrast === "string" ? theme.contrast : "",
    };
    if (
      !THEME_PRESETS.has(normalized.preset) ||
      !THEME_MODES.has(normalized.mode) ||
      !THEME_PALETTES.has(normalized.palette) ||
      !THEME_DENSITIES.has(normalized.density) ||
      !THEME_RADII.has(normalized.radius) ||
      !THEME_CONTRASTS.has(normalized.contrast)
    ) {
      return null;
    }
    return normalized;
  }

  function normalizeAction(action) {
    if (!action || typeof action !== "object") {
      return null;
    }
    const target = normalizeSignature(action.target);
    const reason = typeof action.reason === "string" ? action.reason.slice(0, 220) : "";
    if (!target || !reason) {
      return null;
    }
    const base = {
      id: typeof action.id === "string" ? action.id.slice(0, 120) : "",
      type: action.type,
      target,
      reason,
    };
    if (action.type === "theme") {
      const theme = normalizeTheme(action.theme);
      return theme ? { ...base, theme } : null;
    }
    if (action.type === "hide") {
      return base;
    }
    if (action.type === "textRewrite" && typeof action.newText === "string") {
      return { ...base, newText: action.newText.slice(0, 5000) };
    }
    if (action.type === "style" && action.styles && typeof action.styles === "object") {
      return { ...base, styles: action.styles };
    }
    if (action.type === "move") {
      const anchor = normalizeSignature(action.anchor);
      const position = typeof action.position === "string" ? action.position : "";
      if (!anchor || !["before", "after", "start", "end"].includes(position)) {
        return null;
      }
      return { ...base, anchor, position };
    }
    if (action.type === "shortcut") {
      const combo = typeof action.combo === "string" ? action.combo.slice(0, 80) : "";
      const behavior =
        typeof action.behavior === "string" ? action.behavior.slice(0, 80) : "";
      if (!combo || !["click", "focus", "toggleHidden", "hide"].includes(behavior)) {
        return null;
      }
      return { ...base, combo, behavior };
    }
    return null;
  }

  function normalizeRecipe(recipe, domainFallback) {
    if (!recipe || typeof recipe !== "object") {
      return null;
    }
    const actions = Array.isArray(recipe.actions)
      ? recipe.actions.map(normalizeAction).filter(Boolean).slice(0, 40)
      : [];
    if (actions.length === 0) {
      return null;
    }
    const domain = normalizeDomain(recipe.domain || domainFallback || "");
    if (!domain) {
      return null;
    }
    return {
      id:
        typeof recipe.id === "string" && recipe.id
          ? recipe.id.slice(0, 120)
          : `graft-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      version: 1,
      domain,
      prompt: typeof recipe.prompt === "string" ? recipe.prompt.slice(0, 2000) : "",
      summary:
        typeof recipe.summary === "string" && recipe.summary.trim()
          ? recipe.summary.slice(0, 500)
          : "AI rewrite",
      actions,
      createdAt:
        typeof recipe.createdAt === "string" && recipe.createdAt
          ? recipe.createdAt.slice(0, 80)
          : new Date().toISOString(),
      sourceUrl: typeof recipe.sourceUrl === "string" ? recipe.sourceUrl.slice(0, 1000) : "",
      enabled: recipe.enabled === false ? false : true,
    };
  }

  function normalizeRecipeMap(raw) {
    const output = {};
    if (!raw || typeof raw !== "object") {
      return output;
    }
    for (const key of Object.keys(raw)) {
      const domain = normalizeDomain(key);
      const list = raw[key];
      if (!Array.isArray(list)) {
        continue;
      }
      const recipes = list
        .map((entry) => normalizeRecipe(entry, domain))
        .filter(Boolean);
      if (recipes.length > 0) {
        output[domain] = recipes;
      }
    }
    return output;
  }

  function sendState() {
    chrome.storage.sync.get(SYNC_DEFAULTS, (syncStored) => {
      chrome.storage.local.get(LOCAL_DEFAULTS, (localStored) => {
        const domain = normalizeDomain();
        const recipes = normalizeRecipeMap(localStored[RECIPES_KEY])[domain] || [];
        window.postMessage(
          {
            source: SOURCE,
            type: MESSAGE_STATE,
            enabled: Boolean(syncStored[ENABLED_KEY]),
            domain,
            recipes,
          },
          "*"
        );
      });
    });
  }

  function saveRecipe(recipe, options = {}) {
    const normalized = normalizeRecipe(recipe, normalizeDomain());
    if (!normalized) {
      return;
    }
    chrome.storage.local.get(LOCAL_DEFAULTS, (stored) => {
      const map = normalizeRecipeMap(stored[RECIPES_KEY]);
      const domain = normalizeDomain(normalized.domain);
      const existing = options.replaceDomain ? [] : map[domain] || [];
      chrome.storage.local.set(
        {
          [RECIPES_KEY]: {
            ...map,
            [domain]: [
              ...existing.filter((item) => item.id !== normalized.id),
              normalized,
            ],
          },
        },
        sendState
      );
    });
  }

  function revertDomainRecipes(requestId) {
    chrome.storage.local.get(LOCAL_DEFAULTS, (stored) => {
      const map = normalizeRecipeMap(stored[RECIPES_KEY]);
      const domain = normalizeDomain();
      const nextMap = { ...map };
      delete nextMap[domain];
      chrome.storage.local.set({ [RECIPES_KEY]: nextMap }, () => {
        sendState();
        window.postMessage(
          {
            source: SOURCE,
            type: MESSAGE_REVERTED,
            requestId,
          },
          "*"
        );
      });
    });
  }

  function handleGenerate(message) {
    const requestId =
      typeof message.requestId === "string" ? message.requestId : String(Date.now());
    const prompt = typeof message.prompt === "string" ? message.prompt.trim() : "";
    if (!prompt) {
      window.postMessage(
        {
          source: SOURCE,
          type: MESSAGE_RESULT,
          requestId,
          response: { ok: false, error: "Missing rewrite prompt." },
        },
        "*"
      );
      return;
    }

    chrome.storage.local.get(
      {
        [HELPER_PORT_KEY]: 27491,
        [HELPER_TOKEN_KEY]: "",
      },
      async (settings) => {
        const port = normalizeHelperPort(settings[HELPER_PORT_KEY]);
        const token = String(settings[HELPER_TOKEN_KEY] || "").trim();
        if (!token) {
          window.postMessage(
            {
              source: SOURCE,
              type: MESSAGE_RESULT,
              requestId,
              response: {
                ok: false,
                error: "Start graft-ai-helper and save its token in AI Rewriter settings.",
              },
            },
            "*"
          );
          return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 120_000);
        let responsePayload;
        try {
          const response = await fetch(`http://127.0.0.1:${port}/rewrite`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              prompt,
              context: message.context || {},
            }),
            signal: controller.signal,
          });
          if (!response.ok) {
            const errorBody = await response
              .json()
              .catch(() => ({ ok: false, error: "" }));
            responsePayload = {
              ok: false,
              error:
                response.status === 401 || response.status === 403
                  ? "Helper token was rejected."
                  : errorBody?.error || `Helper request failed: ${response.status}`,
            };
          } else {
            responsePayload = await response.json();
          }
        } catch (error) {
          responsePayload = {
            ok: false,
            error:
              error?.name === "AbortError"
                ? "AI rewrite timed out."
                : "Could not reach graft-ai-helper on localhost.",
          };
        } finally {
          window.clearTimeout(timer);
        }

        window.postMessage(
          {
            source: SOURCE,
            type: MESSAGE_RESULT,
            requestId,
            response: responsePayload,
          },
          "*"
        );
      }
    );
  }

  function normalizeHelperPort(value) {
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      return 27491;
    }
    return port;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }
    const data = event.data;
    if (!data || data.source !== SOURCE) {
      return;
    }
    if (data.type === MESSAGE_GENERATE) {
      handleGenerate(data);
    }
    if (data.type === MESSAGE_SAVE) {
      saveRecipe(data.recipe, { replaceDomain: Boolean(data.replaceDomain) });
    }
    if (data.type === MESSAGE_REVERT) {
      revertDomainRecipes(typeof data.requestId === "string" ? data.requestId : "");
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "graft-ai-rewriter:open") {
      window.postMessage(
        {
          source: SOURCE,
          type: MESSAGE_OPEN,
          prompt: typeof message.prompt === "string" ? message.prompt : "",
        },
        "*"
      );
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (
      (area === "sync" && ENABLED_KEY in changes) ||
      (area === "local" && RECIPES_KEY in changes)
    ) {
      sendState();
    }
  });

  sendState();
})();
