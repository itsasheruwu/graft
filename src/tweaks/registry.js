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
    }),
    localDefaults: Object.freeze({
      elementSelectorRemovedElementsByDomain: {},
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
        popupSection: "Element Selector",
        settingsKeys: ["elementSelectorEnabled"],
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
