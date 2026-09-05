import {
  DEFAULT_WIKIPEDIA_ENHANCEMENTS_SETTINGS,
  normalizeWikipediaReadingWidthPreset,
  type WikipediaReadingWidthPreset,
} from "@/lib/wikipedia-enhancements";
import { useCallback, useEffect, useState } from "react";

export type WikipediaEnhancementsSettings = {
  wikipediaEnhancementsEnabled: boolean;
  wikipediaReadingWidthEnabled: boolean;
  wikipediaReadingWidthPreset: WikipediaReadingWidthPreset;
  wikipediaNavigationCleanupEnabled: boolean;
  wikipediaCollapseReferencesEnabled: boolean;
  wikipediaFloatingTocEnabled: boolean;
  wikipediaSearchHighlightEnabled: boolean;
  wikipediaHideDonationBannersEnabled: boolean;
};

type Status = { message: string; isError?: boolean } | null;

export function useWikipediaEnhancementsSettings(config: {
  variant: "popup" | "options";
}) {
  const [settings, setSettings] = useState<WikipediaEnhancementsSettings>(
    DEFAULT_WIKIPEDIA_ENHANCEMENTS_SETTINGS
  );
  const [status, setStatus] = useState<Status>(null);
  const isOptions = config.variant === "options";

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_WIKIPEDIA_ENHANCEMENTS_SETTINGS, (stored) => {
      if (chrome.runtime.lastError) {
        setStatus({
          message: isOptions ? "Failed to load settings." : "Could not load.",
          isError: true,
        });
        return;
      }

      setSettings({
        wikipediaEnhancementsEnabled: Boolean(
          stored.wikipediaEnhancementsEnabled
        ),
        wikipediaReadingWidthEnabled: Boolean(stored.wikipediaReadingWidthEnabled),
        wikipediaReadingWidthPreset: normalizeWikipediaReadingWidthPreset(
          stored.wikipediaReadingWidthPreset
        ),
        wikipediaNavigationCleanupEnabled: Boolean(
          stored.wikipediaNavigationCleanupEnabled
        ),
        wikipediaCollapseReferencesEnabled: Boolean(
          stored.wikipediaCollapseReferencesEnabled
        ),
        wikipediaFloatingTocEnabled: Boolean(stored.wikipediaFloatingTocEnabled),
        wikipediaSearchHighlightEnabled: Boolean(
          stored.wikipediaSearchHighlightEnabled
        ),
        wikipediaHideDonationBannersEnabled: Boolean(
          stored.wikipediaHideDonationBannersEnabled
        ),
      });

      if (isOptions) {
        setStatus({ message: "Settings loaded." });
        window.setTimeout(() => setStatus(null), 1000);
      }
    });
  }, [isOptions]);

  const save = useCallback(
    (next: WikipediaEnhancementsSettings) => {
      const payload = {
        ...next,
        wikipediaReadingWidthPreset: normalizeWikipediaReadingWidthPreset(
          next.wikipediaReadingWidthPreset
        ),
      };

      chrome.storage.sync.set(payload, () => {
        if (chrome.runtime.lastError) {
          setStatus({
            message: isOptions ? "Failed to save settings." : "Could not save.",
            isError: true,
          });
          return;
        }

        setSettings(payload);
        setStatus({ message: isOptions ? "Settings saved." : "Saved." });
        window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
      });
    },
    [isOptions]
  );

  const update = useCallback(
    <K extends keyof WikipediaEnhancementsSettings>(
      key: K,
      value: WikipediaEnhancementsSettings[K]
    ) => {
      save({ ...settings, [key]: value });
    },
    [save, settings]
  );

  return {
    ...settings,
    status,
    setMasterEnabled: (value: boolean) =>
      update("wikipediaEnhancementsEnabled", value),
    setReadingWidthEnabled: (value: boolean) =>
      update("wikipediaReadingWidthEnabled", value),
    setReadingWidthPreset: (value: WikipediaReadingWidthPreset) =>
      update("wikipediaReadingWidthPreset", value),
    setNavigationCleanupEnabled: (value: boolean) =>
      update("wikipediaNavigationCleanupEnabled", value),
    setCollapseReferencesEnabled: (value: boolean) =>
      update("wikipediaCollapseReferencesEnabled", value),
    setFloatingTocEnabled: (value: boolean) =>
      update("wikipediaFloatingTocEnabled", value),
    setSearchHighlightEnabled: (value: boolean) =>
      update("wikipediaSearchHighlightEnabled", value),
    setHideDonationBannersEnabled: (value: boolean) =>
      update("wikipediaHideDonationBannersEnabled", value),
  };
}
