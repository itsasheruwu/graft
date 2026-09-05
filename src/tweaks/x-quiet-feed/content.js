(function () {
  "use strict";

  const STYLE_ID = "graft-x-quiet-feed-style";
  const HIDDEN_ATTRIBUTE = "data-graft-x-quiet-feed-hidden";
  const DEFAULT_SETTINGS = { xQuietFeedEnabled: false };
  const MODULE_HEADINGS = new Set([
    "who to follow",
    "you might like",
    "suggested for you",
    "today's news",
    "today’s news",
    "what's happening",
    "what’s happening",
    "trending",
    "explore",
  ]);
  let enabled = false;
  let observer = null;
  let scanTimer = null;

  function shouldSkip() {
    try {
      const host = location.hostname.toLowerCase().replace(/\.$/, "");
      return (
        window.self !== window.top ||
        (host !== "x.com" && host !== "www.x.com") ||
        !document.documentElement ||
        document.documentElement.hasAttribute("data-graft-ui")
      );
    } catch (_error) {
      return true;
    }
  }

  function exactText(node) {
    return String(node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function hasPromotedLabel(article) {
    return Array.from(article.querySelectorAll("span, a, div")).some((node) => {
      const label = exactText(node);
      return label === "promoted" || label === "ad";
    });
  }

  function findSafeModuleContainer(heading) {
    const sidebar = heading.closest("[data-testid='sidebarColumn']");
    for (let node = heading.parentElement, depth = 0; node && depth < 8; node = node.parentElement, depth += 1) {
      if (node.matches("section, [role='region'], [role='complementary'], [aria-label^='Timeline:']")) return node;
      if (sidebar && node.parentElement === sidebar) return node;
    }
    if (sidebar) {
      let child = heading;
      while (child.parentElement && child.parentElement !== sidebar) {
        child = child.parentElement;
      }
      return child.parentElement === sidebar ? child : null;
    }
    return null;
  }

  function mark(node) {
    if (node) node.setAttribute(HIDDEN_ATTRIBUTE, "true");
  }

  function scan() {
    if (!enabled || shouldSkip()) return;
    document.querySelectorAll("article").forEach((article) => {
      if (hasPromotedLabel(article)) mark(article);
    });
    document.querySelectorAll("h1, h2, h3, [role='heading'], span").forEach((node) => {
      if (MODULE_HEADINGS.has(exactText(node))) mark(findSafeModuleContainer(node));
    });
  }

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = `[${HIDDEN_ATTRIBUTE}="true"] { display: none !important; }`;
  }

  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 80);
  }

  function apply() {
    if (!enabled || shouldSkip()) {
      teardown();
      return;
    }
    ensureStyle();
    scan();
    if (!observer && document.body) {
      observer = new MutationObserver(scheduleScan);
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  function teardown() {
    window.clearTimeout(scanTimer);
    observer?.disconnect();
    observer = null;
    document.getElementById(STYLE_ID)?.remove();
    document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`).forEach((node) => node.removeAttribute(HIDDEN_ATTRIBUTE));
  }

  function update(value) {
    enabled = Boolean(value);
    apply();
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    if (!chrome.runtime.lastError) update(stored.xQuietFeedEnabled);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && "xQuietFeedEnabled" in changes) update(changes.xQuietFeedEnabled.newValue);
  });
  window.addEventListener("beforeunload", teardown, { once: true });
})();
