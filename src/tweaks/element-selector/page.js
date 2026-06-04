(function () {
  "use strict";

  const MESSAGE_SOURCE = "graft-element-selector";
  const MESSAGE_STATE = "BTM_ELEMENT_SELECTOR_STATE";
  const MESSAGE_REMOVE = "BTM_ELEMENT_SELECTOR_REMOVE";
  const MESSAGE_CLEAR_LOCATE = "BTM_ELEMENT_SELECTOR_CLEAR_LOCATE";
  const MESSAGE_OPEN_HIDDEN_LIST = "BTM_ELEMENT_SELECTOR_OPEN_HIDDEN_LIST";
  const MESSAGE_UNDO = "BTM_ELEMENT_SELECTOR_UNDO";
  const MESSAGE_UNDO_APPLIED = "BTM_ELEMENT_SELECTOR_UNDO_APPLIED";
  const MESSAGE_REWRITE = "BTM_ELEMENT_SELECTOR_REWRITE";

  const CURSOR_CLASS = "btm-element-selector-mode";
  const STYLE_ID = "btm-element-selector-styles";
  const THEME_STYLE_ID = "btm-extension-theme-tokens";
  const SHARED_BTN_STYLE_ID = "btm-es-shared-button-styles";
  const MAX_COPY_TEXT_LENGTH = 20000;

  const OVERLAY_Z_INDEX = 2147483647;
  const CONTROL_Z_INDEX = 2147483648;

  const OVERLAY_LERP = 0.26;
  const OVERLAY_SETTLE_EPS = 0.45;

  const state = {
    enabled: false,
    domain: "",
    activeElement: null,
    activeSignature: null,
    lockedTarget: null,
    removals: [],
    rewrites: [],
    initialized: false,
    overlayTargetRect: null,
    overlayCurrentRect: null,
    overlayRafId: null,
    locateSignature: null,
    locateRequestId: null,
    locateKind: null,
  };

  let locateRetryTimer = null;
  let locateAutoDismissTimer = null;
  let locateFlashMount = null;
  let locateScrollCleanup = null;
  let locateSessionId = null;

  let lastInteractivelyRemovedKey = null;
  /** @type {{ parent: Node, nextSibling: Node|null, signature: object, clone: Node }|null} */
  let lastSessionRemoval = null;

  let removalDomObserver = null;
  let removalDebounceTimer = null;
  const REMOVAL_DOM_DEBOUNCE_MS = 450;

  /** @type {Map<string, { signature: object, newText: string }>} */
  const sessionRewrites = new Map();
  let rewritePanelOpen = false;

  /** @type {HTMLDivElement|null} */
  let overlayRoot = null;
  /** @type {HTMLDivElement|null} */
  let overlayBox = null;
  /** @type {HTMLDivElement|null} */
  let controlRoot = null;
  /** @type {HTMLDivElement|null} */
  let controlTitle = null;
  /** @type {HTMLButtonElement|null} */
  let unlockButton = null;
  /** @type {HTMLButtonElement|null} */
  let removeButton = null;
  /** @type {HTMLButtonElement|null} */
  let copyButton = null;
  /** @type {HTMLButtonElement|null} */
  let rewriteButton = null;
  /** @type {HTMLDivElement|null} */
  let actionsRow = null;
  /** @type {HTMLDivElement|null} */
  let rewritePanel = null;
  /** @type {HTMLTextAreaElement|null} */
  let rewriteInput = null;
  /** @type {HTMLInputElement|null} */
  let rewritePersistCheckbox = null;
  /** @type {HTMLButtonElement|null} */
  let rewriteApplyButton = null;
  /** @type {HTMLButtonElement|null} */
  let rewriteCancelButton = null;
  /** @type {HTMLSpanElement|null} */
  let statusNode = null;
  /** @type {HTMLStyleElement|null} */
  let styleNode = null;

  function motionReduced() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  }

  function createCloseIconSvg() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.25");
    svg.setAttribute("stroke-linecap", "round");
    svg.style.display = "block";
    const a = document.createElementNS("http://www.w3.org/2000/svg", "path");
    a.setAttribute("d", "M18 6 6 18");
    const b = document.createElementNS("http://www.w3.org/2000/svg", "path");
    b.setAttribute("d", "m6 6 12 12");
    svg.appendChild(a);
    svg.appendChild(b);
    return svg;
  }

  function cancelOverlayAnimation() {
    if (state.overlayRafId != null) {
      cancelAnimationFrame(state.overlayRafId);
      state.overlayRafId = null;
    }
  }

  function rectsNearlyEqual(a, b, eps = 0.35) {
    if (!a || !b) {
      return false;
    }
    return (
      Math.abs(a.left - b.left) < eps &&
      Math.abs(a.top - b.top) < eps &&
      Math.abs(a.width - b.width) < eps &&
      Math.abs(a.height - b.height) < eps
    );
  }

  function normalizeDomain(value) {
    if (!value) {
      return location.hostname.replace(/^www\./, "").toLowerCase();
    }
    return String(value).replace(/^www\./, "").toLowerCase();
  }

  function cssEscape(value) {
    const fallback = (input) =>
      String(input).replace(/[\\"'`;\\n\\r\\f\\t]/g, (char) => `\\${char}`);
    return window.CSS?.escape ? window.CSS.escape(value) : fallback(value);
  }

  function isToolElement(target) {
    return (
      !!target &&
      (target === overlayRoot ||
        target === overlayBox ||
        target === controlRoot ||
        (controlRoot && controlRoot.contains(target)) ||
        (overlayRoot && overlayRoot.contains(target)))
    );
  }

  function isValidElement(value) {
    return value instanceof Element && value !== document.documentElement && value !== document.body;
  }

  function normalizeSignatures(list) {
    if (!Array.isArray(list)) {
      return [];
    }

    const seen = new Set();
    const output = [];

    for (const item of list) {
      const normalized = normalizeSignature(item);
      if (!normalized) {
        continue;
      }
      const key = JSON.stringify([
        normalized.primarySelector,
        normalized.selectorPath,
        normalized.tagName,
        normalized.id,
        normalized.classes.join(",")
      ]);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      output.push(normalized);
    }

    return output;
  }

  function normalizeSignature(item) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const classes = Array.isArray(item.classes)
      ? item.classes.filter(Boolean).map(String).slice(0, 16)
      : [];

    const signature = {
      primarySelector: typeof item.primarySelector === "string" ? item.primarySelector : "",
      selectorPath: typeof item.selectorPath === "string" ? item.selectorPath : "",
      tagName: typeof item.tagName === "string" ? item.tagName.toLowerCase() : "",
      id: typeof item.id === "string" ? item.id : "",
      classes,
      sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : "",
    };

    if (!signature.tagName && !signature.primarySelector && !signature.selectorPath) {
      return null;
    }

    return signature;
  }

  function signatureStableKey(signature) {
    if (!signature) {
      return "";
    }
    return JSON.stringify([
      signature.primarySelector || "",
      signature.selectorPath || "",
      signature.tagName || "",
      signature.id || "",
      (signature.classes || []).join(","),
    ]);
  }

  function signaturesMatch(left, right) {
    if (!left || !right) {
      return false;
    }
    if (left.primarySelector && right.primarySelector) {
      return left.primarySelector === right.primarySelector;
    }
    if (left.selectorPath && right.selectorPath) {
      return left.selectorPath === right.selectorPath;
    }
    return (
      left.tagName === right.tagName &&
      left.id === right.id &&
      left.classes.join(",") === right.classes.join(",")
    );
  }

  function normalizeRewriteEntry(item) {
    const signature = normalizeSignature(item);
    if (!signature) {
      return null;
    }

    return {
      ...signature,
      newText: typeof item.newText === "string" ? item.newText : "",
    };
  }

  function normalizeRewrites(list) {
    if (!Array.isArray(list)) {
      return [];
    }

    const seen = new Set();
    const output = [];

    for (const item of list) {
      const normalized = normalizeRewriteEntry(item);
      if (!normalized) {
        continue;
      }
      const key = signatureStableKey(normalized);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      output.push(normalized);
    }

    return output;
  }

  function canSafelyRewriteText(node) {
    if (!node || !(node instanceof Element)) {
      return false;
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "textarea") {
      return true;
    }
    if (tag === "input") {
      const type = (node.type || "text").toLowerCase();
      return ["text", "search", "email", "url", "tel"].includes(type);
    }
    if (["script", "style", "noscript"].includes(tag)) {
      return false;
    }

    const text = (node.textContent || "").trim();
    if (!text) {
      return false;
    }

    if (node.children.length === 0) {
      return true;
    }

    if (node.children.length === 1) {
      const child = node.children[0];
      const inlineTags = new Set([
        "span",
        "a",
        "strong",
        "em",
        "b",
        "i",
        "small",
        "label",
        "mark",
        "sub",
        "sup",
        "code",
      ]);
      if (inlineTags.has(child.tagName.toLowerCase()) && child.children.length === 0) {
        return true;
      }
    }

    return false;
  }

  function getElementEditableText(node) {
    if (!node) {
      return "";
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "textarea") {
      return node.value || "";
    }
    if (tag === "input") {
      return node.value || "";
    }

    return (node.textContent || "").trim();
  }

  function setElementText(node, text) {
    if (!node) {
      return;
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "textarea" || tag === "input") {
      node.value = text;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    node.textContent = text;
  }

  function applyRewriteToElement(element, newText) {
    if (!element || shouldSkipRemovalTarget(element)) {
      return false;
    }
    setElementText(element, newText);
    return true;
  }

  function getRewriteEntryForSignature(signature) {
    if (!signature) {
      return null;
    }

    const key = signatureStableKey(signature);
    const sessionEntry = sessionRewrites.get(key);
    if (sessionEntry) {
      return sessionEntry;
    }

    return state.rewrites.find((entry) => signaturesMatch(entry, signature)) || null;
  }

  function applyPersistedRewrites(rewriteList) {
    const useFullState = rewriteList === undefined;
    const rawList = rewriteList ?? state.rewrites;
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return;
    }

    const unique = normalizeRewrites(rawList);
    if (useFullState) {
      state.rewrites = unique;
    }

    for (const entry of unique) {
      const key = signatureStableKey(entry);
      if (sessionRewrites.has(key)) {
        continue;
      }

      const element = findFirstMatchElement(entry);
      if (element) {
        applyRewriteToElement(element, entry.newText);
      }
    }
  }

  function applySessionRewrites() {
    for (const entry of sessionRewrites.values()) {
      const element = findFirstMatchElement(entry.signature);
      if (element) {
        applyRewriteToElement(element, entry.newText);
      }
    }
  }

  function applyAllRewritesFromState() {
    applyPersistedRewrites();
    applySessionRewrites();
  }

  function ensureBtmThemeTokens() {
    if (document.getElementById(THEME_STYLE_ID)) {
      return;
    }
    const node = document.createElement("style");
    node.id = THEME_STYLE_ID;
    node.textContent = `
      /* Mirrors src/index.css .dark — popup/options use this palette */
      :root {
        --btm-font: "Geist Variable", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --btm-bg: oklch(0.145 0 0);
        --btm-card: oklch(0.205 0 0);
        --btm-fg: oklch(0.985 0 0);
        --btm-muted: oklch(0.269 0 0);
        --btm-muted-fg: oklch(0.708 0 0);
        --btm-border: oklch(1 0 0 / 10%);
        --btm-primary: oklch(0.922 0 0);
        --btm-primary-fg: oklch(0.205 0 0);
        --btm-destructive: oklch(0.704 0.191 22.216);
        --btm-ring: oklch(0.556 0 0);
        --btm-accent: oklch(0.488 0.243 264.376);
        --btm-radius: 0.625rem;
      }
    `;
    document.documentElement.appendChild(node);
  }

  function ensureBtmSharedButtonStyles() {
    if (document.getElementById(SHARED_BTN_STYLE_ID)) {
      return;
    }
    ensureBtmThemeTokens();
    const node = document.createElement("style");
    node.id = SHARED_BTN_STYLE_ID;
    node.textContent = `
      .btm-es-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        padding: 0 10px;
        margin: 0;
        border-radius: calc(var(--btm-radius) * 0.8);
        font: 500 12px/1.2 var(--btm-font);
        cursor: pointer;
        border: 1px solid transparent;
        outline: none;
        -webkit-font-smoothing: antialiased;
      }
      .btm-es-btn:focus-visible {
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--btm-ring) 45%, transparent);
        border-color: color-mix(in oklch, var(--btm-ring) 65%, transparent);
      }
      .btm-es-btn:active {
        transform: translateY(1px);
      }
      .btm-es-btn--primary {
        background: var(--btm-primary);
        color: var(--btm-primary-fg);
      }
      .btm-es-btn--primary:hover {
        background: color-mix(in oklch, var(--btm-primary) 88%, var(--btm-card));
      }
      .btm-es-btn--destructive {
        background: color-mix(in oklch, var(--btm-destructive) 22%, var(--btm-card));
        color: var(--btm-destructive);
        border-color: color-mix(in oklch, var(--btm-destructive) 38%, var(--btm-border));
      }
      .btm-es-btn--destructive:hover {
        background: color-mix(in oklch, var(--btm-destructive) 32%, var(--btm-card));
      }
      .btm-es-btn--outline {
        background: color-mix(in oklch, var(--btm-muted) 35%, transparent);
        color: var(--btm-fg);
        border-color: var(--btm-border);
      }
      .btm-es-btn--outline:hover {
        background: color-mix(in oklch, var(--btm-muted) 55%, transparent);
      }
    `;
    document.documentElement.appendChild(node);
  }

  function ensureRootElements() {
    if (state.initialized) {
      return;
    }

    ensureBtmThemeTokens();
    ensureBtmSharedButtonStyles();

    styleNode = document.createElement("style");
    styleNode.id = STYLE_ID;
    styleNode.textContent = `
      html.${CURSOR_CLASS}, html.${CURSOR_CLASS} * {
        cursor: crosshair !important;
      }
      .btm-element-selector-highlight {
        position: absolute;
        box-sizing: border-box;
        pointer-events: none !important;
        transition: none !important;
        border: 2px solid color-mix(in oklch, var(--btm-ring) 88%, var(--btm-fg));
        border-radius: max(4px, calc(var(--btm-radius) * 0.45));
        background: color-mix(in oklch, var(--btm-ring) 14%, transparent);
      }
      .btm-element-selector-control {
        position: fixed;
        z-index: ${CONTROL_Z_INDEX};
        display: none;
        width: max-content;
        max-width: min(300px, calc(100vw - 16px));
        padding: 10px 12px;
        pointer-events: auto;
        transition: none !important;
        font: 12px/1.45 var(--btm-font);
        color: var(--btm-fg);
        background: color-mix(in oklch, var(--btm-card) 94%, transparent);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
        border: 1px solid var(--btm-border);
        border-radius: var(--btm-radius);
        box-shadow:
          0 1px 2px oklch(0 0 0 / 0.22),
          0 10px 28px oklch(0 0 0 / 0.32);
      }
      .btm-es-control-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .btm-es-control-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
        min-width: 0;
      }
      .btm-es-control-title {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: -0.015em;
        line-height: 1.3;
        color: var(--btm-fg);
        word-break: break-word;
      }
      .btm-es-icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        margin: 0;
        border: none;
        border-radius: calc(var(--btm-radius) * 0.65);
        background: transparent;
        color: var(--btm-muted-fg);
        cursor: pointer;
        flex-shrink: 0;
        -webkit-font-smoothing: antialiased;
      }
      .btm-es-icon-btn:hover {
        background: color-mix(in oklch, var(--btm-muted) 45%, transparent);
        color: var(--btm-fg);
      }
      .btm-es-icon-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--btm-ring) 45%, transparent);
      }
      .btm-es-icon-btn:active {
        transform: translateY(1px);
      }
      .btm-es-control-meta {
        display: block;
        font-size: 11px;
        line-height: 1.35;
        color: var(--btm-muted-fg);
        min-height: 14px;
      }
      .btm-es-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .btm-es-rewrite-panel {
        display: none;
        flex-direction: column;
        gap: 8px;
      }
      .btm-es-rewrite-panel.is-open {
        display: flex;
      }
      .btm-es-rewrite-input {
        width: 100%;
        min-height: 72px;
        max-height: 160px;
        resize: vertical;
        box-sizing: border-box;
        padding: 8px 10px;
        border-radius: calc(var(--btm-radius) * 0.7);
        border: 1px solid var(--btm-border);
        background: color-mix(in oklch, var(--btm-bg) 55%, transparent);
        color: var(--btm-fg);
        font: 12px/1.4 var(--btm-font);
        outline: none;
      }
      .btm-es-rewrite-input:focus-visible {
        border-color: color-mix(in oklch, var(--btm-ring) 65%, transparent);
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--btm-ring) 35%, transparent);
      }
      .btm-es-rewrite-persist {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        line-height: 1.35;
        color: var(--btm-muted-fg);
        cursor: pointer;
        user-select: none;
      }
      .btm-es-rewrite-persist input {
        margin: 0;
        accent-color: var(--btm-primary);
      }
      .btm-es-rewrite-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
    `;
    document.documentElement.appendChild(styleNode);

    overlayRoot = document.createElement("div");
    overlayRoot.id = "btm-element-selector-overlay-root";
    overlayRoot.style.position = "fixed";
    overlayRoot.style.left = "0";
    overlayRoot.style.top = "0";
    overlayRoot.style.right = "0";
    overlayRoot.style.bottom = "0";
    overlayRoot.style.pointerEvents = "none";
    overlayRoot.style.zIndex = String(OVERLAY_Z_INDEX);
    overlayRoot.style.display = "none";

    overlayBox = document.createElement("div");
    overlayBox.className = "btm-element-selector-highlight";
    overlayBox.style.display = "none";
    overlayRoot.appendChild(overlayBox);

    controlRoot = document.createElement("div");
    controlRoot.id = "btm-element-selector-control";
    controlRoot.className = "btm-element-selector-control";

    const content = document.createElement("div");
    content.className = "btm-es-control-body";

    const controlHead = document.createElement("div");
    controlHead.className = "btm-es-control-head";

    controlTitle = document.createElement("div");
    controlTitle.className = "btm-es-control-title";
    controlTitle.textContent = "No element selected";

    unlockButton = document.createElement("button");
    unlockButton.type = "button";
    unlockButton.className = "btm-es-icon-btn";
    unlockButton.setAttribute("aria-label", "Unlock selection");
    unlockButton.title = "Unlock selection";
    unlockButton.style.display = "none";
    unlockButton.appendChild(createCloseIconSvg());

    controlHead.appendChild(controlTitle);
    controlHead.appendChild(unlockButton);

    const actions = document.createElement("div");
    actions.className = "btm-es-actions";
    actionsRow = actions;

    removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btm-es-btn btm-es-btn--destructive";
    removeButton.textContent = "Remove";

    copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "btm-es-btn btm-es-btn--primary";
    copyButton.textContent = "Copy";

    rewriteButton = document.createElement("button");
    rewriteButton.type = "button";
    rewriteButton.className = "btm-es-btn btm-es-btn--outline";
    rewriteButton.textContent = "Rewrite";
    rewriteButton.style.display = "none";

    actions.appendChild(removeButton);
    actions.appendChild(copyButton);
    actions.appendChild(rewriteButton);

    rewritePanel = document.createElement("div");
    rewritePanel.className = "btm-es-rewrite-panel";

    rewriteInput = document.createElement("textarea");
    rewriteInput.className = "btm-es-rewrite-input";
    rewriteInput.setAttribute("aria-label", "Rewritten text");
    rewriteInput.placeholder = "Enter new text…";

    const persistLabel = document.createElement("label");
    persistLabel.className = "btm-es-rewrite-persist";
    rewritePersistCheckbox = document.createElement("input");
    rewritePersistCheckbox.type = "checkbox";
    rewritePersistCheckbox.checked = false;
    persistLabel.appendChild(rewritePersistCheckbox);
    persistLabel.appendChild(document.createTextNode("Keep after reload"));

    const rewriteActions = document.createElement("div");
    rewriteActions.className = "btm-es-rewrite-actions";

    rewriteApplyButton = document.createElement("button");
    rewriteApplyButton.type = "button";
    rewriteApplyButton.className = "btm-es-btn btm-es-btn--primary";
    rewriteApplyButton.textContent = "Apply";

    rewriteCancelButton = document.createElement("button");
    rewriteCancelButton.type = "button";
    rewriteCancelButton.className = "btm-es-btn btm-es-btn--outline";
    rewriteCancelButton.textContent = "Cancel";

    rewriteActions.appendChild(rewriteApplyButton);
    rewriteActions.appendChild(rewriteCancelButton);
    rewritePanel.appendChild(rewriteInput);
    rewritePanel.appendChild(persistLabel);
    rewritePanel.appendChild(rewriteActions);

    statusNode = document.createElement("span");
    statusNode.className = "btm-es-control-meta";
    statusNode.textContent = "";

    content.appendChild(controlHead);
    content.appendChild(actions);
    content.appendChild(rewritePanel);
    content.appendChild(statusNode);
    controlRoot.appendChild(content);

    unlockButton.addEventListener("click", onUnlockSelection);
    removeButton.addEventListener("click", onRemoveSelected);
    copyButton.addEventListener("click", onCopySelected);
    rewriteButton.addEventListener("click", onOpenRewritePanel);
    rewriteApplyButton.addEventListener("click", onApplyRewrite);
    rewriteCancelButton.addEventListener("click", onCloseRewritePanel);
  }

  function mountRoots() {
    ensureRootElements();
    if (!overlayRoot || !overlayBox || !controlRoot) {
      return;
    }

    const mount = document.body || document.documentElement;
    if (!mount) {
      return;
    }

    if (!overlayRoot.isConnected) {
      mount.appendChild(overlayRoot);
    }
    if (!controlRoot.isConnected) {
      mount.appendChild(controlRoot);
    }
    overlayRoot.style.display = "block";
  }

  function clearHighlight() {
    cancelOverlayAnimation();
    state.overlayTargetRect = null;
    state.overlayCurrentRect = null;
    if (overlayBox) {
      overlayBox.style.display = "none";
    }
    if (controlRoot) {
      controlRoot.style.display = "none";
    }
    state.activeElement = null;
    state.activeSignature = null;
    state.lockedTarget = null;
    closeRewritePanel();
    syncUnlockButtonVisibility();
  }

  function elementFromPoint(x, y) {
    const nodes = document.elementsFromPoint(x, y);
    for (const node of nodes) {
      if (!isValidElement(node) || isToolElement(node)) {
        continue;
      }
      return node;
    }
    return null;
  }

  function selectorForNode(node, allowNthSibling = true) {
    if (!node || !(node instanceof Element)) {
      return "";
    }

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

    while (current && current.nodeType === 1 && current !== document.documentElement && guard < 10) {
      const part = selectorForNode(current, current !== node);
      path.unshift(part);
      if (current.id) {
        break;
      }
      current = current.parentElement;
      guard += 1;
    }

    if (!current || current === document.documentElement) {
      return path.join(" > ");
    }

    if (current === document.body) {
      return `body > ${path.join(" > ")}`;
    }

    return path.join(" > ");
  }

  function buildSignature(node) {
    const rect = node.getBoundingClientRect();
    const signature = {
      tagName: node.tagName.toLowerCase(),
      id: node.id || "",
      classes: Array.from(node.classList || []),
      selectorPath: selectorPath(node),
      primarySelector: selectorForNode(node, true),
      sourceUrl: location.href || "",
      textPreview: (node.textContent || "").trim().slice(0, 180),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };

    return signature;
  }

  function elementAttributes(node) {
    const attributes = {};
    for (const attribute of Array.from(node.attributes)) {
      attributes[attribute.name] = attribute.value;
    }
    return attributes;
  }

  function isUnsafeBroadSelector(sel) {
    if (!sel || typeof sel !== "string") {
      return true;
    }
    const t = sel.trim();
    if (!t || t === "*") {
      return true;
    }
    // Single-token tag with no disambiguators (e.g. "div", "span") — never use for bulk remove.
    // Hyphenated names (custom elements) may be specific enough to keep.
    if (/^[a-z][a-z0-9]*$/i.test(t)) {
      return true;
    }
    return false;
  }

  function collectRemovalCandidates(signature) {
    const out = [];
    const push = (candidate) => {
      if (!candidate || typeof candidate !== "string") {
        return;
      }
      const trimmed = candidate.trim();
      if (!trimmed || isUnsafeBroadSelector(trimmed)) {
        return;
      }
      if (!out.includes(trimmed)) {
        out.push(trimmed);
      }
    };

    push(signature.selectorPath);
    push(signature.primarySelector);
    if (signature.tagName) {
      const classPart = signature.classes
        .filter(Boolean)
        .slice(0, 2)
        .map((value) => `.${cssEscape(value)}`)
        .join("");
      if (classPart) {
        push(`${signature.tagName}${classPart}`);
      }
    }
    return out;
  }

  function shouldSkipRemovalTarget(node) {
    if (!node || !(node instanceof Element)) {
      return true;
    }
    const tag = node.tagName.toLowerCase();
    if (tag === "html" || tag === "body" || tag === "head") {
      return true;
    }
    if (node.id === "btm-element-selector-overlay-root") {
      return true;
    }
    if (node.closest && node.closest("#btm-locate-flash-mount")) {
      return true;
    }
    if (controlRoot && controlRoot.contains(node)) {
      return true;
    }
    if (overlayRoot && overlayRoot.contains(node)) {
      return true;
    }
    return false;
  }

  function removeMatchingNode(node) {
    if (!node || shouldSkipRemovalTarget(node)) {
      return;
    }
    node.remove();
  }

  function applyPersistedRemovals(removalList) {
    const useFullState = removalList === undefined;
    const rawList = removalList ?? state.removals;
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return;
    }

    const unique = normalizeSignatures(rawList);
    if (useFullState) {
      state.removals = unique;
    }

    for (const signature of unique) {
      const stableKey = signatureStableKey(signature);
      if (lastInteractivelyRemovedKey && stableKey === lastInteractivelyRemovedKey) {
        lastInteractivelyRemovedKey = null;
        continue;
      }

      const candidates = collectRemovalCandidates(signature);
      let removed = false;

      for (const candidate of candidates) {
        try {
          const element = document.querySelector(candidate);
          if (element && !shouldSkipRemovalTarget(element)) {
            removeMatchingNode(element);
            removed = true;
            break;
          }
        } catch (error) {
          // ignore malformed selectors from older stored states
        }
      }

      if (!removed && signature.id && signature.tagName) {
        const fallback = `${signature.tagName}#${cssEscape(signature.id)}`;
        try {
          const direct = document.querySelector(fallback);
          if (direct && !shouldSkipRemovalTarget(direct)) {
            removeMatchingNode(direct);
          }
        } catch (error) {
          // ignore
        }
      }
    }
  }

  function applyPersistedRemovalsFromState() {
    const deferSig = state.locateSignature;
    const list = deferSig
      ? state.removals.filter((s) => !signaturesMatch(s, deferSig))
      : state.removals;
    applyPersistedRemovals(list);
  }

  function teardownRemovalDomObserver() {
    if (removalDebounceTimer != null) {
      clearTimeout(removalDebounceTimer);
      removalDebounceTimer = null;
    }
    if (removalDomObserver) {
      removalDomObserver.disconnect();
      removalDomObserver = null;
    }
  }

  function scheduleRemovalDomReapply() {
    if (
      (!state.removals || state.removals.length === 0) &&
      (!state.rewrites || state.rewrites.length === 0) &&
      sessionRewrites.size === 0
    ) {
      return;
    }
    if (removalDebounceTimer != null) {
      clearTimeout(removalDebounceTimer);
    }
    removalDebounceTimer = window.setTimeout(() => {
      removalDebounceTimer = null;
      if (state.removals && state.removals.length > 0) {
        applyPersistedRemovalsFromState();
      }
      if (
        (state.rewrites && state.rewrites.length > 0) ||
        sessionRewrites.size > 0
      ) {
        applyAllRewritesFromState();
      }
    }, REMOVAL_DOM_DEBOUNCE_MS);
  }

  function syncRemovalDomObserver() {
    if (
      (!state.removals || state.removals.length === 0) &&
      (!state.rewrites || state.rewrites.length === 0) &&
      sessionRewrites.size === 0
    ) {
      teardownRemovalDomObserver();
      return;
    }
    const root = document.documentElement;
    if (!root) {
      return;
    }
    if (removalDomObserver) {
      return;
    }
    removalDomObserver = new MutationObserver(() => {
      scheduleRemovalDomReapply();
    });
    removalDomObserver.observe(root, { childList: true, subtree: true });
  }

  function findFirstMatchElement(signature) {
    if (!signature) {
      return null;
    }

    const candidates = collectRemovalCandidates(signature);

    for (const candidate of candidates) {
      try {
        const element = document.querySelector(candidate);
        if (element && !shouldSkipRemovalTarget(element)) {
          return element;
        }
      } catch (error) {
        // ignore malformed selectors
      }
    }

    if (signature.id && signature.tagName) {
      try {
        const direct = document.querySelector(`${signature.tagName}#${cssEscape(signature.id)}`);
        if (direct && !shouldSkipRemovalTarget(direct)) {
          return direct;
        }
      } catch (error) {
        // ignore
      }
    }

    return null;
  }

  function teardownLocatePreview() {
    if (locateRetryTimer != null) {
      clearTimeout(locateRetryTimer);
      locateRetryTimer = null;
    }
    if (locateAutoDismissTimer != null) {
      clearTimeout(locateAutoDismissTimer);
      locateAutoDismissTimer = null;
    }
    if (locateScrollCleanup) {
      locateScrollCleanup();
      locateScrollCleanup = null;
    }
    if (locateFlashMount && locateFlashMount.parentNode) {
      locateFlashMount.parentNode.removeChild(locateFlashMount);
    }
    locateFlashMount = null;
    locateSessionId = null;
  }

  function ensureLocateFlashStyles() {
    const id = "btm-locate-flash-style";
    if (document.getElementById(id)) {
      return;
    }
    ensureBtmThemeTokens();
    ensureBtmSharedButtonStyles();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes btm-locate-pulse {
        0%, 100% {
          box-shadow:
            0 0 0 2px color-mix(in oklch, var(--btm-accent) 72%, transparent),
            0 0 22px color-mix(in oklch, var(--btm-accent) 32%, transparent);
        }
        50% {
          box-shadow:
            0 0 0 3px color-mix(in oklch, var(--btm-accent) 88%, transparent),
            0 0 34px color-mix(in oklch, var(--btm-accent) 42%, transparent);
        }
      }
      .btm-locate-highlight {
        position: fixed;
        z-index: ${OVERLAY_Z_INDEX};
        pointer-events: none;
        box-sizing: border-box;
        border: 2px solid color-mix(in oklch, var(--btm-accent) 82%, var(--btm-fg));
        border-radius: max(4px, calc(var(--btm-radius) * 0.45));
        background: color-mix(in oklch, var(--btm-accent) 16%, transparent);
        animation: btm-locate-pulse 1.6s ease-in-out infinite;
      }
      .btm-locate-panel {
        position: fixed;
        z-index: ${CONTROL_Z_INDEX};
        left: 50%;
        top: 12px;
        transform: translateX(-50%);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 10px 14px;
        max-width: min(520px, calc(100vw - 24px));
        font: 12px/1.45 var(--btm-font);
        color: var(--btm-fg);
        background: color-mix(in oklch, var(--btm-card) 94%, transparent);
        -webkit-backdrop-filter: blur(10px);
        backdrop-filter: blur(10px);
        border: 1px solid var(--btm-border);
        border-radius: var(--btm-radius);
        box-shadow:
          0 1px 2px oklch(0 0 0 / 0.22),
          0 12px 36px oklch(0 0 0 / 0.34);
        pointer-events: auto;
      }
      .btm-locate-label {
        flex: 1 1 auto;
        min-width: 0;
        text-align: center;
        font-weight: 600;
        letter-spacing: -0.015em;
        color: var(--btm-fg);
      }
      .btm-locate-panel--message {
        text-align: center;
        line-height: 1.45;
        color: var(--btm-muted-fg);
      }
      .btm-locate-dim {
        position: fixed;
        inset: 0;
        z-index: ${OVERLAY_Z_INDEX - 1};
        background: color-mix(in oklch, var(--btm-bg) 22%, transparent);
        pointer-events: none;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function positionLocateHighlight(box, element) {
    const rect = element.getBoundingClientRect();
    box.style.left = `${Math.round(rect.left)}px`;
    box.style.top = `${Math.round(rect.top)}px`;
    box.style.width = `${Math.max(1, Math.round(rect.width))}px`;
    box.style.height = `${Math.max(1, Math.round(rect.height))}px`;
  }

  function showLocateFlash(element) {
    if (locateRetryTimer != null) {
      clearTimeout(locateRetryTimer);
      locateRetryTimer = null;
    }
    if (locateAutoDismissTimer != null) {
      clearTimeout(locateAutoDismissTimer);
      locateAutoDismissTimer = null;
    }
    if (locateScrollCleanup) {
      locateScrollCleanup();
      locateScrollCleanup = null;
    }
    if (locateFlashMount && locateFlashMount.parentNode) {
      locateFlashMount.parentNode.removeChild(locateFlashMount);
    }
    locateFlashMount = null;

    ensureLocateFlashStyles();

    const mount = document.createElement("div");
    mount.id = "btm-locate-flash-mount";
    document.documentElement.appendChild(mount);
    locateFlashMount = mount;

    const dim = document.createElement("div");
    dim.className = "btm-locate-dim";
    mount.appendChild(dim);

    const box = document.createElement("div");
    box.className = "btm-locate-highlight";
    mount.appendChild(box);
    positionLocateHighlight(box, element);

    const panel = document.createElement("div");
    panel.className = "btm-locate-panel";
    const label = document.createElement("span");
    label.className = "btm-locate-label";
    const isRewriteLocate = state.locateKind === "rewrite";
    label.textContent = isRewriteLocate
      ? "Edited text preview"
      : "Hidden element preview";

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "btm-es-btn btm-es-btn--outline";
    backBtn.textContent = "Back to edited list";
    backBtn.addEventListener("click", () => {
      window.postMessage(
        {
          source: MESSAGE_SOURCE,
          type: MESSAGE_OPEN_HIDDEN_LIST,
        },
        "*"
      );
    });

    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "btm-es-btn btm-es-btn--primary";
    dismissBtn.textContent = "Dismiss";
    dismissBtn.addEventListener("click", () => {
      window.postMessage(
        {
          source: MESSAGE_SOURCE,
          type: MESSAGE_CLEAR_LOCATE,
        },
        "*"
      );
    });

    panel.appendChild(label);
    panel.appendChild(backBtn);
    panel.appendChild(dismissBtn);
    mount.appendChild(panel);

    try {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: motionReduced() ? "auto" : "smooth" });
    } catch (error) {
      // ignore
    }

    const onMove = () => {
      if (!element.isConnected) {
        return;
      }
      positionLocateHighlight(box, element);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    locateScrollCleanup = () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };

    const dismissMs = motionReduced() ? 8000 : 15000;
    locateAutoDismissTimer = window.setTimeout(() => {
      window.postMessage(
        {
          source: MESSAGE_SOURCE,
          type: MESSAGE_CLEAR_LOCATE,
        },
        "*"
      );
    }, dismissMs);
  }

  function showLocateNotFound() {
    if (locateRetryTimer != null) {
      clearTimeout(locateRetryTimer);
      locateRetryTimer = null;
    }
    if (locateAutoDismissTimer != null) {
      clearTimeout(locateAutoDismissTimer);
      locateAutoDismissTimer = null;
    }
    if (locateScrollCleanup) {
      locateScrollCleanup();
      locateScrollCleanup = null;
    }
    if (locateFlashMount && locateFlashMount.parentNode) {
      locateFlashMount.parentNode.removeChild(locateFlashMount);
    }
    locateFlashMount = null;

    ensureLocateFlashStyles();
    const mount = document.createElement("div");
    mount.id = "btm-locate-flash-mount";
    document.documentElement.appendChild(mount);
    locateFlashMount = mount;

    const panel = document.createElement("div");
    panel.className = "btm-locate-panel btm-locate-panel--message";
    panel.style.top = "24px";
    panel.textContent =
      "Could not find that element on this page. It may load later or the page may have changed.";
    mount.appendChild(panel);

    locateAutoDismissTimer = window.setTimeout(() => {
      window.postMessage(
        {
          source: MESSAGE_SOURCE,
          type: MESSAGE_CLEAR_LOCATE,
        },
        "*"
      );
    }, 5000);
  }

  function startLocatePreviewIfNeeded() {
    const sig = state.locateSignature;
    const rid = state.locateRequestId;
    if (!sig || !rid) {
      teardownLocatePreview();
      return;
    }

    if (locateSessionId === rid && (locateRetryTimer != null || locateFlashMount != null)) {
      return;
    }

    teardownLocatePreview();
    locateSessionId = rid;

    let attempt = 0;
    const maxAttempts = 28;

    const scheduleNext = (delay) => {
      locateRetryTimer = window.setTimeout(tryOnce, delay);
    };

    function tryOnce() {
      locateRetryTimer = null;
      if (state.locateRequestId !== rid) {
        return;
      }

      const el = findFirstMatchElement(sig);
      if (el) {
        showLocateFlash(el);
        return;
      }

      attempt += 1;
      if (attempt >= maxAttempts) {
        showLocateNotFound();
        return;
      }

      scheduleNext(400);
    }

    tryOnce();
  }

  function updateControlPosition(rect) {
    if (!controlRoot) {
      return;
    }

    const gap = 8;
    const bottom = rect.top + rect.height;
    const topBase = rect.top - gap - Math.max(controlRoot.offsetHeight, 40);
    let top = topBase >= 4 ? topBase : bottom + gap;
    let left = rect.left;

    const maxLeft = Math.max(4, window.innerWidth - controlRoot.offsetWidth - 6);
    const maxTop = Math.max(4, window.innerHeight - controlRoot.offsetHeight - 6);

    if (left > maxLeft) {
      left = maxLeft;
    }
    if (left < 4) {
      left = 4;
    }
    if (top > maxTop) {
      top = maxTop;
    }
    if (top < 4) {
      top = 4;
    }

    controlRoot.style.left = `${left}px`;
    controlRoot.style.top = `${top}px`;
  }

  function applyRectToVisuals(rect) {
    if (!overlayBox) {
      return;
    }
    overlayBox.style.display = "block";
    overlayBox.style.left = `${Math.round(rect.left)}px`;
    overlayBox.style.top = `${Math.round(rect.top)}px`;
    overlayBox.style.width = `${Math.max(1, Math.round(rect.width))}px`;
    overlayBox.style.height = `${Math.max(1, Math.round(rect.height))}px`;
    updateControlPosition(rect);
  }

  function scheduleOverlayTick() {
    if (state.overlayRafId != null) {
      return;
    }
    state.overlayRafId = requestAnimationFrame(tickOverlay);
  }

  function tickOverlay() {
    state.overlayRafId = null;
    if (!state.enabled || !overlayBox || !state.overlayTargetRect) {
      return;
    }

    const tgt = state.overlayTargetRect;

    if (!state.overlayCurrentRect) {
      state.overlayCurrentRect = {
        left: tgt.left,
        top: tgt.top,
        width: tgt.width,
        height: tgt.height,
      };
      applyRectToVisuals(state.overlayCurrentRect);
      return;
    }

    const cur = state.overlayCurrentRect;
    const k = OVERLAY_LERP;
    const next = {
      left: cur.left + (tgt.left - cur.left) * k,
      top: cur.top + (tgt.top - cur.top) * k,
      width: cur.width + (tgt.width - cur.width) * k,
      height: cur.height + (tgt.height - cur.height) * k,
    };

    const settled =
      Math.abs(next.left - tgt.left) < OVERLAY_SETTLE_EPS &&
      Math.abs(next.top - tgt.top) < OVERLAY_SETTLE_EPS &&
      Math.abs(next.width - tgt.width) < OVERLAY_SETTLE_EPS &&
      Math.abs(next.height - tgt.height) < OVERLAY_SETTLE_EPS;

    state.overlayCurrentRect = settled
      ? {
          left: tgt.left,
          top: tgt.top,
          width: tgt.width,
          height: tgt.height,
        }
      : next;

    applyRectToVisuals(state.overlayCurrentRect);

    if (!settled) {
      scheduleOverlayTick();
    }
  }

  function setOverlayTargetFromRect(domRect) {
    if (!state.enabled || !overlayBox) {
      return;
    }

    const next = {
      left: domRect.left,
      top: domRect.top,
      width: domRect.width,
      height: domRect.height,
    };

    if (state.overlayTargetRect && rectsNearlyEqual(state.overlayTargetRect, next)) {
      return;
    }

    state.overlayTargetRect = next;

    if (motionReduced()) {
      cancelOverlayAnimation();
      state.overlayCurrentRect = { ...next };
      applyRectToVisuals(state.overlayCurrentRect);
      return;
    }

    scheduleOverlayTick();
  }

  function setStatus(message, error = false) {
    if (!statusNode) {
      return;
    }
    statusNode.textContent = message;
    if (error) {
      statusNode.style.color = "var(--btm-destructive)";
    } else {
      statusNode.style.removeProperty("color");
    }
  }

  function syncUnlockButtonVisibility() {
    if (!unlockButton) {
      return;
    }
    unlockButton.style.display = state.lockedTarget ? "inline-flex" : "none";
  }

  function onUnlockSelection(event) {
    event.preventDefault();
    event.stopPropagation();
    state.lockedTarget = null;
    clearHighlight();
  }

  function syncRewriteButtonVisibility() {
    if (!rewriteButton) {
      return;
    }

    const show =
      !!state.activeElement &&
      canSafelyRewriteText(state.activeElement) &&
      !rewritePanelOpen;
    rewriteButton.style.display = show ? "inline-flex" : "none";
  }

  function closeRewritePanel() {
    rewritePanelOpen = false;
    if (rewritePanel) {
      rewritePanel.classList.remove("is-open");
    }
    if (actionsRow) {
      actionsRow.style.display = "flex";
    }
    if (rewriteInput) {
      rewriteInput.value = "";
    }
    if (rewritePersistCheckbox) {
      rewritePersistCheckbox.checked = false;
    }
    syncRewriteButtonVisibility();
  }

  function onOpenRewritePanel(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!state.activeElement || !state.activeSignature) {
      return;
    }
    if (!canSafelyRewriteText(state.activeElement)) {
      return;
    }

    rewritePanelOpen = true;
    if (rewritePanel) {
      rewritePanel.classList.add("is-open");
    }
    if (actionsRow) {
      actionsRow.style.display = "none";
    }
    if (rewriteInput) {
      rewriteInput.value = getElementEditableText(state.activeElement);
      rewriteInput.focus();
      rewriteInput.select();
    }
    if (rewritePersistCheckbox) {
      const existing = getRewriteEntryForSignature(state.activeSignature);
      rewritePersistCheckbox.checked = Boolean(
        existing &&
          state.rewrites.some((entry) => signaturesMatch(entry, state.activeSignature))
      );
    }
    syncRewriteButtonVisibility();
    setStatus("");
  }

  function onCloseRewritePanel(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    closeRewritePanel();
    setStatus("");
  }

  function onApplyRewrite(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!state.activeElement || !state.activeSignature || !rewriteInput) {
      return;
    }

    const newText = rewriteInput.value;
    const signature = buildSignature(state.activeElement);
    const persist = Boolean(rewritePersistCheckbox?.checked);
    const applied = applyRewriteToElement(state.activeElement, newText);

    if (!applied) {
      setStatus("Could not rewrite that element.", true);
      return;
    }

    const key = signatureStableKey(signature);
    if (persist) {
      sessionRewrites.delete(key);
      notifyBridgeForRewrite(signature, newText);
      setStatus("Text rewritten and saved for this site.");
    } else {
      sessionRewrites.set(key, { signature: { ...signature }, newText });
      syncRemovalDomObserver();
      setStatus("Text rewritten for this visit.");
    }

    closeRewritePanel();
    setTimeout(() => setStatus(""), 1600);
  }

  function notifyBridgeForRewrite(signature, newText) {
    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: MESSAGE_REWRITE,
        persist: true,
        payload: {
          selectorPath: signature.selectorPath,
          primarySelector: signature.primarySelector,
          tagName: signature.tagName,
          id: signature.id,
          classes: signature.classes,
          sourceUrl: signature.sourceUrl,
          newText,
        },
        domain: state.domain,
      },
      "*"
    );
  }

  function setPanelForNode(signature) {
    if (!controlRoot || !controlTitle || !statusNode) {
      return;
    }

    const classes =
      signature.classes.length > 0 ? `.${signature.classes.join(".")}` : "";
    const id = signature.id ? `#${signature.id}` : "";
    const summaryParts = [signature.tagName.toLowerCase(), id, classes].filter(Boolean);

    controlTitle.textContent = summaryParts.join("");
    controlRoot.style.display = "block";
    setStatus("");
    removeButton && (removeButton.disabled = false);
    copyButton && (copyButton.disabled = false);
    closeRewritePanel();
    syncRewriteButtonVisibility();
  }

  function markActive(node) {
    if (!node || !isValidElement(node) || !isValidNodeCandidate(node)) {
      clearHighlight();
      return;
    }

    const rect = node.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) {
      clearHighlight();
      return;
    }

    if (state.activeElement !== node) {
      state.activeElement = node;
      state.activeSignature = buildSignature(node);
      setPanelForNode(state.activeSignature);
    }

    setOverlayTargetFromRect(rect);
    syncUnlockButtonVisibility();
  }

  function isValidNodeCandidate(node) {
    if (!node || !(node instanceof Element)) {
      return false;
    }
    const tag = node.tagName.toLowerCase();
    if (tag === "html" || tag === "body") {
      return false;
    }
    if (!node.getClientRects || node.getClientRects().length === 0) {
      return false;
    }
    return true;
  }

  function handlePointerMove(event) {
    if (!state.enabled) {
      return;
    }

    if (state.lockedTarget) {
      if (!state.lockedTarget.isConnected) {
        state.lockedTarget = null;
        clearHighlight();
        return;
      }
      markActive(state.lockedTarget);
      return;
    }

    const node = elementFromPoint(event.clientX, event.clientY);
    if (!node) {
      clearHighlight();
      return;
    }
    if (!isValidNodeCandidate(node)) {
      clearHighlight();
      return;
    }
    markActive(node);
  }

  function handlePointerDownCapture(event) {
    if (!state.enabled) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if (isToolElement(event.target)) {
      return;
    }

    const node = elementFromPoint(event.clientX, event.clientY);
    if (node && isValidNodeCandidate(node)) {
      state.lockedTarget = node;
      markActive(node);
    } else {
      state.lockedTarget = null;
      clearHighlight();
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function handleClickCapture(event) {
    if (!state.enabled) {
      return;
    }
    if (isToolElement(event.target)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function copyTextToClipboard(payload) {
    const text = JSON.stringify(payload, null, 2);
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise((resolve, reject) => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      textarea.remove();
      if (successful) {
        resolve();
      } else {
        reject(new Error("Clipboard write failed."));
      }
    });
  }

  function onCopySelected() {
    if (!state.activeElement || !state.activeSignature) {
      return;
    }

    const node = state.activeElement;
    const rect = node.getBoundingClientRect();

    const payload = {
      timestamp: new Date().toISOString(),
      domain: state.domain,
      page: {
        url: location.href,
        title: document.title,
        referrer: document.referrer
      },
      geometry: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      },
      element: {
        tagName: node.tagName.toLowerCase(),
        id: node.id || null,
        classes: Array.from(node.classList || []),
        text: {
          content: (node.textContent || "").trim().slice(0, MAX_COPY_TEXT_LENGTH),
        },
        attributes: elementAttributes(node),
        outerHTML: node.outerHTML,
        selectorPath: state.activeSignature.selectorPath,
        signature: {
          tagName: state.activeSignature.tagName,
          id: state.activeSignature.id,
          primarySelector: state.activeSignature.primarySelector,
          classes: state.activeSignature.classes,
        },
      },
    };

    copyTextToClipboard(payload)
      .then(() => {
        setStatus("Copied JSON metadata to clipboard.");
        setTimeout(() => setStatus(""), 1300);
      })
      .catch(() => {
        setStatus("Failed to copy metadata.");
      });
  }

  function onRemoveSelected() {
    if (!state.activeElement || !state.activeSignature) {
      return;
    }

    const node = state.activeElement;
    const signature = buildSignature(node);

    lastInteractivelyRemovedKey = signatureStableKey(signature);
    if (node.parentNode) {
      lastSessionRemoval = {
        parent: node.parentNode,
        nextSibling: node.nextSibling,
        signature: { ...signature },
        clone: node.cloneNode(true),
      };
    }
    node.remove();
    state.removals = normalizeSignatures([...state.removals, signature]);
    notifyBridgeForRemoval(signature);
    clearHighlight();
    setStatus("Element removed and saved for this domain.");
    setTimeout(() => setStatus(""), 1300);
  }

  function notifyBridgeForRemoval(signature) {
    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: MESSAGE_REMOVE,
        payload: {
          selectorPath: signature.selectorPath,
          primarySelector: signature.primarySelector,
          tagName: signature.tagName,
          id: signature.id,
          classes: signature.classes,
          sourceUrl: signature.sourceUrl,
        },
        domain: state.domain
      },
      "*"
    );
  }

  function refreshOverlayForActive() {
    if (!state.activeElement) {
      return;
    }

    const rect = state.activeElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      clearHighlight();
      return;
    }
    setOverlayTargetFromRect(rect);
  }

  function undoLastHide() {
    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: MESSAGE_UNDO,
      },
      "*"
    );
  }

  function tryRestoreLastSessionRemoval(removedSignature) {
    if (!lastSessionRemoval || !removedSignature) {
      return false;
    }

    const key = signatureStableKey(removedSignature);
    if (signatureStableKey(lastSessionRemoval.signature) !== key) {
      return false;
    }

    const { parent, nextSibling, clone } = lastSessionRemoval;
    if (!parent || !parent.isConnected || !clone) {
      lastSessionRemoval = null;
      return false;
    }

    if (nextSibling && nextSibling.parentNode === parent) {
      parent.insertBefore(clone, nextSibling);
    } else {
      parent.appendChild(clone);
    }

    lastSessionRemoval = null;
    lastInteractivelyRemovedKey = null;
    return true;
  }

  function handleKeydown(event) {
    if (!state.enabled) {
      return;
    }
    if (event.key === "Escape") {
      if (rewritePanelOpen) {
        onCloseRewritePanel();
        event.preventDefault();
        return;
      }
      state.lockedTarget = null;
      clearHighlight();
      event.preventDefault();
      return;
    }

    const mod = event.metaKey || event.ctrlKey;
    if (mod && !event.shiftKey && event.key.toLowerCase() === "z") {
      undoLastHide();
      setStatus("Undoing last hide…");
      event.preventDefault();
    }
  }

  function startListening() {
    if (!state.initialized) {
      ensureRootElements();
      state.initialized = true;
    }
    if (!overlayRoot || !controlRoot) {
      return;
    }

    mountRoots();
    document.documentElement.classList.add(CURSOR_CLASS);
    applyPersistedRemovalsFromState();
    applyAllRewritesFromState();
    syncRemovalDomObserver();

    document.addEventListener("mousemove", handlePointerMove, true);
    document.addEventListener("click", handleClickCapture, true);
    document.addEventListener("pointerdown", handlePointerDownCapture, true);
    document.addEventListener("scroll", refreshOverlayForActive, true);
    window.addEventListener("resize", refreshOverlayForActive);
    window.addEventListener("scroll", refreshOverlayForActive, true);
    window.addEventListener("keydown", handleKeydown, true);
    window.addEventListener("visibilitychange", refreshOverlayForActive);
  }

  function stopListening() {
    clearHighlight();
    if (overlayRoot) {
      overlayRoot.style.display = "none";
    }
    document.documentElement.classList.remove(CURSOR_CLASS);

    document.removeEventListener("mousemove", handlePointerMove, true);
    document.removeEventListener("click", handleClickCapture, true);
    document.removeEventListener("pointerdown", handlePointerDownCapture, true);
    document.removeEventListener("scroll", refreshOverlayForActive, true);
    window.removeEventListener("resize", refreshOverlayForActive);
    window.removeEventListener("scroll", refreshOverlayForActive, true);
    window.removeEventListener("keydown", handleKeydown, true);
    window.removeEventListener("visibilitychange", refreshOverlayForActive);
  }

  function applyBridgeUpdate(data) {
    const enabled = Boolean(data.elementSelectorEnabled);
    const removals = normalizeSignatures(data.removals || []);
    const rewrites = normalizeRewrites(data.rewrites || []);
    const locateSig = data.locateSignature ? normalizeSignature(data.locateSignature) : null;
    const locateRid = typeof data.locateRequestId === "string" ? data.locateRequestId : null;
    const locateKind =
      data.locateKind === "rewrite" || data.locateKind === "hidden"
        ? data.locateKind
        : null;

    state.domain = normalizeDomain(data.domain || state.domain);
    state.removals = removals;
    state.rewrites = rewrites;
    state.locateSignature = locateSig;
    state.locateRequestId = locateRid;
    state.locateKind = locateKind;

    applyPersistedRemovalsFromState();
    applyAllRewritesFromState();
    syncRemovalDomObserver();

    if (locateSig && locateRid) {
      startLocatePreviewIfNeeded();
    } else {
      teardownLocatePreview();
    }

    if (state.enabled === enabled && enabled) {
      if (state.activeElement) {
        refreshOverlayForActive();
      }
      return;
    }

    state.enabled = enabled;
    if (enabled) {
      startListening();
    } else {
      stopListening();
    }
  }

  function handleMessage(event) {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== MESSAGE_SOURCE) {
      return;
    }

    if (data.type === MESSAGE_UNDO_APPLIED) {
      state.removals = state.removals.filter(
        (entry) => signatureStableKey(entry) !== signatureStableKey(data.payload)
      );
      tryRestoreLastSessionRemoval(data.payload);
      setStatus("Undid last hide for this site.");
      setTimeout(() => setStatus(""), 1600);
      return;
    }

    if (data.type !== MESSAGE_STATE) {
      return;
    }

    applyBridgeUpdate(data);
  }

  window.addEventListener("message", handleMessage);
  window.addEventListener("beforeunload", () => {
    teardownLocatePreview();
    teardownRemovalDomObserver();
    stopListening();
  });
  document.addEventListener("DOMContentLoaded", () => {
    applyPersistedRemovalsFromState();
    applyAllRewritesFromState();
    syncRemovalDomObserver();
    if (state.locateSignature && state.locateRequestId) {
      startLocatePreviewIfNeeded();
    }
  });
})();
