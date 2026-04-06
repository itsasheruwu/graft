/**
 * Registry of shipped tweaks.
 * Keep each new tweak here first, then wire it into:
 * - manifest.json content_scripts (or runtime message/event-driven path)
 * - any dedicated page script under src/tweaks/<tweak-id>/
 *
 * Pair isolated bridge scripts (chrome.storage, matchMedia) with MAIN-world
 * page scripts for DOM owned by the host app. MAIN-world scripts cannot use
 * `chrome.*` APIs beyond a tiny subset; keep extension I/O in isolated files.
 */
const TWEAK_REGISTRY = Object.freeze({
  tweaks: [
    {
      id: "theme-syncer",
      name: "Theme Syncer",
      description:
        "Listen to prefers-color-scheme changes and immediately mirror theme state.",
      entrypoints: [
        {
          id: "theme-syncer-page",
          path: "src/tweaks/theme-syncer/page.js",
          world: "MAIN",
          runAt: "document_start"
        },
        {
          id: "theme-syncer-bridge",
          path: "src/tweaks/theme-syncer/bridge.js",
          world: "ISOLATED",
          runAt: "document_start"
        }
      ],
      hostTargets: [
        "www.youtube.com",
        "youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "*.youtube.com"
      ],
      optionsKeyPrefix: "themeSyncer",
      ui: {
        popupSection: "Theme Syncer",
        settingsKeys: [
          "themeSyncerEnabled",
          "themeSyncerYoutubeEnabled"
        ]
      }
    }
  ]
});

if (typeof window !== "undefined") {
  window.__BROWSER_TWEAKS_REGISTRY__ = TWEAK_REGISTRY;
}
