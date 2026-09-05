import { useEffect, useState } from "react";

export type TweakBadgeState = {
  themeSyncer: boolean;
  forceDarkMode: boolean;
  soundBooster: boolean;
  youtubeAutoTranslate: boolean;
  graftAiRewriter: boolean;
  assetFinder: boolean;
  elementSelector: boolean;
  scrollToTop: boolean;
  wikipediaEnhancements: boolean;
  xQuietFeed: boolean;
  robloxPlayerWatcher: boolean;
};

const SYNC_KEYS = {
  themeSyncerEnabled: true,
  forceDarkModeEnabled: false,
  soundBoosterEnabled: false,
  youtubeAutoTranslateEnabled: true,
  graftAiRewriterEnabled: true,
  assetFinderEnabled: true,
  elementSelectorEnabled: false,
  scrollToTopEnabled: false,
  wikipediaEnhancementsEnabled: false,
  xQuietFeedEnabled: false,
  robloxPlayerWatcherEnabled: false,
} as const;

export function useTweakStatusBadges() {
  const [badges, setBadges] = useState<TweakBadgeState>({
    themeSyncer: true,
    forceDarkMode: false,
    soundBooster: false,
    youtubeAutoTranslate: true,
    graftAiRewriter: true,
    assetFinder: true,
    elementSelector: false,
    scrollToTop: false,
    wikipediaEnhancements: false,
    xQuietFeed: false,
    robloxPlayerWatcher: false,
  });

  useEffect(() => {
    const load = () => {
      chrome.storage.sync.get(SYNC_KEYS, (stored) => {
        setBadges({
          themeSyncer: Boolean(stored.themeSyncerEnabled),
          forceDarkMode: Boolean(stored.forceDarkModeEnabled),
          soundBooster: Boolean(stored.soundBoosterEnabled),
          youtubeAutoTranslate: Boolean(stored.youtubeAutoTranslateEnabled),
          graftAiRewriter: Boolean(stored.graftAiRewriterEnabled),
          assetFinder: Boolean(stored.assetFinderEnabled),
          elementSelector: Boolean(stored.elementSelectorEnabled),
          scrollToTop: Boolean(stored.scrollToTopEnabled),
          wikipediaEnhancements: Boolean(stored.wikipediaEnhancementsEnabled),
          xQuietFeed: Boolean(stored.xQuietFeedEnabled),
          robloxPlayerWatcher: Boolean(stored.robloxPlayerWatcherEnabled),
        });
      });
    };

    load();
    const onChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area
    ) => {
      if (area !== "sync") {
        return;
      }
      setBadges((prev) => ({
        themeSyncer:
          "themeSyncerEnabled" in changes
            ? Boolean(changes.themeSyncerEnabled.newValue)
            : prev.themeSyncer,
        forceDarkMode:
          "forceDarkModeEnabled" in changes
            ? Boolean(changes.forceDarkModeEnabled.newValue)
            : prev.forceDarkMode,
        soundBooster:
          "soundBoosterEnabled" in changes
            ? Boolean(changes.soundBoosterEnabled.newValue)
            : prev.soundBooster,
        youtubeAutoTranslate:
          "youtubeAutoTranslateEnabled" in changes
            ? Boolean(changes.youtubeAutoTranslateEnabled.newValue)
            : prev.youtubeAutoTranslate,
        graftAiRewriter:
          "graftAiRewriterEnabled" in changes
            ? Boolean(changes.graftAiRewriterEnabled.newValue)
            : prev.graftAiRewriter,
        assetFinder:
          "assetFinderEnabled" in changes
            ? Boolean(changes.assetFinderEnabled.newValue)
            : prev.assetFinder,
        elementSelector:
          "elementSelectorEnabled" in changes
            ? Boolean(changes.elementSelectorEnabled.newValue)
            : prev.elementSelector,
        scrollToTop:
          "scrollToTopEnabled" in changes
            ? Boolean(changes.scrollToTopEnabled.newValue)
            : prev.scrollToTop,
        wikipediaEnhancements:
          "wikipediaEnhancementsEnabled" in changes
            ? Boolean(changes.wikipediaEnhancementsEnabled.newValue)
            : prev.wikipediaEnhancements,
        xQuietFeed:
          "xQuietFeedEnabled" in changes
            ? Boolean(changes.xQuietFeedEnabled.newValue)
            : prev.xQuietFeed,
        robloxPlayerWatcher:
          "robloxPlayerWatcherEnabled" in changes
            ? Boolean(changes.robloxPlayerWatcherEnabled.newValue)
            : prev.robloxPlayerWatcher,
      }));
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  return badges;
}
