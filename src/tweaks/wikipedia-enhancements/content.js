(function () {
  "use strict";

  const STYLE_ID = "graft-wikipedia-enhancements-style";
  const TOC_ID = "graft-wikipedia-toc";
  const MANAGED_REFERENCE = "data-graft-wikipedia-references";
  const MANAGED_HIGHLIGHT = "data-graft-wikipedia-highlight";
  const MANAGED_HIDDEN = "data-graft-wikipedia-hidden";
  const MANAGED_REFERENCE_HEADING = "data-graft-wikipedia-reference-heading";

  const DEFAULT_SETTINGS = {
    wikipediaEnhancementsEnabled: false,
    wikipediaReadingWidthEnabled: false,
    wikipediaReadingWidthPreset: "comfortable",
    wikipediaNavigationCleanupEnabled: false,
    wikipediaCollapseReferencesEnabled: false,
    wikipediaFloatingTocEnabled: false,
    wikipediaSearchHighlightEnabled: false,
    wikipediaHideDonationBannersEnabled: false,
  };

  const STYLE_TEXT = `
    html[data-graft-wikipedia-width="narrow"] .mw-content-container,
    html[data-graft-wikipedia-width="narrow"] .mw-body-content,
    html[data-graft-wikipedia-width="narrow"] #bodyContent {
      max-width: min(680px, calc(100vw - 32px)) !important;
      margin-inline: auto !important;
    }

    html[data-graft-wikipedia-width="comfortable"] .mw-content-container,
    html[data-graft-wikipedia-width="comfortable"] .mw-body-content,
    html[data-graft-wikipedia-width="comfortable"] #bodyContent {
      max-width: min(760px, calc(100vw - 32px)) !important;
      margin-inline: auto !important;
    }

    html[data-graft-wikipedia-width="wide"] .mw-content-container,
    html[data-graft-wikipedia-width="wide"] .mw-body-content,
    html[data-graft-wikipedia-width="wide"] #bodyContent {
      max-width: min(920px, calc(100vw - 32px)) !important;
      margin-inline: auto !important;
    }

    html[data-graft-wikipedia-navigation-cleanup] #mw-panel,
    html[data-graft-wikipedia-navigation-cleanup] #vector-main-menu,
    html[data-graft-wikipedia-navigation-cleanup] #p-lang,
    html[data-graft-wikipedia-navigation-cleanup] #p-lang-btn,
    html[data-graft-wikipedia-navigation-cleanup] #p-interaction,
    html[data-graft-wikipedia-navigation-cleanup] #p-tb,
    html[data-graft-wikipedia-navigation-cleanup] #p-coll-print_export,
    html[data-graft-wikipedia-navigation-cleanup] #p-wikibase-otherprojects {
      display: none !important;
    }

    html[data-graft-wikipedia-navigation-cleanup] .mw-page-container,
    html[data-graft-wikipedia-navigation-cleanup] .mw-workspace-container {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    html[data-graft-wikipedia-references] details[data-graft-wikipedia-references] {
      margin-block: 1.25rem;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
    }

    html[data-graft-wikipedia-references] details[data-graft-wikipedia-references] > summary {
      cursor: pointer;
      font-weight: 600;
      color: inherit;
    }

    html[data-graft-wikipedia-references] details[data-graft-wikipedia-references] > [data-graft-wikipedia-reference-heading] {
      display: none !important;
    }

    html[data-graft-wikipedia-search-highlight] mark[data-graft-wikipedia-highlight] {
      border-radius: 2px;
      background: color-mix(in srgb, #9adf8f 46%, transparent);
      color: inherit;
      padding-inline: 0.08em;
    }

    html[data-graft-wikipedia-donations] [data-graft-wikipedia-hidden] {
      display: none !important;
    }

    #${TOC_ID} {
      position: fixed;
      z-index: 2147483645;
      top: 88px;
      right: max(16px, calc((100vw - 1400px) / 2));
      width: 224px;
      max-height: calc(100vh - 112px);
      overflow: auto;
      border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
      border-radius: 8px;
      background: color-mix(in srgb, Canvas 94%, transparent);
      color: CanvasText;
      box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
      font: 13px/1.35 system-ui, sans-serif;
      backdrop-filter: blur(4px);
    }

    #${TOC_ID}[data-collapsed="true"] ol {
      display: none;
    }

    #${TOC_ID} [data-graft-wikipedia-toc-header] {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border-bottom: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
      padding: 9px 10px;
      font-weight: 600;
    }

    #${TOC_ID} button {
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      padding: 2px 4px;
    }

    #${TOC_ID} ol {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 8px 10px 10px 24px;
    }

    #${TOC_ID} li[data-level="3"] {
      margin-left: 12px;
    }

    #${TOC_ID} li[data-level="4"] {
      margin-left: 24px;
    }

    #${TOC_ID} a {
      display: block;
      color: inherit;
      text-decoration: none;
      opacity: 0.72;
      padding: 2px 0;
    }

    #${TOC_ID} a:hover,
    #${TOC_ID} a[data-active="true"] {
      color: #4d8f55;
      opacity: 1;
    }

    @media (max-width: 1199px) {
      #${TOC_ID} {
        display: none;
      }
    }
  `;

  let settings = { ...DEFAULT_SETTINGS };
  let observer = null;
  let tocObserver = null;
  let renderTimer = null;
  let rendering = false;
  let styleNode = null;

  function normalizePreset(value) {
    return value === "narrow" || value === "wide" ? value : "comfortable";
  }

  function isWikipediaHostname(hostname) {
    const host = String(hostname || "")
      .trim()
      .toLowerCase()
      .replace(/\.$/, "");
    return host === "wikipedia.org" || host.endsWith(".wikipedia.org");
  }

  function getNamespaceNumber() {
    try {
      const value = window.mw?.config?.get?.("wgNamespaceNumber");
      return typeof value === "number" ? value : null;
    } catch (_error) {
      return null;
    }
  }

  function isEligibleArticlePage() {
    if (!isWikipediaHostname(location.hostname)) {
      return false;
    }

    if (!location.pathname.startsWith("/wiki/")) {
      return false;
    }

    const params = new URLSearchParams(location.search);
    if (
      params.has("action") ||
      params.has("diff") ||
      params.has("oldid") ||
      params.has("veaction")
    ) {
      return false;
    }

    const namespaceNumber = getNamespaceNumber();
    if (typeof namespaceNumber === "number") {
      return namespaceNumber === 0;
    }

    let title = "";
    try {
      title = decodeURIComponent(location.pathname.slice("/wiki/".length));
    } catch (_error) {
      title = location.pathname.slice("/wiki/".length);
    }

    return ![
      "talk",
      "user",
      "wikipedia",
      "file",
      "mediawiki",
      "template",
      "help",
      "category",
      "portal",
      "book",
      "draft",
      "module",
      "timedtext",
      "special",
    ].includes(title.split(":", 1)[0].toLowerCase());
  }

  function getArticleRoot() {
    return (
      document.querySelector("#mw-content-text") ||
      document.querySelector(".mw-parser-output") ||
      document.querySelector("#bodyContent")
    );
  }

  function ensureStyle() {
    if (styleNode?.isConnected) {
      return;
    }

    styleNode = document.createElement("style");
    styleNode.id = STYLE_ID;
    styleNode.textContent = STYLE_TEXT;
    (document.head || document.documentElement).appendChild(styleNode);
  }

  function removeStyle() {
    styleNode?.remove();
    styleNode = null;
    document.getElementById(STYLE_ID)?.remove();
  }

  function getSearchTerm() {
    const value = new URLSearchParams(location.search).get("search")?.trim() || "";
    return value.length > 0 && value.length <= 120 ? value : null;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function removeHighlights() {
    document.querySelectorAll(`[${MANAGED_HIGHLIGHT}]`).forEach((node) => {
      node.replaceWith(...Array.from(node.childNodes));
      node.parentNode?.normalize();
    });
  }

  function shouldSkipHighlight(node) {
    const parent = node.parentElement;
    return Boolean(
      !parent ||
        parent.closest(
          [
            `[${MANAGED_HIGHLIGHT}]`,
            "[data-graft-ui]",
            "code",
            "pre",
            "math",
            ".mwe-math-element",
            ".reference",
            ".mw-references-wrap",
            ".reflist",
            "table",
            "style",
            "script",
            "textarea",
            "input",
          ].join(",")
        )
    );
  }

  function applySearchHighlights(article) {
    const term = getSearchTerm();
    if (!term) {
      return;
    }

    const root = article.querySelector(".mw-parser-output") || article;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const regex = new RegExp(escapeRegExp(term), "gi");
    const textNodes = [];
    let current = walker.nextNode();

    while (current) {
      if (!shouldSkipHighlight(current) && current.nodeValue?.trim()) {
        textNodes.push(current);
      }
      current = walker.nextNode();
    }

    let matchCount = 0;
    for (const textNode of textNodes) {
      if (matchCount >= 500 || !textNode.parentNode) {
        break;
      }

      regex.lastIndex = 0;
      const text = textNode.nodeValue || "";
      let lastIndex = 0;
      let match = regex.exec(text);
      if (!match) {
        continue;
      }

      const fragment = document.createDocumentFragment();
      while (match && matchCount < 500) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        const mark = document.createElement("mark");
        mark.setAttribute(MANAGED_HIGHLIGHT, "");
        mark.textContent = match[0];
        fragment.appendChild(mark);
        matchCount += 1;
        lastIndex = match.index + match[0].length;
        match = regex.exec(text);
      }

      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      textNode.replaceWith(fragment);
    }
  }

  function isDonationBanner(node) {
    if (!(node instanceof HTMLElement)) {
      return false;
    }

    const text = (node.textContent || "").slice(0, 3000);
    return /(donat|fundrais|support wikipedia|give today)/i.test(text);
  }

  function applyDonationBannerCleanup() {
    const selectors = [
      "#siteNotice",
      ".cn-banner",
      ".frb",
      "[id*='fundrais' i]",
      "[class*='fundrais' i]",
      "[id*='donation' i]",
      "[class*='donation' i]",
    ];
    const candidates = new Set();

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => candidates.add(node));
    }

    for (const node of candidates) {
      if (isDonationBanner(node)) {
        node.setAttribute(MANAGED_HIDDEN, "");
      }
    }
  }

  function restoreDonationBanners() {
    document.querySelectorAll(`[${MANAGED_HIDDEN}]`).forEach((node) => {
      node.removeAttribute(MANAGED_HIDDEN);
    });
  }

  function findReferenceHeading(list) {
    const section = list.closest("section");
    if (section) {
      const directHeading = section.querySelector(
        ":scope > .mw-heading > h2, :scope > .mw-heading > h3, :scope > h2, :scope > h3, :scope > h4"
      );
      if (directHeading) {
        return directHeading.closest(".mw-heading") || directHeading;
      }
    }

    let sibling = list.previousElementSibling;
    while (sibling) {
      const heading = sibling.matches("h2, h3, h4, h5, h6")
        ? sibling
        : sibling.querySelector?.("h2, h3, h4, h5, h6");
      if (heading) {
        return heading.closest(".mw-heading") || heading;
      }
      sibling = sibling.previousElementSibling;
    }

    return null;
  }

  function getReferenceBlocks(section) {
    return Array.from(section.querySelectorAll("ol.references, .reflist")).filter(
      (node) =>
        !(node.matches("ol.references") && node.closest(".reflist")) &&
        !node.closest(`[${MANAGED_REFERENCE}]`)
    );
  }

  function getHeadingElement(container) {
    return container.matches?.("h2, h3, h4, h5, h6")
      ? container
      : container.querySelector("h2, h3, h4, h5, h6");
  }

  function applyReferenceCollapse(article) {
    const candidates = Array.from(
      article.querySelectorAll("ol.references, .reflist")
    ).filter((node) => !node.closest(`[${MANAGED_REFERENCE}]`));

    const seenSections = new Set();
    for (const list of candidates) {
      const section = list.closest("section") || list.parentElement;
      if (!section || seenSections.has(section)) {
        continue;
      }

      const headingContainer = findReferenceHeading(list);
      const blocks = getReferenceBlocks(section);
      if (!headingContainer || blocks.length === 0) {
        continue;
      }

      const parent = headingContainer.parentNode;
      if (!parent) {
        continue;
      }

      const placeholder = document.createComment("graft-wikipedia-references");
      const blockPlaceholders = blocks.map((block) => {
        const blockPlaceholder = document.createComment(
          "graft-wikipedia-reference-block"
        );
        block.replaceWith(blockPlaceholder);
        return { block, placeholder: blockPlaceholder };
      });
      const details = document.createElement("details");
      details.setAttribute(MANAGED_REFERENCE, "");
      details.open = false;

      const heading = getHeadingElement(headingContainer);
      const summary = document.createElement("summary");
      summary.textContent = heading?.textContent?.trim() || "References";
      if (heading?.id) {
        summary.id = heading.id;
      }

      headingContainer.setAttribute(MANAGED_REFERENCE_HEADING, "");
      heading?.removeAttribute("id");
      parent.replaceChild(placeholder, headingContainer);
      parent.insertBefore(details, placeholder);
      details.append(summary, headingContainer, ...blocks);
      details.__graftReferencePlaceholder = placeholder;
      details.__graftReferenceHeading = headingContainer;
      details.__graftReferenceBlocks = blockPlaceholders;
      seenSections.add(section);
    }
  }

  function restoreReferences() {
    document.querySelectorAll(`details[${MANAGED_REFERENCE}]`).forEach((details) => {
      const placeholder = details.__graftReferencePlaceholder;
      const headingContainer = details.__graftReferenceHeading;
      if (placeholder?.parentNode && headingContainer) {
        headingContainer.removeAttribute(MANAGED_REFERENCE_HEADING);
        const heading = getHeadingElement(headingContainer);
        const summary = details.querySelector(":scope > summary");
        if (heading && summary?.id) {
          heading.id = summary.id;
        }
        placeholder.replaceWith(headingContainer);
      }
      for (const { block, placeholder } of details.__graftReferenceBlocks || []) {
        if (placeholder?.parentNode && block) {
          placeholder.replaceWith(block);
        }
      }
      details.remove();
    });
  }

  function getTocHeadings(article) {
    const root = article.querySelector(".mw-parser-output") || article;
    return Array.from(root.querySelectorAll("h2, h3, h4")).filter(
      (heading) =>
        heading.id &&
        heading.textContent?.trim() &&
        !heading.closest("[data-graft-ui]") &&
        !heading.closest(".mw-references-wrap, .reflist")
    );
  }

  function createFloatingToc(article) {
    const headings = getTocHeadings(article);
    if (headings.length === 0 || document.getElementById(TOC_ID)) {
      return;
    }

    const panel = document.createElement("aside");
    panel.id = TOC_ID;
    panel.setAttribute("data-graft-ui", "wikipedia-toc");
    panel.setAttribute("aria-label", "Wikipedia table of contents");

    const header = document.createElement("div");
    header.setAttribute("data-graft-wikipedia-toc-header", "");
    const title = document.createElement("span");
    title.textContent = "On this page";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = "Hide";
    toggle.setAttribute("aria-expanded", "true");
    toggle.addEventListener("click", () => {
      const collapsed = panel.dataset.collapsed === "true";
      panel.dataset.collapsed = collapsed ? "false" : "true";
      toggle.textContent = collapsed ? "Hide" : "Show";
      toggle.setAttribute("aria-expanded", String(collapsed));
    });
    header.append(title, toggle);

    const list = document.createElement("ol");
    const links = [];
    for (const heading of headings.slice(0, 80)) {
      const item = document.createElement("li");
      item.dataset.level = heading.tagName.slice(1);
      const link = document.createElement("a");
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent.trim();
      link.addEventListener("click", (event) => {
        event.preventDefault();
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", `#${heading.id}`);
      });
      item.appendChild(link);
      list.appendChild(item);
      links.push({ heading, link });
    }

    panel.append(header, list);
    document.body.appendChild(panel);

    if ("IntersectionObserver" in window) {
      tocObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const match = links.find(({ heading }) => heading === entry.target);
            if (match && entry.isIntersecting) {
              links.forEach(({ link }) => link.removeAttribute("data-active"));
              match.link.setAttribute("data-active", "true");
            }
          }
        },
        { rootMargin: "-88px 0px -65% 0px", threshold: 0 }
      );
      links.forEach(({ heading }) => tocObserver.observe(heading));
    }
  }

  function removeFloatingToc() {
    tocObserver?.disconnect();
    tocObserver = null;
    document.getElementById(TOC_ID)?.remove();
  }

  function clearPageState() {
    removeFloatingToc();
    restoreReferences();
    removeHighlights();
    restoreDonationBanners();
    removeStyle();
    document.documentElement.removeAttribute("data-graft-wikipedia-width");
    document.documentElement.removeAttribute("data-graft-wikipedia-navigation-cleanup");
    document.documentElement.removeAttribute("data-graft-wikipedia-references");
    document.documentElement.removeAttribute("data-graft-wikipedia-search-highlight");
    document.documentElement.removeAttribute("data-graft-wikipedia-donations");
  }

  function render() {
    if (rendering) {
      return;
    }

    rendering = true;
    observer?.disconnect();
    clearPageState();

    const article = getArticleRoot();
    if (article && isEligibleArticlePage() && settings.wikipediaEnhancementsEnabled) {
      ensureStyle();

      if (settings.wikipediaReadingWidthEnabled) {
        document.documentElement.dataset.graftWikipediaWidth = normalizePreset(
          settings.wikipediaReadingWidthPreset
        );
      }

      if (settings.wikipediaNavigationCleanupEnabled) {
        document.documentElement.dataset.graftWikipediaNavigationCleanup = "true";
      }

      if (settings.wikipediaCollapseReferencesEnabled) {
        document.documentElement.dataset.graftWikipediaReferences = "true";
        applyReferenceCollapse(article);
      }

      if (settings.wikipediaFloatingTocEnabled) {
        createFloatingToc(article);
      }

      if (settings.wikipediaSearchHighlightEnabled) {
        document.documentElement.dataset.graftWikipediaSearchHighlight = "true";
        applySearchHighlights(article);
      }

      if (settings.wikipediaHideDonationBannersEnabled) {
        document.documentElement.dataset.graftWikipediaDonations = "true";
        applyDonationBannerCleanup();
      }
    }

    if (document.body && observer) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    rendering = false;
  }

  function scheduleRender(delay = 120) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      render();
    }, delay);
  }

  function installRouteHooks() {
    for (const method of ["pushState", "replaceState"]) {
      const original = history[method];
      if (typeof original !== "function") {
        continue;
      }
      history[method] = function (...args) {
        const result = original.apply(this, args);
        scheduleRender(80);
        return result;
      };
    }

    window.addEventListener("popstate", () => scheduleRender(80));

    try {
      window.mw?.hook?.("wikipage.content")?.add?.(() => scheduleRender(80));
    } catch (_error) {
      // Older Wikipedia pages may not expose the hook; the DOM observer remains active.
    }
  }

  function loadSettings() {
    if (!chrome.storage?.sync) {
      render();
      return;
    }

    chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
      if (chrome.runtime.lastError) {
        render();
        return;
      }
      settings = { ...DEFAULT_SETTINGS, ...stored };
      render();
    });
  }

  observer = new MutationObserver((records) => {
    if (rendering) {
      return;
    }

    const relevant = records.some((record) => {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      return Boolean(target?.closest?.("#mw-content-text, .mw-parser-output, #bodyContent"));
    });

    if (relevant) {
      scheduleRender();
    }
  });

  chrome.storage?.onChanged?.addListener?.((changes, area) => {
    if (area !== "sync") {
      return;
    }

    const relevantKeys = Object.keys(DEFAULT_SETTINGS);
    if (!relevantKeys.some((key) => key in changes)) {
      return;
    }

    for (const key of relevantKeys) {
      if (key in changes) {
        settings[key] = changes[key].newValue;
      }
    }
    render();
  });

  installRouteHooks();
  loadSettings();
})();
