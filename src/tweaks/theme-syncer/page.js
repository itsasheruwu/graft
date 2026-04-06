(function () {
  "use strict";

  const MESSAGE_SOURCE = "browser-tweaks-theme-sync";
  const MESSAGE_TYPE = "BROWSER_TWEAKS_THEME";

  const DEFAULT_SETTINGS = {
    themeSyncerEnabled: true,
    themeSyncerYoutubeEnabled: true
  };

  const YOUTUBE_THEME_ATTRIBUTES = [
    "dark",
    "darker-dark-theme",
    "darker-dark-theme-deprecate"
  ];
  const YOUTUBE_THEME_BURST_DELAYS_MS = [0, 16, 48, 96, 180, 260, 420, 640];
  const YOUTUBE_SEARCH_BTN_IDS = [
    "search-icon-legacy",
    "search-button",
    "search-button-narrow"
  ];

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    lastIsDark: null
  };

  let youtubeNavigationBound = false;
  let youtubeThemeObserver = null;
  let youtubeThemeSyncQueued = false;

  function setThemeAttribute(element, attribute, enabled) {
    if (!element) {
      return;
    }

    if (enabled) {
      element.setAttribute(attribute, "");
      return;
    }

    element.removeAttribute(attribute);
  }

  function setYouTubeThemeAttributes(element, isDark) {
    for (const attribute of YOUTUBE_THEME_ATTRIBUTES) {
      setThemeAttribute(element, attribute, isDark);
    }
  }

  function normalizeHost(hostname) {
    return hostname.replace(/^www\./, "").toLowerCase();
  }

  function isYouTubeHost() {
    const host = normalizeHost(location.hostname);
    return host === "youtube.com" || host.endsWith(".youtube.com");
  }

  function syncMetaTheme(isDark) {
    const content = isDark ? "#212121" : "#ffffff";
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    for (const meta of metas) {
      meta.setAttribute("content", content);
    }
  }

  function syncGenericTheme(isDark) {
    const root = document.documentElement;

    if (!root) {
      return;
    }

    root.style.colorScheme = isDark ? "dark" : "light";
    if (document.body) {
      document.body.style.colorScheme = isDark ? "dark" : "light";
    }

    syncMetaTheme(isDark);
  }

  function clearGenericTheme() {
    const root = document.documentElement;
    if (!root) {
      return;
    }

    root.style.colorScheme = "";
    if (document.body) {
      document.body.style.colorScheme = "";
    }
  }

  function clearYouTubeSearchButtonInlineStyles(element) {
    if (!element || !element.dataset.btmSearchBtnPatched) {
      return;
    }

    element.style.removeProperty("background");
    element.style.removeProperty("background-color");
    element.style.removeProperty("color");
    element.style.removeProperty("fill");
    delete element.dataset.btmSearchBtnPatched;
  }

  function patchElementForDarkSearchControl(element, isDark) {
    if (!element) {
      return;
    }

    if (!isDark) {
      clearYouTubeSearchButtonInlineStyles(element);
      return;
    }

    element.dataset.btmSearchBtnPatched = "1";
    const bg = "var(--yt-spec-10-percent-layer, rgba(255, 255, 255, 0.12))";
    const fg = "var(--yt-spec-text-primary, #f1f1f1)";
    element.style.setProperty("background-color", bg, "important");
    element.style.setProperty("color", fg, "important");
  }

  function patchShadowSearchControls(shadowRoot, isDark, depth) {
    if (!shadowRoot || depth > 3) {
      return;
    }

    for (const id of YOUTUBE_SEARCH_BTN_IDS) {
      const byId = shadowRoot.getElementById(id) ||
        shadowRoot.querySelector(`[id="${id}"]`);
      if (byId) {
        patchElementForDarkSearchControl(byId, isDark);
      }
    }

    shadowRoot.querySelectorAll("yt-icon-button").forEach((host) => {
      const hid = host.id || "";
      if (!hid.includes("search") && host.getAttribute("aria-label") !== "Search") {
        return;
      }

      patchElementForDarkSearchControl(host, isDark);
      if (host.shadowRoot) {
        const innerSel = hid.includes("search") || host.getAttribute("aria-label") === "Search"
          ? "button, a.yt-simple-endpoint, .yt-spec-button-shape-next"
          : "button, a.yt-simple-endpoint";
        host.shadowRoot.querySelectorAll(innerSel).forEach((inner) => {
          patchElementForDarkSearchControl(inner, isDark);
        });
      }
    });

    shadowRoot.querySelectorAll("button").forEach((btn) => {
      const al = (btn.getAttribute("aria-label") || "").toLowerCase();
      if (!al.includes("search")) {
        return;
      }
      patchElementForDarkSearchControl(btn, isDark);
    });
  }

  function patchYouTubeSearchChrome(isDark) {
    if (!isYouTubeHost()) {
      return;
    }

    document.querySelectorAll("ytd-searchbox").forEach((box) => {
      patchShadowSearchControls(box.shadowRoot, isDark, 0);
    });
  }

  function clearAllYouTubeSearchPatches() {
    if (!isYouTubeHost()) {
      return;
    }

    document.querySelectorAll("ytd-searchbox").forEach((box) => {
      const walk = (sr, depth) => {
        if (!sr || depth > 3) {
          return;
        }
        sr.querySelectorAll("[data-btm-search-btn-patched]").forEach((el) => {
          clearYouTubeSearchButtonInlineStyles(el);
        });
        sr.querySelectorAll("yt-icon-button").forEach((host) => {
          if (host.shadowRoot) {
            walk(host.shadowRoot, depth + 1);
          }
        });
      };

      walk(box.shadowRoot, 0);
    });
  }

  function clearYouTubeThemeState() {
    if (!isYouTubeHost()) {
      return;
    }

    clearAllYouTubeSearchPatches();

    const root = document.documentElement;
    const app = document.querySelector("ytd-app");

    if (!root) {
      return;
    }

    setYouTubeThemeAttributes(root, false);
    if (app) {
      setYouTubeThemeAttributes(app, false);
    }

    if (root.dataset) {
      delete root.dataset.btmTheme;
    }
    if (app && app.dataset) {
      delete app.dataset.btmTheme;
    }
  }

  function syncYouTubeTheme(isDark) {
    const root = document.documentElement;
    const app = document.querySelector("ytd-app");

    if (!root) {
      return;
    }

    root.dataset.btmTheme = isDark ? "dark" : "light";
    setYouTubeThemeAttributes(root, isDark);
    if (app) {
      setYouTubeThemeAttributes(app, isDark);
      app.dataset.btmTheme = isDark ? "dark" : "light";
    }

    patchYouTubeSearchChrome(isDark);
  }

  function syncYouTubeThemeBurst(isDark) {
    for (const delay of YOUTUBE_THEME_BURST_DELAYS_MS) {
      window.setTimeout(() => {
        if (!state.settings.themeSyncerEnabled) {
          return;
        }

        if (!state.settings.themeSyncerYoutubeEnabled) {
          clearYouTubeThemeState();
          return;
        }

        syncYouTubeTheme(isDark);
      }, delay);
    }
  }

  function queueYouTubeThemeSync() {
    if (!isYouTubeHost()) {
      return;
    }

    if (youtubeThemeSyncQueued) {
      return;
    }

    youtubeThemeSyncQueued = true;
    requestAnimationFrame(() => {
      youtubeThemeSyncQueued = false;
      if (!state.settings.themeSyncerEnabled || !state.settings.themeSyncerYoutubeEnabled) {
        clearYouTubeThemeState();
        return;
      }

      const isDark =
        typeof state.lastIsDark === "boolean"
          ? state.lastIsDark
          : window.matchMedia("(prefers-color-scheme: dark)").matches;
      syncYouTubeTheme(isDark);
    });
  }

  function onYouTubeNavigate() {
    if (!state.settings.themeSyncerEnabled || !state.settings.themeSyncerYoutubeEnabled) {
      clearYouTubeThemeState();
      return;
    }

    const isDark =
      typeof state.lastIsDark === "boolean"
        ? state.lastIsDark
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
    syncYouTubeTheme(isDark);
    syncYouTubeThemeBurst(isDark);
  }

  function ensureYouTubeListeners() {
    if (youtubeNavigationBound) {
      return;
    }

    const root = document.documentElement;
    document.addEventListener("yt-navigate-finish", onYouTubeNavigate);
    document.addEventListener("yt-page-data-updated", onYouTubeNavigate);

    if (!youtubeThemeObserver && root) {
      youtubeThemeObserver = new MutationObserver(() => queueYouTubeThemeSync());
      youtubeThemeObserver.observe(root, {
        attributes: true,
        attributeFilter: [
          "class",
          "style",
          ...YOUTUBE_THEME_ATTRIBUTES
        ]
      });
    }

    youtubeNavigationBound = true;
  }

  function applyTheme(isDark) {
    state.lastIsDark = isDark;

    if (!state.settings.themeSyncerEnabled) {
      clearGenericTheme();
      if (isYouTubeHost()) {
        clearYouTubeThemeState();
      }
      return;
    }

    syncGenericTheme(isDark);

    if (isYouTubeHost() && state.settings.themeSyncerYoutubeEnabled) {
      syncYouTubeTheme(isDark);
      syncYouTubeThemeBurst(isDark);
      ensureYouTubeListeners();
      return;
    }

    if (isYouTubeHost()) {
      clearYouTubeThemeState();
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== MESSAGE_SOURCE || data.type !== MESSAGE_TYPE) {
      return;
    }

    state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    applyTheme(Boolean(data.isDark));
  });
})();
