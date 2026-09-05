/**
 * Registry of shipped tweaks (single source of truth).
 * Build (`vite.config.ts`) generates manifest `content_scripts` and copies entrypoints from here.
 *
 * Pair isolated bridge scripts (chrome.storage, matchMedia) with MAIN-world
 * page scripts for DOM owned by the host app.
 */
const DEFAULT_EXCLUDE_MATCHES = [
  "*://chrome.google.com/*",
  "*://chromewebstore.google.com/*",
  "*://microsoftedge.microsoft.com/*",
  "*://addons.mozilla.org/*",
  "*://newtab/*",
];

const GLOBAL_MATCH_PATTERNS = ["http://*/*", "https://*/*"];

const YOUTUBE_MATCH_PATTERNS = [
  "https://youtube.com/*",
  "https://www.youtube.com/*",
  "https://m.youtube.com/*",
  "https://music.youtube.com/*",
  "https://*.youtube.com/*",
];

const X_MATCH_PATTERNS = ["https://x.com/*", "https://www.x.com/*"];

const ROBLOX_MATCH_PATTERNS = [
  "https://roblox.com/*",
  "https://www.roblox.com/*",
  "https://*.roblox.com/*",
];

const TWEAK_REGISTRY = Object.freeze({
  defaultExcludeMatches: DEFAULT_EXCLUDE_MATCHES,
  globalMatchPatterns: GLOBAL_MATCH_PATTERNS,
  youtubeMatchPatterns: YOUTUBE_MATCH_PATTERNS,
  storage: Object.freeze({
    syncDefaults: Object.freeze({
      themeSyncerEnabled: true,
      themeSyncerYoutubeEnabled: true,
      themeSyncerBlockedDomains: [],
      forceDarkModeEnabled: false,
      forceDarkModeBlockedDomains: [],
      soundBoosterEnabled: false,
      soundBoosterGain: 1.5,
      soundBoosterBlockedDomains: [],
      youtubeAutoTranslateEnabled: true,
      youtubeAutoTranslateTitlesEnabled: true,
      youtubeAutoTranslateDescriptionsEnabled: true,
      youtubeAutoTranslateDebugEnabled: false,
      youtubeAutoTranslateTargetMode: "auto",
      youtubeAutoTranslateTargetLanguage: "en",
      graftAiRewriterEnabled: true,
      assetFinderEnabled: true,
      elementSelectorEnabled: false,
      scrollToTopEnabled: false,
      scrollToTopBlockedDomains: [],
      wikipediaEnhancementsEnabled: false,
      wikipediaReadingWidthEnabled: false,
      wikipediaReadingWidthPreset: "comfortable",
      wikipediaNavigationCleanupEnabled: false,
      wikipediaCollapseReferencesEnabled: false,
      wikipediaFloatingTocEnabled: false,
      wikipediaSearchHighlightEnabled: false,
      wikipediaHideDonationBannersEnabled: false,
      xQuietFeedEnabled: false,
      robloxPlayerWatcherEnabled: false,
      robloxPlayerWatcherNotifyOnline: true,
      robloxPlayerWatcherNotifyOffline: true,
      robloxPlayerWatcherNotifyJoinGame: true,
      robloxPlayerWatcherShowExactGame: false,
      robloxPlayerWatcherAntiSpamEnabled: true,
      robloxPlayerWatcherWhitelist: [],
    }),
    localDefaults: Object.freeze({
      elementSelectorRemovedElementsByDomain: {},
      robloxPlayerWatcherLastPresenceByUserId: {},
      robloxPlayerWatcherResolvedIdsByEntry: {},
      robloxPlayerWatcherGameNamesByUniverseId: {},
    }),
  }),
  commands: Object.freeze({
    "toggle-element-selector": {
      description: "Toggle Element Selector mode on the active tab",
      suggestedKey: {
        default: "Alt+Shift+E",
        mac: "Alt+Shift+E",
      },
    },
  }),
  tweaks: [
    {
      id: "theme-syncer",
      name: "Theme Syncer",
      description:
        "Listen to prefers-color-scheme changes and immediately mirror theme state.",
      matchPatterns: GLOBAL_MATCH_PATTERNS,
      entrypoints: [
        {
          id: "theme-syncer-bail",
          path: "src/lib/extension-bail.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
        {
          id: "theme-syncer-page",
          path: "src/tweaks/theme-syncer/page.js",
          world: "MAIN",
          runAt: "document_start",
        },
        {
          id: "theme-syncer-bridge",
          path: "src/tweaks/theme-syncer/bridge.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
      ],
      hostTargets: ["*"],
      optionsKeyPrefix: "themeSyncer",
      ui: {
        category: "appearance",
        popupSection: "Theme Syncer",
        settingsKeys: [
          "themeSyncerEnabled",
          "themeSyncerYoutubeEnabled",
          "themeSyncerBlockedDomains",
        ],
      },
    },
    {
      id: "force-dark-mode",
      name: "Force Dark Mode",
      description:
        "Apply a balanced dark palette to sites that do not offer one.",
      matchPatterns: GLOBAL_MATCH_PATTERNS,
      entrypoints: [
        {
          id: "force-dark-mode-bail",
          path: "src/lib/extension-bail.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
        {
          id: "force-dark-mode-content",
          path: "src/tweaks/force-dark-mode/content.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
      ],
      hostTargets: ["*"],
      optionsKeyPrefix: "forceDarkMode",
      ui: {
        category: "appearance",
        popupSection: "Force Dark Mode",
        settingsKeys: [
          "forceDarkModeEnabled",
          "forceDarkModeBlockedDomains",
        ],
      },
    },
    {
      id: "sound-booster",
      name: "Sound Booster",
      description:
        "Boost HTML5 audio and video volume with a global gain control.",
      matchPatterns: GLOBAL_MATCH_PATTERNS,
      entrypoints: [
        {
          id: "sound-booster-bail",
          path: "src/lib/extension-bail.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
        {
          id: "sound-booster-page",
          path: "src/tweaks/sound-booster/page.js",
          world: "MAIN",
          runAt: "document_start",
        },
        {
          id: "sound-booster-bridge",
          path: "src/tweaks/sound-booster/bridge.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
      ],
      hostTargets: ["*"],
      optionsKeyPrefix: "soundBooster",
      ui: {
        category: "media",
        popupSection: "Sound Booster",
        settingsKeys: [
          "soundBoosterEnabled",
          "soundBoosterGain",
          "soundBoosterBlockedDomains",
        ],
      },
    },
    {
      id: "element-selector",
      name: "Element Selector",
      description:
        "Inspect page elements, copy metadata, and hide/remove selected nodes persistently.",
      matchPatterns: GLOBAL_MATCH_PATTERNS,
      entrypoints: [
        {
          id: "element-selector-bail",
          path: "src/lib/extension-bail.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
        {
          id: "element-selector-page",
          path: "src/tweaks/element-selector/page.js",
          world: "MAIN",
          runAt: "document_start",
        },
        {
          id: "element-selector-bridge",
          path: "src/tweaks/element-selector/bridge.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
      ],
      hostTargets: ["*"],
      optionsKeyPrefix: "elementSelector",
      ui: {
        category: "page-tools",
        popupSection: "Element Selector",
        settingsKeys: ["elementSelectorEnabled"],
      },
    },
    {
      id: "scroll-to-top",
      name: "Scroll to Top",
      description:
        "Show a floating button that quickly scrolls long pages back to the top.",
      matchPatterns: GLOBAL_MATCH_PATTERNS,
      entrypoints: [
        {
          id: "scroll-to-top-bail",
          path: "src/lib/extension-bail.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
        {
          id: "scroll-to-top-content",
          path: "src/tweaks/scroll-to-top/content.js",
          world: "ISOLATED",
          runAt: "document_idle",
        },
      ],
      hostTargets: ["*"],
      optionsKeyPrefix: "scrollToTop",
      ui: {
        category: "page-tools",
        popupSection: "Scroll to Top",
        settingsKeys: [
          "scrollToTopEnabled",
          "scrollToTopBlockedDomains",
        ],
      },
    },
    {
      id: "x-quiet-feed",
      name: "X Quiet Feed",
      description:
        "Hide promoted posts and recommendation modules from X without changing your timeline or account controls.",
      matchPatterns: X_MATCH_PATTERNS,
      entrypoints: [
        {
          id: "x-quiet-feed-bail",
          path: "src/lib/extension-bail.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
        {
          id: "x-quiet-feed-content",
          path: "src/tweaks/x-quiet-feed/content.js",
          world: "ISOLATED",
          runAt: "document_idle",
        },
      ],
      hostTargets: ["x.com", "www.x.com"],
      optionsKeyPrefix: "xQuietFeed",
      ui: {
        category: "x",
        popupSection: "X Quiet Feed",
        settingsKeys: ["xQuietFeedEnabled"],
      },
    },
    {
      id: "roblox-player-watcher",
      name: "Roblox Player Watcher",
      description:
        "Notify when whitelisted Roblox players come online, go offline, or join a game.",
      matchPatterns: ROBLOX_MATCH_PATTERNS,
      entrypoints: [],
      hostTargets: ["www.roblox.com", "roblox.com", "*.roblox.com"],
      optionsKeyPrefix: "robloxPlayerWatcher",
      ui: {
        category: "roblox",
        popupSection: "Roblox Player Watcher",
        settingsKeys: [
          "robloxPlayerWatcherEnabled",
          "robloxPlayerWatcherNotifyOnline",
          "robloxPlayerWatcherNotifyOffline",
          "robloxPlayerWatcherNotifyJoinGame",
          "robloxPlayerWatcherShowExactGame",
          "robloxPlayerWatcherAntiSpamEnabled",
          "robloxPlayerWatcherWhitelist",
        ],
      },
    },
    {
      id: "wikipedia-enhancements",
      name: "Wikipedia Enhancements",
      description:
        "Make Wikipedia articles more focused with readable layouts and less navigation clutter.",
      matchPatterns: [
        "https://wikipedia.org/wiki/*",
        "https://*.wikipedia.org/wiki/*",
      ],
      entrypoints: [
        {
          id: "wikipedia-enhancements-bail",
          path: "src/lib/extension-bail.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
        {
          id: "wikipedia-enhancements-content",
          path: "src/tweaks/wikipedia-enhancements/content.js",
          world: "ISOLATED",
          runAt: "document_idle",
        },
      ],
      hostTargets: ["*.wikipedia.org", "wikipedia.org"],
      optionsKeyPrefix: "wikipedia",
      ui: {
        category: "wikipedia",
        popupSection: "Wikipedia Enhancements",
        settingsKeys: [
          "wikipediaEnhancementsEnabled",
          "wikipediaReadingWidthEnabled",
          "wikipediaReadingWidthPreset",
          "wikipediaNavigationCleanupEnabled",
          "wikipediaCollapseReferencesEnabled",
          "wikipediaFloatingTocEnabled",
          "wikipediaSearchHighlightEnabled",
          "wikipediaHideDonationBannersEnabled",
        ],
      },
    },
    {
      id: "graft-ai-rewriter",
      name: "AI Rewriter",
      description:
        "Reshape any website's look, layout, density, and shortcuts from a plain-English prompt.",
      matchPatterns: GLOBAL_MATCH_PATTERNS,
      entrypoints: [
        {
          id: "graft-ai-rewriter-bail",
          path: "src/lib/extension-bail.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
        {
          id: "graft-ai-rewriter-page",
          path: "src/tweaks/graft-ai-rewriter/page.js",
          world: "MAIN",
          runAt: "document_start",
        },
        {
          id: "graft-ai-rewriter-bridge",
          path: "src/tweaks/graft-ai-rewriter/bridge.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
      ],
      hostTargets: ["*"],
      optionsKeyPrefix: "graftAiRewriter",
      ui: {
        category: "customization",
        popupSection: "AI Rewriter",
        settingsKeys: [
          "graftAiRewriterEnabled",
          "graftAiHelperPort",
          "graftAiHelperToken",
        ],
      },
    },
    {
      id: "asset-finder",
      name: "Asset Finder",
      description:
        "Scan the current page for visible media assets and browse them in an in-page panel.",
      matchPatterns: GLOBAL_MATCH_PATTERNS,
      entrypoints: [
        {
          id: "asset-finder-bail",
          path: "src/lib/extension-bail.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
        {
          id: "asset-finder-content",
          path: "src/tweaks/asset-finder/content.js",
          world: "ISOLATED",
          runAt: "document_idle",
        },
      ],
      hostTargets: ["*"],
      optionsKeyPrefix: "assetFinder",
      ui: {
        category: "media",
        popupSection: "Asset Finder",
        settingsKeys: ["assetFinderEnabled", "assetFinderHideBlankAssets"],
      },
    },
    {
      id: "youtube-auto-translate",
      name: "YouTube Auto Translation",
      description:
        "Translate YouTube titles and descriptions from other languages into your browser language.",
      matchPatterns: YOUTUBE_MATCH_PATTERNS,
      entrypoints: [
        {
          id: "youtube-auto-translate-bail",
          path: "src/lib/extension-bail.js",
          world: "ISOLATED",
          runAt: "document_start",
        },
        {
          id: "youtube-auto-translate-content",
          path: "src/tweaks/youtube-auto-translate/content.js",
          world: "ISOLATED",
          runAt: "document_idle",
        },
      ],
      hostTargets: [
        "www.youtube.com",
        "youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "*.youtube.com",
      ],
      optionsKeyPrefix: "youtubeAutoTranslate",
      ui: {
        category: "youtube",
        popupSection: "YouTube Auto Translation",
        settingsKeys: [
          "youtubeAutoTranslateEnabled",
          "youtubeAutoTranslateTitlesEnabled",
          "youtubeAutoTranslateDescriptionsEnabled",
          "youtubeAutoTranslateDebugEnabled",
          "youtubeAutoTranslateTargetMode",
          "youtubeAutoTranslateTargetLanguage",
        ],
      },
    },
  ],
});

if (typeof window !== "undefined") {
  window.__BROWSER_TWEAKS_REGISTRY__ = TWEAK_REGISTRY;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TWEAK_REGISTRY };
}
