(function () {
  "use strict";

  const STYLE_ID = "graft-force-dark-mode-style";
  const DARK_CHECK_DELAYS_MS = [0, 60, 180, 420, 900, 1600, 2600, 4000];
  const DEFAULT_SETTINGS = {
    forceDarkModeEnabled: false,
    forceDarkModeBlockedDomains: []
  };

  let settings = { ...DEFAULT_SETTINGS };
  let applyToken = 0;

  function normalizeDomainKey(value) {
    return String(value || "")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .split(":")[0]
      .toLowerCase();
  }

  function normalizeDomainList(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((entry) => normalizeDomainKey(entry)).filter(Boolean);
  }

  function isBlocked() {
    const host = normalizeDomainKey(location.hostname);
    return normalizeDomainList(settings.forceDarkModeBlockedDomains).some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  }

  function isNativeDarkModeHost() {
    const host = normalizeDomainKey(location.hostname);
    const exactOrSubdomain = [
      "github.com",
      "developer.mozilla.org",
      "wikipedia.org",
      "wikimedia.org",
      "youtube.com",
      "reddit.com",
      "x.com",
      "twitter.com",
      "facebook.com",
      "instagram.com",
      "discord.com",
      "notion.so",
      "figma.com",
      "openai.com",
      "chatgpt.com",
      "stackoverflow.com",
      "stackexchange.com"
    ];

    if (
      host === "google.com" ||
      host.endsWith(".google.com") ||
      /^google\.[a-z.]+$/.test(host) ||
      /\.google\.[a-z.]+$/.test(host)
    ) {
      return true;
    }

    return exactOrSubdomain.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  }

  function isDistroKidHost() {
    const host = normalizeDomainKey(location.hostname);
    return host === "distrokid.com" || host.endsWith(".distrokid.com");
  }

  function parseRgb(value) {
    const match = String(value || "").match(/rgba?\(([^)]+)\)/i);
    if (!match) {
      return null;
    }

    const parts = match[1].split(",").map((part) => Number.parseFloat(part));
    if (parts.length < 3 || parts.some((part, index) => index < 3 && !Number.isFinite(part))) {
      return null;
    }

    if (parts.length >= 4 && Number.isFinite(parts[3]) && parts[3] < 0.2) {
      return null;
    }

    return parts.slice(0, 3);
  }

  function relativeLuminance(rgb) {
    const [r, g, b] = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function elementBackgroundLuminance(element) {
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const color = parseRgb(window.getComputedStyle(current).backgroundColor);
      if (color) {
        return relativeLuminance(color);
      }
      current = current.parentElement;
    }
    return null;
  }

  function pageAlreadyDark() {
    const root = document.documentElement;
    const body = document.body;

    if (!root || !body) {
      return false;
    }

    if (
      root.classList.contains("dark") ||
      body.classList.contains("dark") ||
      root.dataset.theme === "dark" ||
      body.dataset.theme === "dark" ||
      root.getAttribute("data-color-mode") === "dark"
    ) {
      return true;
    }

    const rootScheme = window.getComputedStyle(root).colorScheme;
    const bodyScheme = window.getComputedStyle(body).colorScheme;
    const hasDarkScheme =
      String(rootScheme).includes("dark") || String(bodyScheme).includes("dark");
    const bodyLum = elementBackgroundLuminance(body);
    const rootLum = elementBackgroundLuminance(root);
    const luminance = bodyLum ?? rootLum;

    return hasDarkScheme && typeof luminance === "number" && luminance < 0.22;
  }

  function removeStyle() {
    document.getElementById(STYLE_ID)?.remove();
  }

  function ensureStyle(forceCheck) {
    if (!document.body) {
      removeStyle();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => scheduleApply(), {
          once: true
        });
      }
      return;
    }

    if (
      !settings.forceDarkModeEnabled ||
      isBlocked() ||
      isNativeDarkModeHost() ||
      (!forceCheck && !isDistroKidHost() && pageAlreadyDark())
    ) {
      removeStyle();
      return;
    }

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      style.dataset.graftForceDarkMode = "true";
      (document.head || document.documentElement).appendChild(style);
    }

    style.textContent = `
      :root {
        color-scheme: dark !important;
        background-color: #0f1115 !important;
      }

      :where(html, body):not([data-graft-ui], [data-graft-ui] *) {
        background-color: #0f1115 !important;
      }

      :where(body):not([data-graft-ui], [data-graft-ui] *) {
        color: #e8eaed !important;
      }

      :where(
        main,
        section,
        article,
        aside,
        header,
        footer,
        nav,
        form,
        dialog,
        table,
        td,
        th,
        fieldset,
        details
      ):not(
        [data-graft-ui],
        [data-graft-ui] *,
        [data-graft-force-dark-skip],
        [style*="background-image"],
        [style*="background:"],
        [style*="background-color:"],
        [class*="image"],
        [class*="Image"],
        [class*="media"],
        [class*="Media"],
        [class*="video"],
        [class*="Video"],
        [class*="photo"],
        [class*="Photo"],
        [class*="avatar"],
        [class*="Avatar"],
        [class*="ad-"],
        [id*="ad-"]
      ) {
        background-color: #11151c !important;
        border-color: #3b4352 !important;
      }

      :where(
        p,
        li,
        dt,
        dd,
        label,
        legend,
        strong,
        em,
        b,
        i,
        small,
        h1,
        h2,
        h3,
        h4,
        h5,
        h6
      ):not([data-graft-ui], [data-graft-ui] *) {
        color: inherit !important;
      }

      :where(a):not([data-graft-ui], [data-graft-ui] *) {
        color: #8ab4f8 !important;
      }

      :where(button, input, select, textarea, summary):not([data-graft-ui], [data-graft-ui] *) {
        color: #f1f3f4 !important;
        background-color: #1b2029 !important;
        border-color: #3b4352 !important;
      }

      :where([role="button"], [role="menu"], [role="dialog"], [role="listbox"], [role="combobox"], [role="searchbox"]):not(
        [data-graft-ui],
        [data-graft-ui] *,
        [class*="logo"],
        [class*="Logo"]
      ) {
        color: #f1f3f4 !important;
        background-color: #1b2029 !important;
        border-color: #3b4352 !important;
      }

      :where(input::placeholder, textarea::placeholder) {
        color: #9aa0a6 !important;
      }

      :where(code, pre, kbd, samp):not([data-graft-ui], [data-graft-ui] *) {
        color: #f1f3f4 !important;
        background-color: #191d25 !important;
        border-color: #3b4352 !important;
      }

      :where(hr):not([data-graft-ui], [data-graft-ui] *) {
        border-color: #3b4352 !important;
      }

      :where(img, picture, video, canvas, svg, iframe, embed, object):not([data-graft-ui], [data-graft-ui] *) {
        background-color: transparent !important;
        filter: none !important;
      }

      :where([role="img"], [class*="logo"], [class*="Logo"], [id*="logo"], [id*="Logo"]):not([data-graft-ui], [data-graft-ui] *) {
        filter: none !important;
      }

      ::selection {
        color: #0f1115 !important;
        background: #9adf8f !important;
      }

      *:not([data-graft-ui], [data-graft-ui] *) {
        scrollbar-color: #4b5565 #151922 !important;
      }

      ${isDistroKidHost() ? distrokidDarkCss() : ""}
    `;
  }

  function distrokidDarkCss() {
    return `
      html,
      body {
        background: #0c1118 !important;
        color: #e9edf3 !important;
      }

      body {
        --graft-dk-bg: #0c1118;
        --graft-dk-panel: #121821;
        --graft-dk-panel-2: #17202b;
        --graft-dk-border: #2d3948;
        --graft-dk-muted: #a9b4c2;
        --graft-dk-text: #eef3f8;
        --graft-dk-link: #7db8ff;
        --graft-dk-green: #35c96f;
      }

      .outer2,
      .inner2,
      .navLoggedIn,
      .headerLoggedOutNav,
      .navInner,
      .navInnerInner,
      .nav-wrapper {
        background: #111827 !important;
        color: var(--graft-dk-text) !important;
        border-color: var(--graft-dk-border) !important;
      }

      .nav-menu,
      .nav-menu-body,
      .service-section,
      .service-list,
      .accordion,
      .accordion_content,
      .nav-submenu,
      .crossproduct-menu,
      .dropdown-menu,
      .dropdown,
      .popover,
      .tooltip,
      .modal,
      .modal-dialog,
      .modal-content,
      .modal-body,
      .modal-header,
      .modal-footer {
        background: var(--graft-dk-panel) !important;
        color: var(--graft-dk-text) !important;
        border-color: var(--graft-dk-border) !important;
        box-shadow: 0 18px 52px rgba(0, 0, 0, 0.36) !important;
      }

      .nav-menu-body *,
      .service-section *,
      .service-list *,
      .accordion *,
      .modal-content * {
        color: inherit !important;
      }

      .item_title,
      .nav-menu a,
      .service-section a,
      .service-list a,
      .accordion a,
      a[href]:not([data-graft-ui], [data-graft-ui] *) {
        color: var(--graft-dk-link) !important;
      }

      .nav-link,
      .nav-href,
      .nav-submenu-trigger,
      .caret-down,
      .caret-crossproduct {
        color: rgba(255, 255, 255, 0.9) !important;
        border-color: rgba(255, 255, 255, 0.28) !important;
      }

      .content,
      .container,
      .container-fluid,
      .outer,
      .inner,
      .outer2,
      .inner2,
      .wrap,
      .wrapper,
      .page,
      .main,
      .mainContent,
      .main-content,
      .dashboard,
      .panel,
      .box,
      .card,
      .well,
      .whiteBox,
      .white-box,
      .uploadCard,
      .song,
      .album,
      .release,
      .bank,
      .stats,
      [class*="Content"],
      [class*="content"],
      [class*="Container"],
      [class*="container"],
      [class*="Panel"],
      [class*="panel"],
      [class*="Card"],
      [class*="card"],
      form,
      fieldset,
      table,
      thead,
      tbody,
      tr,
      td,
      th {
        background-color: var(--graft-dk-panel) !important;
        color: var(--graft-dk-text) !important;
        border-color: var(--graft-dk-border) !important;
      }

      tr:nth-child(even),
      .panel-heading,
      .table-striped > tbody > tr:nth-of-type(odd),
      .accordion_item,
      .form-group,
      .input-group,
      .list-group-item {
        background-color: var(--graft-dk-panel-2) !important;
        color: var(--graft-dk-text) !important;
        border-color: var(--graft-dk-border) !important;
      }

      input,
      textarea,
      select,
      .form-control,
      .select2-selection,
      .select2-dropdown,
      .select2-results__option,
      [contenteditable="true"] {
        background: #0f1620 !important;
        color: var(--graft-dk-text) !important;
        border-color: #3a4658 !important;
        box-shadow: none !important;
      }

      input::placeholder,
      textarea::placeholder {
        color: #8d99a8 !important;
      }

      button,
      .btn,
      .button,
      input[type="button"],
      input[type="submit"] {
        border-color: #3a4658 !important;
        color: var(--graft-dk-text) !important;
        background-color: #1b2532 !important;
      }

      .btn-primary,
      .button-primary,
      .btn-success,
      .button-success,
      input[type="submit"] {
        background: linear-gradient(180deg, #38d579, #20ad5d) !important;
        border-color: #2bc06a !important;
        color: #06130b !important;
      }

      .alert,
      .notice,
      .message,
      .callout,
      .help,
      .hint {
        background: #182333 !important;
        color: var(--graft-dk-text) !important;
        border-color: #33445a !important;
      }

      .text-muted,
      .muted,
      small,
      .help-block,
      .description,
      .subtext {
        color: var(--graft-dk-muted) !important;
      }

      img,
      svg,
      video,
      canvas,
      #logo_gremlin,
      [class*="logo"],
      [class*="Logo"] {
        filter: none !important;
        background: transparent !important;
      }

      .osano-cm-window,
      .osano-cm-dialog,
      .osano-cm-info,
      .osano-cm-info-dialog,
      .osano-cm-info-views {
        background: #111827 !important;
        color: var(--graft-dk-text) !important;
        border-color: var(--graft-dk-border) !important;
      }
    `;
  }

  function loadAndApply() {
    if (!chrome.storage?.sync) {
      ensureStyle();
      return;
    }

    chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
      if (chrome.runtime.lastError) {
        return;
      }
      settings = { ...DEFAULT_SETTINGS, ...stored };
      scheduleApply();
    });
  }

  function scheduleApply() {
    const token = ++applyToken;
    removeStyle();

    for (const delay of DARK_CHECK_DELAYS_MS) {
      window.setTimeout(() => {
        if (token !== applyToken) {
          return;
        }
        ensureStyle(false);
      }, delay);
    }
  }

  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") {
        return;
      }
      if (
        !("forceDarkModeEnabled" in changes) &&
        !("forceDarkModeBlockedDomains" in changes)
      ) {
        return;
      }

      loadAndApply();
    });
  }

  loadAndApply();
})();
