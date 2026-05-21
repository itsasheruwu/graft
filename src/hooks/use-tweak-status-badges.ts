import { useEffect, useState } from "react";

export type TweakBadgeState = {
  themeSyncer: boolean;
  youtubeAutoTranslate: boolean;
  elementSelector: boolean;
};

const SYNC_KEYS = {
  themeSyncerEnabled: true,
  youtubeAutoTranslateEnabled: true,
  elementSelectorEnabled: false,
} as const;

export function useTweakStatusBadges() {
  const [badges, setBadges] = useState<TweakBadgeState>({
    themeSyncer: true,
    youtubeAutoTranslate: true,
    elementSelector: false,
  });

  useEffect(() => {
    const load = () => {
      chrome.storage.sync.get(SYNC_KEYS, (stored) => {
        setBadges({
          themeSyncer: Boolean(stored.themeSyncerEnabled),
          youtubeAutoTranslate: Boolean(stored.youtubeAutoTranslateEnabled),
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
        youtubeAutoTranslate:
          "youtubeAutoTranslateEnabled" in changes
            ? Boolean(changes.youtubeAutoTranslateEnabled.newValue)
            : prev.youtubeAutoTranslate,
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
