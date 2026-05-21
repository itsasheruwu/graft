import { normalizeDomainKey } from "@/lib/element-selector-hidden";
import { useCallback, useEffect, useState } from "react";

export const DEFAULT_THEME_SYNCER_SETTINGS = {
  themeSyncerEnabled: true,
  themeSyncerYoutubeEnabled: true,
  themeSyncerBlockedDomains: [] as string[],
};

export type ThemeSyncerSettings = {
  themeSyncerEnabled: boolean;
  themeSyncerYoutubeEnabled: boolean;
  themeSyncerBlockedDomains: string[];
};

type Status = { message: string; isError?: boolean } | null;

export function useThemeSyncerSettings(config: { variant: "popup" | "options" }) {
  const [themeSyncerEnabled, setThemeSyncerEnabled] = useState(true);
  const [themeSyncerYoutubeEnabled, setThemeSyncerYoutubeEnabled] =
    useState(true);
  const [themeSyncerBlockedDomains, setThemeSyncerBlockedDomains] = useState<
    string[]
  >([]);
  const [blocklistInput, setBlocklistInput] = useState("");
  const [status, setStatus] = useState<Status>(null);

  const isOptions = config.variant === "options";

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_THEME_SYNCER_SETTINGS, (stored) => {
      const settings = { ...DEFAULT_THEME_SYNCER_SETTINGS, ...stored };
      setThemeSyncerEnabled(settings.themeSyncerEnabled);
      setThemeSyncerYoutubeEnabled(settings.themeSyncerYoutubeEnabled);
      setThemeSyncerBlockedDomains(
        Array.isArray(settings.themeSyncerBlockedDomains)
          ? settings.themeSyncerBlockedDomains.map((d) => normalizeDomainKey(String(d)))
          : []
      );
      if (isOptions) {
        setStatus({ message: "Settings loaded." });
        window.setTimeout(() => setStatus(null), 1000);
      }
    });
  }, [isOptions]);

  const save = useCallback(
    (next: ThemeSyncerSettings) => {
      const payload = {
        themeSyncerEnabled: next.themeSyncerEnabled,
        themeSyncerYoutubeEnabled:
          next.themeSyncerYoutubeEnabled && next.themeSyncerEnabled,
        themeSyncerBlockedDomains: next.themeSyncerBlockedDomains,
      };

      chrome.storage.sync.set(payload, () => {
        if (chrome.runtime.lastError) {
          setStatus({
            message: isOptions ? "Failed to save settings." : "Could not save.",
            isError: true,
          });
          return;
        }

        setThemeSyncerEnabled(payload.themeSyncerEnabled);
        setThemeSyncerYoutubeEnabled(payload.themeSyncerYoutubeEnabled);
        setThemeSyncerBlockedDomains(payload.themeSyncerBlockedDomains);

        setStatus({
          message: isOptions ? "Settings saved." : "Saved.",
        });
        window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
      });
    },
    [isOptions]
  );

  const setMasterEnabled = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        save({
          themeSyncerEnabled: false,
          themeSyncerYoutubeEnabled: false,
          themeSyncerBlockedDomains,
        });
        return;
      }
      save({
        themeSyncerEnabled: true,
        themeSyncerYoutubeEnabled,
        themeSyncerBlockedDomains,
      });
    },
    [save, themeSyncerBlockedDomains, themeSyncerYoutubeEnabled]
  );

  const setYoutubeEnabled = useCallback(
    (enabled: boolean) => {
      save({
        themeSyncerEnabled,
        themeSyncerYoutubeEnabled: enabled,
        themeSyncerBlockedDomains,
      });
    },
    [save, themeSyncerBlockedDomains, themeSyncerEnabled]
  );

  const addBlockedDomain = useCallback(() => {
    const domain = normalizeDomainKey(blocklistInput.trim());
    if (!domain || themeSyncerBlockedDomains.includes(domain)) {
      return;
    }
    setBlocklistInput("");
    save({
      themeSyncerEnabled,
      themeSyncerYoutubeEnabled,
      themeSyncerBlockedDomains: [...themeSyncerBlockedDomains, domain],
    });
  }, [
    blocklistInput,
    save,
    themeSyncerBlockedDomains,
    themeSyncerEnabled,
    themeSyncerYoutubeEnabled,
  ]);

  const removeBlockedDomain = useCallback(
    (domain: string) => {
      save({
        themeSyncerEnabled,
        themeSyncerYoutubeEnabled,
        themeSyncerBlockedDomains: themeSyncerBlockedDomains.filter(
          (d) => d !== domain
        ),
      });
    },
    [save, themeSyncerBlockedDomains, themeSyncerEnabled, themeSyncerYoutubeEnabled]
  );

  const youtubeSwitchChecked =
    themeSyncerEnabled && themeSyncerYoutubeEnabled;

  return {
    themeSyncerEnabled,
    themeSyncerYoutubeEnabled,
    themeSyncerBlockedDomains,
    blocklistInput,
    setBlocklistInput,
    youtubeSwitchChecked,
    youtubeDisabled: !themeSyncerEnabled,
    status,
    setMasterEnabled,
    setYoutubeEnabled,
    addBlockedDomain,
    removeBlockedDomain,
  };
}
