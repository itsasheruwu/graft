(function () {
  "use strict";

  const SETTINGS_DEFAULTS = {
    assetFinderEnabled: true,
    assetFinderHideBlankAssets: false,
  };
  const REMOVALS_KEY = "elementSelectorRemovedElementsByDomain";
  const ROOT_ID = "graft-asset-finder-root";
  const STYLE_ID = "graft-asset-finder-style";
  const HIGHLIGHT_ID = "graft-asset-finder-highlight";
  const MAX_BACKGROUND_SCAN = 1600;
  const MAX_ASSETS = 600;

  const state = {
    open: false,
    minimized: false,
    assets: [],
    filtered: [],
    selectedId: null,
    query: "",
    typeFilter: "all",
    extFilter: "all",
    sizeFilter: "all",
    view: "grid",
    filtersCollapsed: false,
    hideBlankAssets: false,
    status: "",
    root: null,
    highlight: null,
    lastStats: null,
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "asset-finder:open") {
      return false;
    }

    chrome.storage.sync.get(SETTINGS_DEFAULTS, (stored) => {
      const enabled = stored?.assetFinderEnabled !== false;
      if (!enabled) {
        sendResponse({ ok: false, error: "Asset Finder is disabled." });
        return;
      }

      state.hideBlankAssets = Boolean(stored?.assetFinderHideBlankAssets);
      openPanel();
      sendResponse({ ok: true });
    });

    return true;
  });

  function openPanel() {
    state.open = true;
    state.minimized = false;
    ensurePanel();
    scanAndRender("Scanned page assets.");
  }

  function ensurePanel() {
    ensureStyles();

    if (state.root?.isConnected) {
      return;
    }

    const root = document.createElement("aside");
    root.id = ROOT_ID;
    root.setAttribute("aria-label", "Graft Asset Finder");
    root.addEventListener("pointerdown", stopPageEvent);
    root.addEventListener("mousedown", stopPageEvent);
    root.addEventListener("click", stopPageEvent);
    root.addEventListener("keydown", onPanelKeydown);
    document.documentElement.appendChild(root);
    state.root = root;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}, #${ROOT_ID} * {
        box-sizing: border-box;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #${ROOT_ID} {
        --gaf-bg: oklch(0.985 0 0);
        --gaf-fg: oklch(0.145 0 0);
        --gaf-muted: oklch(0.47 0 0);
        --gaf-border: oklch(0.86 0 0);
        --gaf-card: oklch(1 0 0);
        --gaf-soft: oklch(0.96 0 0);
        --gaf-primary: oklch(0.205 0 0);
        --gaf-primary-fg: oklch(0.985 0 0);
        --gaf-active: oklch(0.72 0.19 142);
        --gaf-active-fg: oklch(0.16 0.03 258);
        --gaf-danger: oklch(0.58 0.2 28);
        --resize-dur: 300ms;
        --resize-ease: cubic-bezier(0.22, 1, 0.36, 1);
        --digit-dur: 500ms;
        --digit-distance: 8px;
        --digit-stagger: 70ms;
        --digit-blur: 2px;
        --digit-ease: cubic-bezier(0.34, 1.45, 0.64, 1);
        --digit-dir-x: 0;
        --digit-dir-y: 1;
        --panel-open-dur: 400ms;
        --panel-close-dur: 350ms;
        --panel-translate-y: 14px;
        --panel-blur: 2px;
        --panel-ease: cubic-bezier(0.22, 1, 0.36, 1);
        position: fixed;
        top: 12px;
        right: 12px;
        bottom: 12px;
        z-index: 2147483645;
        display: flex;
        width: min(520px, calc(100vw - 24px));
        min-height: 360px;
        color: var(--gaf-fg);
        background: color-mix(in oklch, var(--gaf-bg) 96%, transparent);
        border: 1px solid var(--gaf-border);
        border-radius: 12px;
        box-shadow: 0 24px 70px oklch(0 0 0 / 0.26), 0 2px 8px oklch(0 0 0 / 0.12);
        -webkit-backdrop-filter: blur(16px);
        backdrop-filter: blur(16px);
        overflow: hidden;
      }
      #${ROOT_ID}.t-resize {
        transition:
          width var(--resize-dur) var(--resize-ease),
          height var(--resize-dur) var(--resize-ease);
        will-change: width, height;
      }
      @keyframes gaf-t-digit-pop-in {
        0% {
          transform: translate(
            calc(var(--digit-distance) * var(--digit-dir-x)),
            calc(var(--digit-distance) * var(--digit-dir-y))
          );
          opacity: 0;
          filter: blur(var(--digit-blur));
        }
        100% { transform: translate(0, 0); opacity: 1; filter: blur(0); }
      }
      #${ROOT_ID} .t-digit-group {
        display: inline-flex;
        align-items: baseline;
      }
      #${ROOT_ID} .t-digit {
        display: inline-block;
        will-change: transform, opacity, filter;
      }
      #${ROOT_ID} .t-digit-group.is-animating .t-digit {
        animation: gaf-t-digit-pop-in var(--digit-dur) var(--digit-ease) both;
      }
      #${ROOT_ID} .t-digit-group.is-animating .t-digit[data-stagger="1"] {
        animation-delay: var(--digit-stagger);
      }
      #${ROOT_ID} .t-digit-group.is-animating .t-digit[data-stagger="2"] {
        animation-delay: calc(var(--digit-stagger) * 2);
      }
      #${ROOT_ID} .t-panel-slide {
        transform: translateY(var(--panel-translate-y));
        opacity: 0;
        filter: blur(var(--panel-blur));
        pointer-events: none;
        transition:
          transform var(--panel-close-dur) var(--panel-ease),
          opacity var(--panel-close-dur) var(--panel-ease),
          filter var(--panel-close-dur) var(--panel-ease),
          max-height var(--panel-close-dur) var(--panel-ease);
        will-change: transform, opacity, filter;
      }
      #${ROOT_ID} .t-panel-slide[data-open="true"] {
        transform: translateY(0);
        opacity: 1;
        filter: blur(0);
        pointer-events: auto;
        transition:
          transform var(--panel-open-dur) var(--panel-ease),
          opacity var(--panel-open-dur) var(--panel-ease),
          filter var(--panel-open-dur) var(--panel-ease),
          max-height var(--panel-open-dur) var(--panel-ease);
      }
      @media (prefers-color-scheme: dark) {
        #${ROOT_ID} {
          --gaf-bg: oklch(0.145 0 0);
          --gaf-fg: oklch(0.985 0 0);
          --gaf-muted: oklch(0.708 0 0);
          --gaf-border: oklch(1 0 0 / 15%);
          --gaf-card: oklch(0.205 0 0);
          --gaf-soft: oklch(0.269 0 0);
          --gaf-primary: oklch(0.08 0 0);
          --gaf-primary-fg: oklch(0.985 0 0);
          --gaf-active: oklch(0.76 0.2 142);
          --gaf-active-fg: oklch(0.16 0.03 258);
        }
      }
      #${ROOT_ID}.is-minimized {
        top: auto;
        left: auto;
        bottom: 16px;
        width: auto;
        min-height: 0;
        height: auto;
      }
      #${ROOT_ID}.is-minimized .gaf-body,
      #${ROOT_ID}.is-minimized .gaf-toolbar,
      #${ROOT_ID}.is-minimized .gaf-stats {
        display: none;
      }
      .gaf-shell {
        display: flex;
        flex: 1;
        min-width: 0;
        min-height: 0;
        flex-direction: column;
      }
      .gaf-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 14px;
        border-bottom: 1px solid var(--gaf-border);
        background: color-mix(in oklch, var(--gaf-card) 72%, transparent);
      }
      .gaf-title {
        margin: 0;
        font-size: 14px;
        line-height: 1.2;
        font-weight: 700;
        letter-spacing: 0;
        color: var(--gaf-fg);
      }
      .gaf-subtitle {
        margin: 3px 0 0;
        font-size: 11px;
        line-height: 1.35;
        color: var(--gaf-muted);
      }
      .gaf-header-actions,
      .gaf-actions,
      .gaf-view-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .gaf-btn,
      .gaf-chip,
      .gaf-icon-btn {
        appearance: none;
        border: 1px solid var(--gaf-border);
        border-radius: 8px;
        background: var(--gaf-card);
        color: var(--gaf-fg);
        cursor: pointer;
        font: 600 11px/1 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: 0;
      }
      .gaf-btn {
        min-height: 30px;
        padding: 0 10px;
      }
      .gaf-btn:hover,
      .gaf-chip:hover,
      .gaf-icon-btn:hover {
        background: var(--gaf-soft);
      }
      .gaf-btn:focus-visible,
      .gaf-chip:focus-visible,
      .gaf-icon-btn:focus-visible,
      .gaf-search:focus-visible {
        outline: 2px solid color-mix(in oklch, var(--gaf-primary) 72%, transparent);
        outline-offset: 2px;
      }
      .gaf-btn-primary {
        border-color: color-mix(in oklch, var(--gaf-primary) 70%, var(--gaf-border));
        background: var(--gaf-primary);
        color: var(--gaf-primary-fg);
      }
      .gaf-btn-danger {
        color: var(--gaf-danger);
      }
      .gaf-icon-btn {
        display: inline-grid;
        place-items: center;
        width: 30px;
        height: 30px;
        padding: 0;
      }
      .gaf-toolbar {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--gaf-border);
      }
      .gaf-search {
        width: 100%;
        height: 34px;
        border-radius: 8px;
        border: 1px solid var(--gaf-border);
        background: var(--gaf-card);
        color: var(--gaf-fg);
        padding: 0 10px;
        font: 12px/1.2 ui-sans-serif, system-ui, sans-serif;
      }
      .gaf-search::placeholder {
        color: var(--gaf-muted);
      }
      .gaf-filter-panel {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        border: 1px solid var(--gaf-border);
        border-radius: 10px;
        background: color-mix(in oklch, var(--gaf-card) 58%, transparent);
      }
      .gaf-filter-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        min-width: 0;
      }
      .gaf-filter-summary {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .gaf-filter-title {
        color: var(--gaf-fg);
        font-size: 11px;
        line-height: 1.2;
        font-weight: 750;
      }
      .gaf-filter-active {
        color: var(--gaf-muted);
        font-size: 10px;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }
      .gaf-filter-toggle {
        min-height: 28px;
        white-space: nowrap;
      }
      .gaf-filter-fields {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-top: 2px;
        max-height: 280px;
        overflow: hidden;
      }
      .gaf-filter-fields[data-open="false"] {
        max-height: 0;
        padding-top: 0;
      }
      .gaf-filter-row {
        display: grid;
        grid-template-columns: 54px minmax(0, 1fr);
        align-items: start;
        gap: 8px;
      }
      .gaf-filter-label {
        padding-top: 7px;
        color: var(--gaf-muted);
        font-size: 10px;
        line-height: 1;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .gaf-filter-options {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        min-width: 0;
      }
      .gaf-chip {
        min-height: 28px;
        padding: 0 9px;
        border-radius: 999px;
        background: color-mix(in oklch, var(--gaf-card) 82%, transparent);
        color: var(--gaf-fg);
      }
      .gaf-chip.is-active {
        border-color: var(--gaf-active);
        background: var(--gaf-active);
        color: var(--gaf-active-fg);
        box-shadow: none;
      }
      .gaf-stats {
        padding: 0 14px 10px;
        color: var(--gaf-muted);
        font-size: 11px;
        line-height: 1.35;
      }
      .gaf-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 190px;
        min-height: 0;
        flex: 1;
      }
      .gaf-results {
        min-height: 0;
        overflow: auto;
        padding: 12px;
        border-right: 1px solid var(--gaf-border);
      }
      .gaf-results-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .gaf-results-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .gaf-card {
        display: flex;
        min-width: 0;
        gap: 8px;
        border: 1px solid var(--gaf-border);
        border-radius: 10px;
        background: color-mix(in oklch, var(--gaf-card) 88%, transparent);
        padding: 8px;
        cursor: pointer;
        color: var(--gaf-fg);
        text-align: left;
      }
      .gaf-results-grid .gaf-card {
        flex-direction: column;
      }
      .gaf-card.is-selected {
        border-color: var(--gaf-primary);
        box-shadow: 0 0 0 2px color-mix(in oklch, var(--gaf-primary) 25%, transparent);
      }
      .gaf-thumb {
        display: grid;
        place-items: center;
        flex: 0 0 auto;
        width: 58px;
        height: 58px;
        border-radius: 8px;
        background: var(--gaf-soft);
        overflow: hidden;
        color: var(--gaf-muted);
        font-size: 11px;
        font-weight: 700;
      }
      .gaf-results-grid .gaf-thumb {
        width: 100%;
        height: 94px;
      }
      .gaf-thumb img,
      .gaf-thumb video {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .gaf-card-main {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .gaf-card-title {
        display: -webkit-box;
        overflow: hidden;
        overflow-wrap: anywhere;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        font-size: 11px;
        line-height: 1.3;
        font-weight: 700;
      }
      .gaf-card-meta {
        color: var(--gaf-muted);
        font-size: 10px;
        line-height: 1.3;
      }
      .gaf-detail {
        min-width: 0;
        overflow: auto;
        padding: 12px;
        background: color-mix(in oklch, var(--gaf-soft) 32%, transparent);
      }
      .gaf-detail-preview {
        display: grid;
        place-items: center;
        width: 100%;
        min-height: 150px;
        border: 1px solid var(--gaf-border);
        border-radius: 10px;
        background: var(--gaf-card);
        overflow: hidden;
        color: var(--gaf-muted);
        font-size: 12px;
        font-weight: 700;
      }
      .gaf-detail-preview img,
      .gaf-detail-preview video,
      .gaf-detail-preview audio {
        max-width: 100%;
        max-height: 220px;
      }
      .gaf-detail h3 {
        margin: 10px 0 4px;
        font-size: 13px;
        line-height: 1.25;
        color: var(--gaf-fg);
      }
      .gaf-url,
      .gaf-detail p {
        margin: 0;
        color: var(--gaf-muted);
        font-size: 11px;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }
      .gaf-actions {
        margin-top: 10px;
      }
      .gaf-empty {
        padding: 24px 12px;
        color: var(--gaf-muted);
        font-size: 12px;
        text-align: center;
      }
      #${HIGHLIGHT_ID} {
        position: fixed;
        z-index: 2147483644;
        pointer-events: none;
        border: 3px solid var(--gaf-primary, oklch(0.205 0 0));
        border-radius: 8px;
        background: color-mix(in oklch, var(--gaf-primary, oklch(0.205 0 0)) 14%, transparent);
        box-shadow: 0 0 0 9999px oklch(0 0 0 / 0.08);
      }
      @media (prefers-reduced-motion: reduce) {
        #${ROOT_ID}.t-resize,
        #${ROOT_ID} .t-panel-slide,
        #${ROOT_ID} .t-digit {
          animation: none !important;
        }
      }
      @media (max-width: 720px) {
        #${ROOT_ID} {
          top: auto;
          left: 8px;
          right: 8px;
          bottom: 8px;
          width: auto;
          height: min(82vh, 680px);
          min-height: 340px;
        }
        .gaf-body {
          grid-template-columns: 1fr;
        }
        .gaf-results {
          border-right: none;
          border-bottom: 1px solid var(--gaf-border);
        }
        .gaf-detail {
          max-height: 240px;
        }
        .gaf-filter-row {
          grid-template-columns: 1fr;
          gap: 5px;
        }
        .gaf-filter-label {
          padding-top: 0;
        }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function scanAndRender(status) {
    state.assets = scanAssets();
    state.status = status || "";
    applyFilters();
    render();
  }

  function render() {
    if (!state.root) {
      return;
    }

    state.root.className = state.minimized ? "t-resize is-minimized" : "t-resize";
    const selected = getSelectedAsset();
    const typeCounts = countBy(state.assets, "type");
    const extCounts = countBy(state.assets, "extension");
    const stats = {
      filtered: state.filtered.length,
      total: state.assets.length,
      cap: MAX_BACKGROUND_SCAN,
    };
    const animateStats =
      !state.lastStats ||
      state.lastStats.filtered !== stats.filtered ||
      state.lastStats.total !== stats.total ||
      state.lastStats.cap !== stats.cap;
    state.lastStats = stats;

    state.root.innerHTML = `
      <div class="gaf-shell">
        <header class="gaf-header">
          <div>
            <h2 class="gaf-title">Asset Finder</h2>
            <p class="gaf-subtitle">${escapeHtml(document.title || location.hostname)} | ${state.assets.length} asset${state.assets.length === 1 ? "" : "s"}</p>
          </div>
          <div class="gaf-header-actions">
            <button class="gaf-icon-btn" type="button" data-action="minimize" aria-label="${state.minimized ? "Expand" : "Minimize"}">${state.minimized ? "^" : "-"}</button>
            <button class="gaf-icon-btn" type="button" data-action="close" aria-label="Close">x</button>
          </div>
        </header>
        <div class="gaf-toolbar">
          <input class="gaf-search" type="search" value="${escapeAttribute(state.query)}" placeholder="Search URL, type, source..." aria-label="Search assets" />
          <div class="gaf-filter-panel">
            <div class="gaf-filter-head">
              <span class="gaf-filter-summary">
                <span class="gaf-filter-title">Filters</span>
                <span class="gaf-filter-active">${escapeHtml(filterSummary())}</span>
              </span>
              <button class="gaf-btn gaf-filter-toggle" type="button" data-action="toggle-filters" aria-expanded="${state.filtersCollapsed ? "false" : "true"}">
                ${state.filtersCollapsed ? "Expand" : "Collapse"}
              </button>
            </div>
              <div class="gaf-filter-fields t-panel-slide" data-open="${state.filtersCollapsed ? "false" : "true"}">
                <div class="gaf-filter-row">
                  <span class="gaf-filter-label">Type</span>
                  <span class="gaf-filter-options" aria-label="Asset type filters">
                    ${renderChip("type", "all", "All", state.typeFilter === "all")}
                    ${renderChip("type", "image", `Images ${typeCounts.image || 0}`, state.typeFilter === "image")}
                    ${renderChip("type", "svg", `SVG ${typeCounts.svg || 0}`, state.typeFilter === "svg")}
                    ${renderChip("type", "video", `Video ${typeCounts.video || 0}`, state.typeFilter === "video")}
                    ${renderChip("type", "audio", `Audio ${typeCounts.audio || 0}`, state.typeFilter === "audio")}
                    ${renderChip("type", "icon", `Icons ${typeCounts.icon || 0}`, state.typeFilter === "icon")}
                  </span>
                </div>
                <div class="gaf-filter-row">
                  <span class="gaf-filter-label">Format</span>
                  <span class="gaf-filter-options" aria-label="Extension filters">
                    ${renderChip("ext", "all", "Any", state.extFilter === "all")}
                    ${topExtensions(extCounts).map((ext) => renderChip("ext", ext, `${ext} ${extCounts[ext]}`, state.extFilter === ext)).join("")}
                  </span>
                </div>
                <div class="gaf-filter-row">
                  <span class="gaf-filter-label">Size</span>
                  <span class="gaf-filter-options" aria-label="Size and view filters">
                    ${renderChip("size", "all", "Any", state.sizeFilter === "all")}
                    ${renderChip("size", "small", "Small", state.sizeFilter === "small")}
                    ${renderChip("size", "medium", "Medium", state.sizeFilter === "medium")}
                    ${renderChip("size", "large", "Large", state.sizeFilter === "large")}
                  </span>
                </div>
                <div class="gaf-filter-row">
                  <span class="gaf-filter-label">View</span>
                  <span class="gaf-filter-options" aria-label="View filters">
                    ${renderChip("view", "grid", "Grid", state.view === "grid")}
                    ${renderChip("view", "list", "List", state.view === "list")}
                  </span>
                </div>
              </div>
          </div>
        </div>
        <div class="gaf-stats">${escapeHtml(state.status)} Showing ${renderDigits(String(stats.filtered), animateStats)} of ${renderDigits(String(stats.total), animateStats)}. CSS background scan capped at ${renderDigits(String(stats.cap), animateStats)} elements.</div>
        <div class="gaf-body">
          <div class="gaf-results">
            ${renderResults()}
          </div>
          <section class="gaf-detail" aria-label="Asset details">
            ${selected ? renderDetail(selected) : `<div class="gaf-empty">Select an asset to preview, copy, open, highlight, or hide it.</div>`}
          </section>
        </div>
      </div>
    `;

    bindPanelEvents();
  }

  function renderResults() {
    if (state.filtered.length === 0) {
      return `<div class="gaf-empty">No assets match these filters.</div>`;
    }

    return `
      <div class="${state.view === "list" ? "gaf-results-list" : "gaf-results-grid"}" role="listbox" aria-label="Assets">
        ${state.filtered.map(renderAssetCard).join("")}
      </div>
    `;
  }

  function renderAssetCard(asset) {
    const selected = asset.id === state.selectedId;
    return `
      <button class="gaf-card${selected ? " is-selected" : ""}" type="button" data-action="select" data-id="${escapeAttribute(asset.id)}" role="option" aria-selected="${selected}">
        ${renderThumb(asset)}
        <span class="gaf-card-main">
          <span class="gaf-card-title" title="${escapeAttribute(asset.filename || asset.url || asset.extension || asset.type)}">${escapeHtml(displayAssetName(asset))}</span>
          <span class="gaf-card-meta">${escapeHtml(asset.typeLabel)} | ${escapeHtml(asset.extension)}${asset.dimensions ? ` | ${escapeHtml(asset.dimensions)}` : ""}</span>
          <span class="gaf-card-meta">${escapeHtml(asset.sourceLabel)} | ${asset.occurrences.length} occurrence${asset.occurrences.length === 1 ? "" : "s"}</span>
        </span>
      </button>
    `;
  }

  function renderDetail(asset) {
    return `
      <div class="gaf-detail-preview">${renderPreview(asset)}</div>
      <h3>${escapeHtml(asset.filename || asset.typeLabel)}</h3>
      <p>${escapeHtml(asset.typeLabel)} | ${escapeHtml(asset.extension)}${asset.dimensions ? ` | ${escapeHtml(asset.dimensions)}` : ""}</p>
      <p>${escapeHtml(asset.sourceLabel)} | ${asset.occurrences.length} occurrence${asset.occurrences.length === 1 ? "" : "s"}</p>
      <p class="gaf-url">${escapeHtml(asset.url)}</p>
      <div class="gaf-actions">
        <button class="gaf-btn gaf-btn-primary" type="button" data-action="copy">Copy URL</button>
        <button class="gaf-btn" type="button" data-action="open">Open</button>
        <button class="gaf-btn" type="button" data-action="download">Download</button>
        <button class="gaf-btn" type="button" data-action="highlight">Highlight</button>
        <button class="gaf-btn gaf-btn-danger" type="button" data-action="hide">Hide element</button>
      </div>
    `;
  }

  function renderThumb(asset) {
    if (asset.previewable) {
      return `<span class="gaf-thumb"><img src="${escapeAttribute(asset.url)}" alt="" loading="lazy" referrerpolicy="no-referrer" /></span>`;
    }
    if (asset.type === "video") {
      return `<span class="gaf-thumb">VIDEO</span>`;
    }
    if (asset.type === "audio") {
      return `<span class="gaf-thumb">AUDIO</span>`;
    }
    return `<span class="gaf-thumb">${escapeHtml(asset.extension.toUpperCase())}</span>`;
  }

  function renderPreview(asset) {
    if (asset.previewable) {
      return `<img src="${escapeAttribute(asset.url)}" alt="" referrerpolicy="no-referrer" />`;
    }
    if (asset.type === "video") {
      return `<video src="${escapeAttribute(asset.url)}" controls></video>`;
    }
    if (asset.type === "audio") {
      return `<audio src="${escapeAttribute(asset.url)}" controls></audio>`;
    }
    return escapeHtml(asset.extension.toUpperCase());
  }

  function renderChip(group, value, label, active) {
    return `<button class="gaf-chip${active ? " is-active" : ""}" type="button" data-chip="${escapeAttribute(group)}" data-value="${escapeAttribute(value)}">${escapeHtml(label)}</button>`;
  }

  function renderDigits(value, animate) {
    const chars = String(value).split("");
    return `<span class="t-digit-group${animate ? " is-animating" : ""}">${chars
      .map((char, index) => {
        const stagger =
          index === chars.length - 2 ? ` data-stagger="1"` : index === chars.length - 1 ? ` data-stagger="2"` : "";
        return `<span class="t-digit"${stagger}>${escapeHtml(char)}</span>`;
      })
      .join("")}</span>`;
  }

  function bindPanelEvents() {
    const root = state.root;
    if (!root) {
      return;
    }

    const search = root.querySelector(".gaf-search");
    search?.addEventListener("input", (event) => {
      state.query = event.target.value || "";
      applyFilters();
      render();
      state.root?.querySelector(".gaf-search")?.focus();
    });

    root.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        handleAction(button.getAttribute("data-action"), button.getAttribute("data-id"));
      });
    });

    root.querySelectorAll("[data-chip]").forEach((button) => {
      button.addEventListener("click", () => {
        const group = button.getAttribute("data-chip");
        const value = button.getAttribute("data-value") || "all";
        if (group === "type") state.typeFilter = value;
        if (group === "ext") state.extFilter = value;
        if (group === "size") state.sizeFilter = value;
        if (group === "view") state.view = value === "list" ? "list" : "grid";
        applyFilters();
        render();
      });
    });
  }

  function handleAction(action, id) {
    if (action === "close") {
      closePanel();
      return;
    }
    if (action === "minimize") {
      state.minimized = !state.minimized;
      render();
      return;
    }
    if (action === "toggle-filters") {
      state.filtersCollapsed = !state.filtersCollapsed;
      render();
      return;
    }
    if (action === "select" && id) {
      state.selectedId = id;
      render();
      return;
    }

    const selected = getSelectedAsset();
    if (!selected) {
      return;
    }

    if (action === "copy") {
      copyText(selected.url);
      state.status = "Copied asset URL.";
      render();
      return;
    }
    if (action === "open") {
      window.open(selected.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (action === "download") {
      const anchor = document.createElement("a");
      anchor.href = selected.url;
      anchor.download = selected.filename || "asset";
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
      return;
    }
    if (action === "highlight") {
      highlightAsset(selected);
      return;
    }
    if (action === "hide") {
      hideAssetElement(selected);
    }
  }

  function closePanel() {
    state.open = false;
    state.root?.remove();
    state.root = null;
    clearHighlight();
  }

  function onPanelKeydown(event) {
    if (event.key === "Escape") {
      closePanel();
      return;
    }
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Enter"].includes(event.key)) {
      return;
    }
    if (event.target?.classList?.contains("gaf-search")) {
      return;
    }

    const index = state.filtered.findIndex((asset) => asset.id === state.selectedId);
    if (event.key === "Enter") {
      const selected = getSelectedAsset();
      if (selected) highlightAsset(selected);
      return;
    }
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = Math.min(Math.max(index + direction, 0), state.filtered.length - 1);
    if (state.filtered[nextIndex]) {
      event.preventDefault();
      state.selectedId = state.filtered[nextIndex].id;
      render();
    }
  }

  function applyFilters() {
    const q = state.query.trim().toLowerCase();
    state.filtered = state.assets.filter((asset) => {
      if (state.hideBlankAssets && isBlankAsset(asset)) return false;
      if (state.typeFilter !== "all" && asset.type !== state.typeFilter) return false;
      if (state.extFilter !== "all" && asset.extension !== state.extFilter) return false;
      if (state.sizeFilter !== "all" && sizeBucket(asset) !== state.sizeFilter) return false;
      if (!q) return true;
      return [
        asset.url,
        asset.filename,
        asset.extension,
        asset.type,
        asset.typeLabel,
        asset.sourceLabel,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });

    if (!state.filtered.some((asset) => asset.id === state.selectedId)) {
      state.selectedId = state.filtered[0]?.id || null;
    }
  }

  function filterSummary() {
    const parts = [];
    parts.push(state.typeFilter === "all" ? "All types" : labelForType(state.typeFilter));
    parts.push(state.extFilter === "all" ? "Any format" : state.extFilter.toUpperCase());
    parts.push(state.sizeFilter === "all" ? "Any size" : `${capitalize(state.sizeFilter)} size`);
    parts.push(state.view === "grid" ? "Grid view" : "List view");
    return parts.join(" / ");
  }

  function displayAssetName(asset) {
    const value = String(asset.filename || asset.extension || asset.type || "asset");
    if (value.length <= 44) {
      return value;
    }

    const dotIndex = value.lastIndexOf(".");
    const extension =
      dotIndex > 0 && value.length - dotIndex <= 8 ? value.slice(dotIndex) : "";
    const base = extension ? value.slice(0, dotIndex) : value;
    const head = base.slice(0, 24);
    const tail = base.slice(-10);
    return `${head}...${tail}${extension}`;
  }

  function scanAssets() {
    const byUrl = new Map();
    const push = (rawUrl, owner, sourceLabel, options = {}) => {
      const absolute = normalizeUrl(rawUrl);
      if (!absolute || byUrl.size >= MAX_ASSETS) {
        return;
      }
      const type = options.type || detectType(absolute, sourceLabel);
      const extension = options.extension || detectExtension(absolute, type);
      const key = absolute;
      const signature = owner instanceof Element ? buildSignature(owner) : null;
      const occurrence = {
        sourceLabel,
        selector: signature?.primarySelector || signature?.selectorPath || "",
        signature,
        width: options.width || readElementWidth(owner),
        height: options.height || readElementHeight(owner),
      };

      if (byUrl.has(key)) {
        byUrl.get(key).occurrences.push(occurrence);
        return;
      }

      const dimensions = formatDimensions(occurrence.width, occurrence.height);
      byUrl.set(key, {
        id: `asset-${byUrl.size + 1}`,
        url: absolute,
        filename: filenameFromUrl(absolute),
        type,
        typeLabel: labelForType(type),
        extension,
        sourceLabel,
        dimensions,
        previewable: ["image", "svg", "icon"].includes(type),
        occurrences: [occurrence],
      });
    };

    document.querySelectorAll("img").forEach((img) => {
      push(img.currentSrc || img.src, img, "img", {
        type: "image",
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
      for (const candidate of parseSrcset(img.getAttribute("srcset"))) {
        push(candidate.url, img, "img srcset", {
          type: "image",
          width: candidate.width || img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });
      }
    });

    document.querySelectorAll("source[srcset]").forEach((source) => {
      for (const candidate of parseSrcset(source.getAttribute("srcset"))) {
        push(candidate.url, source, "picture srcset", { type: "image", width: candidate.width });
      }
    });

    document.querySelectorAll("svg").forEach((svg, index) => {
      if (!isVisible(svg)) return;
      const serialized = serializeInlineSvg(svg);
      if (serialized) {
        push(serialized, svg, "inline svg", {
          type: "svg",
          extension: "svg",
          width: Math.round(svg.getBoundingClientRect().width),
          height: Math.round(svg.getBoundingClientRect().height),
        });
      }
    });

    document.querySelectorAll("video").forEach((video) => {
      push(video.currentSrc || video.src, video, "video", {
        type: "video",
        width: video.videoWidth || video.clientWidth,
        height: video.videoHeight || video.clientHeight,
      });
      push(video.poster, video, "video poster", { type: "image" });
    });
    document.querySelectorAll("video source[src]").forEach((source) => {
      push(source.getAttribute("src"), source, "video source", { type: "video" });
    });
    document.querySelectorAll("audio").forEach((audio) => {
      push(audio.currentSrc || audio.src, audio, "audio", { type: "audio" });
    });
    document.querySelectorAll("audio source[src]").forEach((source) => {
      push(source.getAttribute("src"), source, "audio source", { type: "audio" });
    });

    document.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon'], link[rel='mask-icon']").forEach((link) => {
      push(link.href, link, "page icon", { type: "icon" });
    });

    let scanned = 0;
    for (const element of document.querySelectorAll("body *")) {
      if (scanned >= MAX_BACKGROUND_SCAN) break;
      scanned += 1;
      if (!isVisible(element) || isGraftElement(element)) continue;
      for (const url of extractCssUrls(getComputedStyle(element).backgroundImage)) {
        push(url, element, "background image", { type: "image" });
      }
    }

    return [...byUrl.values()].sort((a, b) => scoreAsset(b) - scoreAsset(a));
  }

  function highlightAsset(asset) {
    const occurrence = firstLiveOccurrence(asset);
    const element = occurrence?.element;
    if (!element) {
      state.status = "Could not find that asset on the page anymore.";
      render();
      return;
    }
    element.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    window.setTimeout(() => {
      const rect = element.getBoundingClientRect();
      drawHighlight(rect);
    }, 260);
    state.status = "Highlighted asset on the page.";
    render();
  }

  function hideAssetElement(asset) {
    const occurrence = firstLiveOccurrence(asset);
    const element = occurrence?.element;
    const signature = occurrence?.signature;
    if (!element || !signature) {
      state.status = "Could not find a hideable element for this asset.";
      render();
      return;
    }

    chrome.storage.local.get({ [REMOVALS_KEY]: {} }, (stored) => {
      const domain = normalizeDomain();
      const map = normalizeRemovalMap(stored[REMOVALS_KEY]);
      const existing = Array.isArray(map[domain]) ? map[domain] : [];
      if (!existing.some((entry) => signaturesMatch(entry, signature))) {
        map[domain] = [
          ...existing,
          {
            ...signature,
            removedAt: new Date().toISOString(),
          },
        ];
      }
      chrome.storage.local.set({ [REMOVALS_KEY]: map }, () => {
        element.style.setProperty("display", "none", "important");
        scanAndRender("Hidden asset element. Review it in Edited list.");
      });
    });
  }

  function firstLiveOccurrence(asset) {
    for (const occurrence of asset.occurrences) {
      const element = occurrence.signature ? findFirstMatchElement(occurrence.signature) : null;
      if (element) {
        return { ...occurrence, element };
      }
    }
    return null;
  }

  function drawHighlight(rect) {
    clearHighlight();
    const node = document.createElement("div");
    node.id = HIGHLIGHT_ID;
    node.style.left = `${Math.max(4, rect.left - 4)}px`;
    node.style.top = `${Math.max(4, rect.top - 4)}px`;
    node.style.width = `${Math.max(1, rect.width + 8)}px`;
    node.style.height = `${Math.max(1, rect.height + 8)}px`;
    document.documentElement.appendChild(node);
    state.highlight = node;
    window.setTimeout(clearHighlight, 2200);
  }

  function clearHighlight() {
    state.highlight?.remove();
    state.highlight = null;
  }

  function getSelectedAsset() {
    return state.assets.find((asset) => asset.id === state.selectedId) || null;
  }

  function normalizeUrl(rawUrl) {
    const value = String(rawUrl || "").trim();
    if (!value || value === "none" || value.startsWith("blob:")) {
      return "";
    }
    if (value.startsWith("data:image/svg+xml")) {
      return value;
    }
    try {
      return new URL(value, location.href).href;
    } catch {
      return "";
    }
  }

  function parseSrcset(value) {
    return String(value || "")
      .split(/,\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const pieces = part.split(/\s+/);
        const descriptor = pieces[1] || "";
        const width = descriptor.endsWith("w") ? Number.parseInt(descriptor, 10) : 0;
        return { url: pieces[0], width: Number.isFinite(width) ? width : 0 };
      });
  }

  function extractCssUrls(value) {
    const urls = [];
    const source = String(value || "");
    const re = /url\((?:"([^"]+)"|'([^']+)'|([^)]*))\)/g;
    let match;
    while ((match = re.exec(source))) {
      urls.push((match[1] || match[2] || match[3] || "").trim());
    }
    return urls;
  }

  function detectType(url, sourceLabel) {
    const extension = detectExtension(url, "asset");
    if (sourceLabel.includes("icon") || ["ico"].includes(extension)) return "icon";
    if (extension === "svg") return "svg";
    if (["mp4", "webm", "mov", "m4v", "ogg"].includes(extension)) return "video";
    if (["mp3", "wav", "m4a", "aac", "flac"].includes(extension)) return "audio";
    return "image";
  }

  function detectExtension(url, fallbackType) {
    if (url.startsWith("data:image/svg+xml")) return "svg";
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
      if (match) return match[1] === "jpeg" ? "jpg" : match[1];
    } catch {
      // Ignore invalid URL fallback.
    }
    return fallbackType === "svg" ? "svg" : "asset";
  }

  function labelForType(type) {
    return {
      image: "Image",
      svg: "SVG",
      video: "Video",
      audio: "Audio",
      icon: "Icon",
    }[type] || "Asset";
  }

  function capitalize(value) {
    const text = String(value || "");
    return text ? `${text.slice(0, 1).toUpperCase()}${text.slice(1)}` : "";
  }

  function filenameFromUrl(url) {
    if (url.startsWith("data:image/svg+xml")) return "inline.svg";
    try {
      const pathname = new URL(url).pathname;
      const name = decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
      return name || new URL(url).hostname;
    } catch {
      return "";
    }
  }

  function formatDimensions(width, height) {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    return w > 0 && h > 0 ? `${Math.round(w)}x${Math.round(h)}` : "";
  }

  function isBlankAsset(asset) {
    if (!["image", "svg", "icon"].includes(asset.type)) {
      return false;
    }

    if (isInlineSvgSpriteReference(asset.url)) {
      return true;
    }

    const occurrences = Array.isArray(asset.occurrences) ? asset.occurrences : [];
    if (occurrences.length === 0) {
      return true;
    }

    const measuredOccurrences = occurrences.filter((occurrence) => {
      const width = Number(occurrence.width) || 0;
      const height = Number(occurrence.height) || 0;
      return width > 0 || height > 0;
    });
    const visibleOccurrences = measuredOccurrences.filter((occurrence) => {
      const width = Number(occurrence.width) || 0;
      const height = Number(occurrence.height) || 0;
      return width > 1 && height > 1;
    });

    if (visibleOccurrences.length > 0) {
      return false;
    }
    if (measuredOccurrences.length > 0) {
      return true;
    }

    const filename = String(asset.filename || "");
    const hasUsefulName =
      filename &&
      filename !== "asset" &&
      filename !== "inline.svg" &&
      filename !== location.hostname;

    return !hasUsefulName || asset.extension === "asset";
  }

  function isInlineSvgSpriteReference(url) {
    if (!String(url || "").startsWith("data:image/svg+xml")) {
      return false;
    }

    let decoded = "";
    try {
      decoded = decodeURIComponent(String(url).split(",").slice(1).join(","));
    } catch {
      decoded = String(url);
    }

    return /<use\b/i.test(decoded) && /\bhref=|xlink:href=/i.test(decoded);
  }

  function readElementWidth(element) {
    return element instanceof Element ? Math.round(element.getBoundingClientRect().width) : 0;
  }

  function readElementHeight(element) {
    return element instanceof Element ? Math.round(element.getBoundingClientRect().height) : 0;
  }

  function sizeBucket(asset) {
    const occurrence = asset.occurrences.find((item) => item.width || item.height);
    const area = (occurrence?.width || 0) * (occurrence?.height || 0);
    if (area >= 240000) return "large";
    if (area >= 32000) return "medium";
    return "small";
  }

  function scoreAsset(asset) {
    const occurrence = asset.occurrences[0] || {};
    return (occurrence.width || 0) * (occurrence.height || 0) + asset.occurrences.length * 1000;
  }

  function countBy(items, key) {
    return items.reduce((acc, item) => {
      const value = item[key] || "asset";
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  function topExtensions(counts) {
    return Object.entries(counts)
      .filter(([ext]) => ext && ext !== "asset")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([ext]) => ext);
  }

  function isVisible(element) {
    if (!(element instanceof Element) || isGraftElement(element)) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      return false;
    }
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
  }

  function isGraftElement(element) {
    return Boolean(element.closest?.(`#${ROOT_ID}, #${HIGHLIGHT_ID}, #btm-element-selector-control, #btm-element-selector-overlay-root`));
  }

  function serializeInlineSvg(svg) {
    try {
      const clone = svg.cloneNode(true);
      const serialized = new XMLSerializer().serializeToString(clone);
      if (serialized.length > 180000) return "";
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
    } catch {
      return "";
    }
  }

  function buildSignature(node) {
    const tagName = node.tagName.toLowerCase();
    return {
      tagName,
      id: node.id || "",
      classes: Array.from(node.classList || []).slice(0, 8),
      selectorPath: selectorPath(node),
      primarySelector: selectorForNode(node, true),
      sourceUrl: location.href || "",
    };
  }

  function selectorForNode(node, preferId) {
    const tagName = node.tagName.toLowerCase();
    if (preferId && node.id) {
      return `${tagName}#${cssEscape(node.id)}`;
    }
    const stableAttrs = ["data-testid", "data-test", "data-qa", "aria-label", "role", "alt", "title"];
    for (const attr of stableAttrs) {
      const value = node.getAttribute(attr);
      if (value && value.length < 80) {
        return `${tagName}[${attr}="${cssEscape(value)}"]`;
      }
    }
    const classes = Array.from(node.classList || [])
      .filter((name) => /^[a-zA-Z_-][\w-]*$/.test(name) && !/\d{5,}/.test(name))
      .slice(0, 3);
    if (classes.length > 0) {
      return `${tagName}.${classes.map(cssEscape).join(".")}`;
    }
    return tagName;
  }

  function selectorPath(node) {
    const parts = [];
    let current = node;
    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
      const tag = current.tagName.toLowerCase();
      if (current.id) {
        parts.unshift(`${tag}#${cssEscape(current.id)}`);
        break;
      }
      let nth = 1;
      let sibling = current;
      while ((sibling = sibling.previousElementSibling)) {
        if (sibling.tagName === current.tagName) nth += 1;
      }
      parts.unshift(`${tag}:nth-of-type(${nth})`);
      current = current.parentElement;
    }
    return parts.join(" > ");
  }

  function collectCandidates(signature) {
    const candidates = [];
    const push = (value) => {
      const trimmed = String(value || "").trim();
      if (trimmed && !candidates.includes(trimmed)) candidates.push(trimmed);
    };
    push(signature.primarySelector);
    push(signature.selectorPath);
    if (signature.tagName && signature.id) {
      push(`${signature.tagName}#${cssEscape(signature.id)}`);
    }
    return candidates;
  }

  function findFirstMatchElement(signature) {
    for (const candidate of collectCandidates(signature)) {
      try {
        const element = document.querySelector(candidate);
        if (element && !isGraftElement(element)) return element;
      } catch {
        // Ignore unsupported selectors.
      }
    }
    return null;
  }

  function normalizeRemovalMap(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
  }

  function signaturesMatch(left, right) {
    if (left.primarySelector && right.primarySelector) return left.primarySelector === right.primarySelector;
    if (left.selectorPath && right.selectorPath) return left.selectorPath === right.selectorPath;
    return left.tagName === right.tagName && left.id === right.id;
  }

  function normalizeDomain() {
    return location.hostname.replace(/^www\./, "").toLowerCase();
  }

  function cssEscape(value) {
    if (window.CSS?.escape) {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/["\\#.:,[\]>+~*'=]/g, "\\$&");
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      return;
    }
    fallbackCopy(text);
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function stopPageEvent(event) {
    event.stopPropagation();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }
})();
