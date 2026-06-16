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

  const ROOT_ID = "graft-ai-rewriter-root";
  const STYLE_ID = "graft-ai-rewriter-styles";
  const THEME_STYLE_PREFIX = "graft-ai-theme-style-";
  const MAX_CONTEXT_ELEMENTS = 140;
  const MAX_TEXT_LENGTH = 260;
  const Z_INDEX = 2147483646;

  const ALLOWED_STYLE_PROPERTIES = new Set([
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
  ]);
  const THEME_PRESETS = new Set(["modern", "calm", "minimal", "editorial", "focus"]);
  const THEME_MODES = new Set(["preserve", "light", "dark"]);
  const THEME_PALETTES = new Set(["slate", "blue", "green", "violet", "rose", "amber"]);
  const THEME_DENSITIES = new Set(["compact", "comfortable", "spacious"]);
  const THEME_RADII = new Set(["subtle", "soft", "round"]);
  const THEME_CONTRASTS = new Set(["normal", "high"]);

  const state = {
    enabled: true,
    domain: "",
    recipes: [],
    pendingRequestId: "",
    pendingRecipe: null,
    updateMode: false,
    pendingRevertId: "",
    pendingRevertNeedsReload: false,
  };

  let root = null;
  let dialog = null;
  let promptInput = null;
  let preview = null;
  let statusNode = null;
  let generateButton = null;
  let applyButton = null;
  let menu = null;
  let menuSummary = null;
  let updateButton = null;
  let revertButton = null;
  let shortcutCleanups = new Map();
  let observer = null;
  let observerTimer = null;
  let isApplyingRecipes = false;

  function normalizeDomain(domain) {
    if (!domain) {
      return location.hostname.replace(/^www\./, "").toLowerCase();
    }
    return String(domain).replace(/^www\./, "").toLowerCase();
  }

  function cssEscape(value) {
    return window.CSS?.escape
      ? window.CSS.escape(value)
      : String(value).replace(/[\\"'`;\n\r\f\t]/g, (char) => `\\${char}`);
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

  function normalizeStyleMap(styles) {
    if (!styles || typeof styles !== "object") {
      return null;
    }
    const output = {};
    for (const [property, rawValue] of Object.entries(styles)) {
      if (!ALLOWED_STYLE_PROPERTIES.has(property)) {
        continue;
      }
      const value = String(rawValue || "").trim().slice(0, 180);
      if (!value || /url\s*\(|expression\s*\(|javascript:/i.test(value)) {
        continue;
      }
      output[property] = value;
    }
    return Object.keys(output).length > 0 ? output : null;
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
    const reason = typeof action.reason === "string" ? action.reason.trim().slice(0, 220) : "";
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
    if (action.type === "textRewrite") {
      const newText = typeof action.newText === "string" ? action.newText.slice(0, 5000) : "";
      return newText ? { ...base, newText } : null;
    }
    if (action.type === "style") {
      const styles = normalizeStyleMap(action.styles);
      return styles ? { ...base, styles } : null;
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

  function normalizeRecipe(recipe) {
    if (!recipe || typeof recipe !== "object") {
      return null;
    }
    const actions = Array.isArray(recipe.actions)
      ? recipe.actions.map(normalizeAction).filter(Boolean).slice(0, 40)
      : [];
    if (actions.length === 0) {
      return null;
    }
    return {
      id:
        typeof recipe.id === "string" && recipe.id
          ? recipe.id.slice(0, 120)
          : `graft-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      version: 1,
      domain: normalizeDomain(recipe.domain || state.domain),
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
      sourceUrl: typeof recipe.sourceUrl === "string" ? recipe.sourceUrl.slice(0, 1000) : location.href,
      enabled: recipe.enabled === false ? false : true,
    };
  }

  function selectorForNode(node, allowNthSibling = true) {
    const tagName = node.tagName.toLowerCase();
    if (node.id) {
      return `${tagName}#${cssEscape(node.id)}`;
    }
    const classList = Array.from(node.classList || []).map(cssEscape);
    if (classList.length > 0) {
      return `${tagName}.${classList.slice(0, 2).join(".")}`;
    }
    const parent = node.parentElement;
    if (!parent || !allowNthSibling) {
      return tagName;
    }
    const siblings = Array.from(parent.children).filter(
      (sibling) => sibling.tagName === node.tagName
    );
    if (siblings.length <= 1) {
      return tagName;
    }
    return `${tagName}:nth-of-type(${siblings.indexOf(node) + 1})`;
  }

  function selectorPath(node) {
    const path = [];
    let current = node;
    let guard = 0;
    while (
      current &&
      current.nodeType === 1 &&
      current !== document.documentElement &&
      guard < 10
    ) {
      path.unshift(selectorForNode(current, current !== node));
      if (current.id) {
        break;
      }
      current = current.parentElement;
      guard += 1;
    }
    return path.join(" > ");
  }

  function buildSignature(node) {
    return {
      tagName: node.tagName.toLowerCase(),
      id: node.id || "",
      classes: Array.from(node.classList || []).filter(Boolean).slice(0, 16),
      selectorPath: selectorPath(node),
      primarySelector: selectorForNode(node, true),
      sourceUrl: location.href,
    };
  }

  function isToolElement(node) {
    return Boolean(root && node && root.contains(node));
  }

  function isVisibleElement(element) {
    if (!element || !(element instanceof Element) || isToolElement(element)) {
      return false;
    }
    const tag = element.tagName.toLowerCase();
    if (["html", "body", "head", "script", "style", "noscript"].includes(tag)) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) {
      return false;
    }
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || 1) > 0;
  }

  function collectCandidates(signature) {
    const candidates = [];
    const push = (candidate) => {
      const value = String(candidate || "").trim();
      if (!value || value === "*" || /^[a-z][a-z0-9]*$/i.test(value)) {
        return;
      }
      if (!candidates.includes(value)) {
        candidates.push(value);
      }
    };
    push(signature.selectorPath);
    push(signature.primarySelector);
    if (signature.tagName && signature.id) {
      push(`${signature.tagName}#${cssEscape(signature.id)}`);
    }
    if (signature.tagName && signature.classes?.length) {
      push(`${signature.tagName}${signature.classes.slice(0, 2).map((c) => `.${cssEscape(c)}`).join("")}`);
    }
    return candidates;
  }

  function findElement(signature) {
    const normalized = normalizeSignature(signature);
    if (!normalized) {
      return null;
    }
    for (const candidate of collectCandidates(normalized)) {
      try {
        const element = document.querySelector(candidate);
        if (element && isVisibleElement(element)) {
          return element;
        }
      } catch {
        // ignore malformed selector from stored state
      }
    }
    return null;
  }

  function setElementText(element, text) {
    const tag = element.tagName.toLowerCase();
    if (tag === "textarea" || tag === "input") {
      element.value = text;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    element.textContent = text;
  }

  function comboMatches(combo, event) {
    const parts = String(combo || "").toLowerCase().split("+").map((p) => p.trim()).filter(Boolean);
    const key = parts[parts.length - 1];
    return (
      Boolean(event.metaKey) === (parts.includes("cmd") || parts.includes("meta")) &&
      Boolean(event.ctrlKey) === (parts.includes("ctrl") || parts.includes("control")) &&
      Boolean(event.altKey) === (parts.includes("alt") || parts.includes("option")) &&
      Boolean(event.shiftKey) === parts.includes("shift") &&
      String(event.key || "").toLowerCase() === key
    );
  }

  function parseRgb(color) {
    const match = String(color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) {
      return null;
    }
    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
    };
  }

  function luminance({ r, g, b }) {
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  function pageLooksDark() {
    const bodyColor = getComputedStyle(document.body).backgroundColor;
    const htmlColor = getComputedStyle(document.documentElement).backgroundColor;
    const parsed = parseRgb(bodyColor) || parseRgb(htmlColor);
    return parsed ? luminance(parsed) < 0.32 : window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function themeTokens(theme) {
    const mode = theme.mode === "preserve" ? (pageLooksDark() ? "dark" : "light") : theme.mode;
    const accents = {
      slate: { light: "#334155", dark: "#cbd5e1" },
      blue: { light: "#2563eb", dark: "#60a5fa" },
      green: { light: "#059669", dark: "#34d399" },
      violet: { light: "#7c3aed", dark: "#a78bfa" },
      rose: { light: "#e11d48", dark: "#fb7185" },
      amber: { light: "#b45309", dark: "#fbbf24" },
    };
    const dark = mode === "dark";
    const high = theme.contrast === "high";
    const radius = theme.radius === "round" ? "18px" : theme.radius === "soft" ? "12px" : "8px";
    const density = {
      compact: { pad: "8px", gap: "8px", input: "38px" },
      comfortable: { pad: "12px", gap: "12px", input: "44px" },
      spacious: { pad: "16px", gap: "16px", input: "50px" },
    }[theme.density];
    const accent = accents[theme.palette]?.[mode] || accents.slate[mode];
    const base =
      theme.preset === "minimal"
        ? { bg: dark ? "#0b0d10" : "#f8fafc", surface: dark ? "#12161c" : "#ffffff" }
        : theme.preset === "editorial"
          ? { bg: dark ? "#11100d" : "#fbfaf7", surface: dark ? "#1a1813" : "#ffffff" }
          : theme.preset === "focus"
            ? { bg: dark ? "#070b12" : "#f5f7fb", surface: dark ? "#101827" : "#ffffff" }
            : theme.preset === "calm"
              ? { bg: dark ? "#08120f" : "#f6fbf8", surface: dark ? "#10201b" : "#ffffff" }
              : { bg: dark ? "#070a12" : "#f7f9fc", surface: dark ? "#111827" : "#ffffff" };
    return {
      mode,
      bg: base.bg,
      surface: base.surface,
      surfaceSoft: dark ? "rgba(255,255,255,0.075)" : "rgba(15,23,42,0.045)",
      surfaceStrong: dark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.075)",
      text: dark ? (high ? "#ffffff" : "#f8fafc") : high ? "#020617" : "#0f172a",
      muted: dark ? (high ? "#dbeafe" : "#cbd5e1") : high ? "#1e293b" : "#475569",
      border: dark ? "rgba(226,232,240,0.22)" : "rgba(15,23,42,0.14)",
      accent,
      radius,
      pad: density.pad,
      gap: density.gap,
      input: density.input,
      shadow: dark ? "0 18px 60px rgba(0,0,0,0.28)" : "0 18px 60px rgba(15,23,42,0.10)",
    };
  }

  function themeStyleId(recipeId) {
    return `${THEME_STYLE_PREFIX}${String(recipeId || "preview").replace(/[^a-z0-9_-]/gi, "-")}`;
  }

  function removeThemeStyles() {
    for (const node of document.querySelectorAll(`style[id^="${THEME_STYLE_PREFIX}"]`)) {
      node.remove();
    }
  }

  function buildThemeCss(theme, recipeId) {
    const token = themeTokens(theme);
    return `
      :root {
        color-scheme: ${token.mode};
      }
      html,
      body {
        background: ${token.bg} !important;
        color: ${token.text} !important;
      }
      body {
        accent-color: ${token.accent} !important;
      }
      body :where(main, [role="main"]) {
        background: transparent !important;
        color: ${token.text} !important;
      }
      body :where(header, nav, aside, footer, section, article, [role="navigation"], [class*="sidebar" i], [class*="panel" i], [class*="card" i]):not(#${ROOT_ID} *) {
        border-color: ${token.border} !important;
        border-radius: ${token.radius} !important;
      }
      body :where(header, nav, aside, footer, [role="navigation"], [class*="sidebar" i]):not(#${ROOT_ID} *) {
        background: color-mix(in srgb, ${token.surface} 86%, transparent) !important;
        color: ${token.text} !important;
      }
      body :where(section, article, [class*="panel" i], [class*="card" i]):not(#${ROOT_ID} *) {
        background-color: color-mix(in srgb, ${token.surface} 72%, transparent) !important;
      }
      body :where(a):not(#${ROOT_ID} *) {
        color: ${token.accent} !important;
      }
      body :where(button, [role="button"], input, textarea, select):not(#${ROOT_ID} *) {
        min-height: ${token.input};
        border-radius: ${token.radius} !important;
        border-color: ${token.border} !important;
        background-color: ${token.surfaceStrong} !important;
        color: ${token.text} !important;
      }
      body :where(input, textarea, select):not(#${ROOT_ID} *)::placeholder {
        color: ${token.muted} !important;
      }
      body :where(p, li, span, label, small, h1, h2, h3, h4, h5, h6):not(#${ROOT_ID} *) {
        color: inherit;
      }
      body :where([class*="muted" i], [class*="secondary" i], [aria-disabled="true"]):not(#${ROOT_ID} *) {
        color: ${token.muted} !important;
      }
      body :where([class*="feed" i], [role="feed"], [data-testid*="feed" i]):not(#${ROOT_ID} *) {
        gap: ${token.gap} !important;
      }
      body :where(*):not(#${ROOT_ID} *) {
        scrollbar-color: ${token.border} transparent;
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background:
          radial-gradient(circle at 18% 12%, color-mix(in srgb, ${token.accent} 12%, transparent), transparent 28rem),
          linear-gradient(180deg, ${token.bg}, color-mix(in srgb, ${token.bg} 88%, ${token.surface}));
      }
    `;
  }

  function applyThemeAction(action, recipeId) {
    const theme = normalizeTheme(action.theme);
    if (!theme) {
      return false;
    }
    let style = document.getElementById(themeStyleId(recipeId));
    if (!style) {
      style = document.createElement("style");
      style.id = themeStyleId(recipeId);
      document.documentElement.appendChild(style);
    }
    style.textContent = buildThemeCss(theme, recipeId);
    return true;
  }

  function applyAction(action, recipeId) {
    if (action.type === "theme") {
      return applyThemeAction(action, recipeId);
    }
    const element = findElement(action.target);
    if (!element) {
      return false;
    }
    if (action.type === "hide") {
      element.remove();
      return true;
    }
    if (action.type === "textRewrite") {
      setElementText(element, action.newText || "");
      return true;
    }
    if (action.type === "style") {
      const styles = normalizeStyleMap(action.styles);
      if (!styles) {
        return false;
      }
      for (const [property, value] of Object.entries(styles)) {
        element.style[property] = value;
      }
      return true;
    }
    if (action.type === "move") {
      const anchor = findElement(action.anchor);
      if (!anchor || anchor === element || element.contains(anchor)) {
        return false;
      }
      if (action.position === "before") anchor.parentNode?.insertBefore(element, anchor);
      if (action.position === "after") anchor.parentNode?.insertBefore(element, anchor.nextSibling);
      if (action.position === "start") anchor.insertBefore(element, anchor.firstChild);
      if (action.position === "end") anchor.appendChild(element);
      return true;
    }
    if (action.type === "shortcut") {
      const key = `${action.combo}|${action.behavior}|${JSON.stringify(action.target)}`;
      if (shortcutCleanups.has(key)) {
        return true;
      }
      const handler = (event) => {
        if (!comboMatches(action.combo, event)) return;
        const target = findElement(action.target);
        if (!target) return;
        event.preventDefault();
        if (action.behavior === "click") target.click();
        if (action.behavior === "focus" && typeof target.focus === "function") target.focus();
        if (action.behavior === "toggleHidden") target.hidden = !target.hidden;
        if (action.behavior === "hide") target.remove();
      };
      window.addEventListener("keydown", handler, true);
      shortcutCleanups.set(key, () => window.removeEventListener("keydown", handler, true));
      return true;
    }
    return false;
  }

  function clearShortcuts() {
    for (const cleanup of shortcutCleanups.values()) cleanup();
    shortcutCleanups = new Map();
  }

  function applyRecipe(recipe) {
    const normalized = normalizeRecipe(recipe);
    if (!normalized || normalized.enabled === false) {
      return 0;
    }
    let applied = 0;
    for (const action of normalized.actions) {
      if (applyAction(action, normalized.id)) applied += 1;
    }
    return applied;
  }

  function applyRecipes() {
    if (isApplyingRecipes) return;
    isApplyingRecipes = true;
    observer?.disconnect();
    observer = null;
    clearShortcuts();
    removeThemeStyles();
    try {
      if (!state.enabled) return;
      for (const recipe of state.recipes) {
        applyRecipe(recipe);
      }
    } finally {
      isApplyingRecipes = false;
      syncObserver();
    }
  }

  function syncObserver() {
    if (observer || !state.enabled || state.recipes.length === 0) {
      return;
    }
    observer = new MutationObserver(() => {
      if (isApplyingRecipes) return;
      if (observerTimer) clearTimeout(observerTimer);
      observerTimer = window.setTimeout(() => {
        observerTimer = null;
        applyRecipes();
      }, 500);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function visibleRecipes() {
    return state.enabled
      ? state.recipes.filter((recipe) => recipe && recipe.enabled !== false)
      : [];
  }

  function recipeHasDestructiveActions(recipe) {
    return Boolean(
      recipe?.actions?.some((action) =>
        ["hide", "textRewrite", "move"].includes(action.type)
      )
    );
  }

  function updateMenu() {
    if (!menu || !menuSummary) return;
    const active = visibleRecipes();
    if (active.length === 0 || root?.classList.contains("is-open")) {
      menu.classList.remove("is-visible");
      return;
    }
    const latest = active[active.length - 1];
    menuSummary.textContent = latest?.summary || "AI restyle active";
    menu.classList.add("is-visible");
  }

  function roleForElement(element) {
    const tag = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return "heading";
    if (tag === "a") return "link";
    if (tag === "button" || element.getAttribute("role") === "button") return "button";
    if (["input", "textarea", "select"].includes(tag)) return "form-control";
    if (["nav", "main", "aside", "header", "footer", "section", "article"].includes(tag)) return tag;
    return "content";
  }

  function summarizeElement(element) {
    const rect = element.getBoundingClientRect();
    const signature = buildSignature(element);
    return {
      role: roleForElement(element),
      tagName: signature.tagName,
      text: (element.innerText || element.textContent || "").trim().slice(0, MAX_TEXT_LENGTH),
      href: element instanceof HTMLAnchorElement ? element.href.slice(0, 300) : "",
      signature,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  }

  function collectContext() {
    const query = [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "a",
      "button",
      "input",
      "textarea",
      "select",
      "nav",
      "main",
      "aside",
      "header",
      "footer",
      "section",
      "article",
      "[role='button']",
      "[role='navigation']",
      "[role='main']",
      "[role='feed']",
    ].join(",");
    const elements = [];
    const seen = new Set();
    for (const element of Array.from(document.querySelectorAll(query))) {
      if (!isVisibleElement(element)) continue;
      const sig = buildSignature(element);
      const key = JSON.stringify([sig.selectorPath, sig.primarySelector, sig.tagName, sig.id]);
      if (seen.has(key)) continue;
      seen.add(key);
      elements.push(summarizeElement(element));
      if (elements.length >= MAX_CONTEXT_ELEMENTS) break;
    }
    return {
      domain: state.domain || normalizeDomain(),
      page: {
        url: location.href,
        title: document.title,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        detectedTheme: pageLooksDark() ? "dark" : "light",
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        textColor: getComputedStyle(document.body).color,
      },
      existingRecipes: state.recipes,
      updateMode: state.updateMode,
      elements,
    };
  }

  function ensureUi() {
    if (root) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        --graft-ai-navy: #101827;
        --graft-ai-panel: #142033;
        --graft-ai-panel-soft: #1a2638;
        --graft-ai-green: #72d981;
        --graft-ai-green-strong: #48bf65;
        --graft-ai-glow: #b6cce8;
        --graft-ai-border: rgba(182, 204, 232, 0.22);
        --graft-ai-muted: rgba(229, 236, 245, 0.68);
        --graft-ai-subtle: rgba(229, 236, 245, 0.52);
        --graft-ai-text: #f6f8fb;
        position: fixed;
        inset: 0;
        z-index: ${Z_INDEX};
        pointer-events: none;
        font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .graft-ai-backdrop {
        position: absolute;
        inset: 0;
        display: none;
        background: rgba(16, 24, 39, 0.22);
        pointer-events: auto;
      }
      .graft-ai-dialog {
        position: absolute;
        left: 50%;
        top: 6vh;
        width: min(620px, calc(100vw - 28px));
        transform: translateX(-50%) translateY(-10px);
        display: none;
        flex-direction: column;
        gap: 12px;
        padding: 14px;
        color: var(--graft-ai-text);
        background: var(--graft-ai-navy);
        border: 1px solid var(--graft-ai-border);
        border-radius: 8px;
        box-shadow: 0 18px 48px rgba(2, 6, 23, 0.34), 0 0 0 1px rgba(182, 204, 232, 0.08);
        pointer-events: auto;
        backdrop-filter: blur(14px);
      }
      .graft-ai-menu {
        position: absolute;
        right: 18px;
        bottom: 18px;
        display: none;
        align-items: center;
        gap: 8px;
        max-width: min(440px, calc(100vw - 36px));
        padding: 6px;
        border: 1px solid var(--graft-ai-border);
        border-radius: 8px;
        background: var(--graft-ai-navy);
        color: var(--graft-ai-text);
        box-shadow: 0 12px 34px rgba(2, 6, 23, 0.28), 0 0 0 1px rgba(182, 204, 232, 0.08);
        pointer-events: auto;
        backdrop-filter: blur(14px);
      }
      .graft-ai-menu.is-visible {
        display: flex;
      }
      .graft-ai-menu .graft-ai-mark {
        align-items: center;
      }
      .graft-ai-menu .graft-ai-logo {
        margin-top: 0;
      }
      .graft-ai-mark {
        display: inline-flex;
        align-items: flex-start;
        gap: 8px;
        min-width: 0;
      }
      .graft-ai-logo {
        display: inline-grid;
        place-items: center;
        width: 22px;
        height: 22px;
        flex: 0 0 auto;
        margin-top: 1px;
        border-radius: 6px;
        background: rgba(114, 217, 129, 0.12);
        box-shadow: inset 0 0 0 1px rgba(114, 217, 129, 0.28), 0 0 0 1px rgba(182, 204, 232, 0.12);
        color: var(--graft-ai-green);
        font-size: 12px;
        font-weight: 800;
        line-height: 1;
      }
      .graft-ai-brand {
        margin: 0;
        color: var(--graft-ai-green);
        font-size: 10px;
        font-weight: 750;
        letter-spacing: 0;
        line-height: 1.1;
      }
      .graft-ai-menu-summary {
        min-width: 0;
        max-width: 220px;
        overflow: hidden;
        color: var(--graft-ai-muted);
        font-size: 11px;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${ROOT_ID}.is-open .graft-ai-backdrop,
      #${ROOT_ID}.is-open .graft-ai-dialog {
        display: flex;
      }
      #${ROOT_ID}.is-open .graft-ai-dialog {
        transform: translateX(-50%) translateY(0);
      }
      .graft-ai-head {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
      }
      .graft-ai-heading {
        min-width: 0;
      }
      .graft-ai-title {
        margin: 0;
        color: var(--graft-ai-text);
        font-size: 15px;
        font-weight: 750;
        letter-spacing: 0;
        line-height: 1.2;
      }
      .graft-ai-subtitle {
        max-width: 520px;
        margin: 3px 0 0;
        color: var(--graft-ai-subtle);
        font-size: 12px;
        line-height: 1.4;
      }
      .graft-ai-close {
        width: 26px;
        height: 26px;
        flex: 0 0 auto;
        border: 1px solid var(--graft-ai-border);
        border-radius: 7px;
        background: var(--graft-ai-panel);
        color: var(--graft-ai-muted);
        cursor: pointer;
      }
      .graft-ai-close:hover {
        color: var(--graft-ai-text);
        border-color: color-mix(in srgb, var(--graft-ai-glow) 40%, var(--graft-ai-border));
      }
      .graft-ai-prompt {
        width: 100%;
        min-height: 92px;
        resize: vertical;
        box-sizing: border-box;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid var(--graft-ai-border);
        outline: none;
        background: #0c1320;
        color: var(--graft-ai-text);
        font: inherit;
        line-height: 1.45;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
      }
      .graft-ai-prompt::placeholder {
        color: var(--graft-ai-subtle);
      }
      .graft-ai-prompt:focus {
        border-color: var(--graft-ai-green);
        box-shadow: 0 0 0 3px rgba(114, 217, 129, 0.16);
      }
      .graft-ai-preview {
        display: none;
        max-height: 240px;
        overflow: auto;
        border: 1px solid var(--graft-ai-border);
        border-radius: 8px;
        background: var(--graft-ai-panel);
      }
      .graft-ai-preview.is-open {
        display: block;
      }
      .graft-ai-item {
        padding: 9px 10px;
        border-bottom: 1px solid var(--graft-ai-border);
      }
      .graft-ai-item:last-child {
        border-bottom: 0;
      }
      .graft-ai-item-title {
        color: var(--graft-ai-text);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.3;
      }
      .graft-ai-item-reason {
        margin-top: 3px;
        color: var(--graft-ai-subtle);
        font-size: 12px;
        line-height: 1.4;
      }
      .graft-ai-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .graft-ai-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 30px;
        padding: 0 10px;
        border: 1px solid transparent;
        border-radius: 8px;
        font: 650 12px/1.2 inherit;
        cursor: pointer;
        transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease, transform 120ms ease;
      }
      .graft-ai-btn:active:not(:disabled) {
        transform: translateY(1px);
      }
      .graft-ai-btn:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
      .graft-ai-btn-primary {
        background: var(--graft-ai-green);
        color: #052e16;
        border-color: rgba(114, 217, 129, 0.42);
      }
      .graft-ai-btn-primary:hover:not(:disabled) {
        background: #84e290;
      }
      .graft-ai-btn-secondary {
        background: var(--graft-ai-panel);
        color: var(--graft-ai-text);
        border-color: var(--graft-ai-border);
      }
      .graft-ai-btn-secondary:hover:not(:disabled) {
        border-color: rgba(182, 204, 232, 0.42);
      }
      .graft-ai-btn-danger {
        background: rgba(127, 29, 29, 0.42);
        color: #fee2e2;
        border-color: rgba(252, 165, 165, 0.28);
      }
      .graft-ai-btn-danger:hover:not(:disabled) {
        background: rgba(127, 29, 29, 0.58);
      }
      .graft-ai-status {
        color: var(--graft-ai-muted);
        font-size: 12px;
        line-height: 1.35;
        min-height: 16px;
      }
    `;
    document.documentElement.appendChild(style);

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="graft-ai-backdrop"></div>
      <div class="graft-ai-menu" aria-label="Graft AI rewrite controls">
        <span class="graft-ai-mark">
          <span class="graft-ai-logo" aria-hidden="true">G</span>
          <span class="graft-ai-menu-summary"></span>
        </span>
        <button class="graft-ai-btn graft-ai-btn-secondary" type="button" data-action="update">Update</button>
        <button class="graft-ai-btn graft-ai-btn-danger" type="button" data-action="revert">Revert</button>
      </div>
      <div class="graft-ai-dialog" role="dialog" aria-modal="true" aria-label="Graft AI Rewriter">
        <div class="graft-ai-head">
          <div class="graft-ai-mark graft-ai-heading">
            <span class="graft-ai-logo" aria-hidden="true">G</span>
            <div>
              <p class="graft-ai-brand">Graft</p>
              <p class="graft-ai-title">Reshape this site</p>
              <p class="graft-ai-subtitle">Reflow it, restyle it, hide sections, or rewire shortcuts. Your approved version persists for this domain.</p>
            </div>
          </div>
          <button class="graft-ai-close" type="button" aria-label="Close">×</button>
        </div>
        <textarea class="graft-ai-prompt" placeholder="Make this page calmer, denser, and remove distracting feed items"></textarea>
        <div class="graft-ai-preview"></div>
        <div class="graft-ai-actions">
          <button class="graft-ai-btn graft-ai-btn-primary" type="button" data-action="generate">Generate preview</button>
          <button class="graft-ai-btn graft-ai-btn-primary" type="button" data-action="apply" style="display:none">Apply to this domain</button>
          <button class="graft-ai-btn graft-ai-btn-secondary" type="button" data-action="cancel">Cancel</button>
          <span class="graft-ai-status" aria-live="polite"></span>
        </div>
      </div>
    `;
    document.documentElement.appendChild(root);

    dialog = root.querySelector(".graft-ai-dialog");
    promptInput = root.querySelector(".graft-ai-prompt");
    preview = root.querySelector(".graft-ai-preview");
    statusNode = root.querySelector(".graft-ai-status");
    generateButton = root.querySelector("[data-action='generate']");
    applyButton = root.querySelector("[data-action='apply']");
    menu = root.querySelector(".graft-ai-menu");
    menuSummary = root.querySelector(".graft-ai-menu-summary");
    updateButton = root.querySelector("[data-action='update']");
    revertButton = root.querySelector("[data-action='revert']");

    root.querySelector(".graft-ai-backdrop").addEventListener("click", closeOverlay);
    root.querySelector(".graft-ai-close").addEventListener("click", closeOverlay);
    root.querySelector("[data-action='cancel']").addEventListener("click", closeOverlay);
    generateButton.addEventListener("click", generatePreview);
    applyButton.addEventListener("click", applyPreview);
    updateButton.addEventListener("click", openUpdateOverlay);
    revertButton.addEventListener("click", revertRecipes);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && root.classList.contains("is-open")) closeOverlay();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        openOverlay();
      }
    });
  }

  function openOverlay(prompt = "", options = {}) {
    if (!state.enabled) return;
    ensureUi();
    state.updateMode = Boolean(options.updateMode);
    root.classList.add("is-open");
    if (prompt) promptInput.value = prompt;
    window.setTimeout(() => promptInput.focus(), 0);
    if (applyButton) {
      applyButton.textContent = state.updateMode ? "Update this domain" : "Apply to this domain";
    }
    updateMenu();
  }

  function openUpdateOverlay() {
    const active = visibleRecipes();
    const latest = active[active.length - 1];
    const basePrompt = latest?.prompt
      ? `Update the current AI rewrite. Current prompt: ${latest.prompt}\n\nChange: `
      : "Update the current AI rewrite. Change: ";
    openOverlay(basePrompt, { updateMode: true });
  }

  function closeOverlay() {
    if (!root) return;
    root.classList.remove("is-open");
    state.pendingRecipe = null;
    state.pendingRequestId = "";
    state.updateMode = false;
    if (preview) {
      preview.textContent = "";
      preview.classList.remove("is-open");
    }
    if (applyButton) applyButton.style.display = "none";
    if (generateButton) {
      generateButton.disabled = false;
      generateButton.textContent = "Generate preview";
    }
    setStatus("");
    updateMenu();
  }

  function setStatus(message, error = false) {
    if (!statusNode) return;
    statusNode.textContent = message || "";
    statusNode.style.color = error ? "#fca5a5" : "";
  }

  function renderPreview(recipe) {
    const normalized = normalizeRecipe(recipe);
    if (!preview || !normalized) return;
    preview.textContent = "";
    const header = document.createElement("div");
    header.className = "graft-ai-item";
    header.innerHTML = `<div class="graft-ai-item-title"></div><div class="graft-ai-item-reason"></div>`;
    header.querySelector(".graft-ai-item-title").textContent = normalized.summary;
    header.querySelector(".graft-ai-item-reason").textContent =
      `${normalized.actions.length} safe action${normalized.actions.length === 1 ? "" : "s"} for ${normalized.domain}`;
    preview.appendChild(header);
    for (const action of normalized.actions) {
      const row = document.createElement("div");
      row.className = "graft-ai-item";
      row.innerHTML = `<div class="graft-ai-item-title"></div><div class="graft-ai-item-reason"></div>`;
      row.querySelector(".graft-ai-item-title").textContent =
        action.type === "theme"
          ? `theme: ${action.theme.preset} / ${action.theme.palette} / ${action.theme.mode}`
          : action.type;
      row.querySelector(".graft-ai-item-reason").textContent = action.reason;
      preview.appendChild(row);
    }
    preview.classList.add("is-open");
  }

  function generatePreview() {
    const prompt = (promptInput?.value || "").trim();
    if (!prompt) {
      setStatus("Describe how you want this site to feel or work.", true);
      return;
    }
    const requestId = `graft-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    state.pendingRequestId = requestId;
    state.pendingRecipe = null;
    if (generateButton) {
      generateButton.disabled = true;
      generateButton.textContent = "Generating...";
    }
    if (applyButton) applyButton.style.display = "none";
    if (preview) {
      preview.textContent = "";
      preview.classList.remove("is-open");
    }
    setStatus("Reading page and asking local Codex helper...");
    window.postMessage(
      {
        source: SOURCE,
        type: MESSAGE_GENERATE,
        requestId,
        prompt,
        context: collectContext(),
      },
      "*"
    );
  }

  function applyPreview() {
    const recipe = normalizeRecipe(state.pendingRecipe);
    if (!recipe) {
      setStatus("No valid preview to apply.", true);
      return;
    }
    const applied = applyRecipe(recipe);
    if (applied === 0) {
      setStatus("Could not match any actions on this page.", true);
      return;
    }
    state.recipes = state.updateMode
      ? [recipe]
      : [...state.recipes.filter((item) => item.id !== recipe.id), recipe];
    window.postMessage(
      {
        source: SOURCE,
        type: MESSAGE_SAVE,
        recipe: { ...recipe, enabled: true },
        replaceDomain: state.updateMode,
      },
      "*"
    );
    closeOverlay();
  }

  function revertRecipes() {
    const active = visibleRecipes();
    if (active.length === 0) {
      removeThemeStyles();
      updateMenu();
      return;
    }
    const needsReload = active.some(recipeHasDestructiveActions);
    const requestId = `graft-ai-revert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    state.pendingRevertId = requestId;
    state.pendingRevertNeedsReload = needsReload;
    state.recipes = [];
    clearShortcuts();
    removeThemeStyles();
    updateMenu();
    if (revertButton) {
      revertButton.disabled = true;
      revertButton.textContent = needsReload ? "Reloading..." : "Reverting...";
    }
    window.postMessage(
      {
        source: SOURCE,
        type: MESSAGE_REVERT,
        requestId,
      },
      "*"
    );
    if (!needsReload) {
      window.setTimeout(() => {
        if (revertButton) {
          revertButton.disabled = false;
          revertButton.textContent = "Revert";
        }
      }, 800);
    }
  }

  function handleResult(data) {
    if (!data || data.requestId !== state.pendingRequestId) return;
    if (generateButton) {
      generateButton.disabled = false;
      generateButton.textContent = "Generate preview";
    }
    const response = data.response;
    if (!response?.ok || !response.recipe) {
      setStatus(response?.error || "AI helper returned no recipe.", true);
      return;
    }
    const recipe = normalizeRecipe(response.recipe);
    if (!recipe) {
      setStatus("AI helper returned an unsafe recipe.", true);
      return;
    }
    state.pendingRecipe = recipe;
    renderPreview(recipe);
    if (applyButton) applyButton.style.display = "inline-flex";
    setStatus("Preview ready. Apply to persist this version of the site.");
  }

  function handleState(data) {
    state.enabled = Boolean(data.enabled);
    state.domain = normalizeDomain(data.domain);
    state.recipes = Array.isArray(data.recipes)
      ? data.recipes.map(normalizeRecipe).filter(Boolean)
      : [];
    if (visibleRecipes().length > 0) {
      ensureUi();
    }
    applyRecipes();
    updateMenu();
  }

  function handleReverted(data) {
    if (state.pendingRevertId && data.requestId !== state.pendingRevertId) {
      return;
    }
    const shouldReload = state.pendingRevertNeedsReload;
    state.pendingRevertId = "";
    state.pendingRevertNeedsReload = false;
    state.recipes = [];
    clearShortcuts();
    removeThemeStyles();
    updateMenu();
    if (revertButton) {
      revertButton.disabled = false;
      revertButton.textContent = "Revert";
    }
    if (shouldReload) {
      location.reload();
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE) return;
    if (data.type === MESSAGE_STATE) handleState(data);
    if (data.type === MESSAGE_OPEN) openOverlay(data.prompt || "");
    if (data.type === MESSAGE_RESULT) handleResult(data);
    if (data.type === MESSAGE_REVERTED) handleReverted(data);
  });

  document.addEventListener("DOMContentLoaded", applyRecipes);
  window.addEventListener("beforeunload", () => {
    clearShortcuts();
    observer?.disconnect();
  });
})();
