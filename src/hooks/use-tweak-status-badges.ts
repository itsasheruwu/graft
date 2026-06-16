import { useEffect, useState } from "react";

export type TweakBadgeState = {
  themeSyncer: boolean;
  forceDarkMode: boolean;
  soundBooster: boolean;
  youtubeAutoTranslate: boolean;
  graftAiRewriter: boolean;
  assetFinder: boolean;
  elementSelector: boolean;
};

const SYNC_KEYS = {
  themeSyncerEnabled: true,
  forceDarkModeEnabled: false,
  soundBoosterEnabled: false,
  youtubeAutoTranslateEnabled: true,
  graftAiRewriterEnabled: true,
  assetFinderEnabled: true,
  elementSelectorEnabled: false,
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
      }));
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  return badges;
}
