(function () {
  "use strict";

  const MESSAGE_SOURCE = "graft-theme-sync";
  const MESSAGE_TYPE = "BROWSER_TWEAKS_THEME";

  const DEFAULT_SETTINGS = {
    themeSyncerEnabled: true,
    themeSyncerYoutubeEnabled: true,
    themeSyncerBlockedDomains: []
  };

  function buildPayload(settings, isDark) {
    return {
      type: MESSAGE_TYPE,
      source: MESSAGE_SOURCE,
      settings,
      isDark
    };
  }

  function broadcast() {
    if (!chrome.storage?.sync) {
      window.postMessage(
        buildPayload({ ...DEFAULT_SETTINGS }, window.matchMedia("(prefers-color-scheme: dark)").matches),
        "*"
      );
      return;
    }

    chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
      const settings = { ...DEFAULT_SETTINGS, ...stored };
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      window.postMessage(buildPayload(settings, isDark), "*");
    });
  }

  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  if (mql.addEventListener) {
    mql.addEventListener("change", broadcast);
  } else if (mql.addListener) {
    mql.addListener(broadcast);
  }

  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") {
        return;
      }
      if (
        !("themeSyncerEnabled" in changes) &&
        !("themeSyncerYoutubeEnabled" in changes) &&
        !("themeSyncerBlockedDomains" in changes)
      ) {
        return;
      }
      broadcast();
    });
  }

  broadcast();
})();
