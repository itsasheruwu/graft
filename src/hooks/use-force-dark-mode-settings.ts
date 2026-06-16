import {
  isHostnameBlocked,
  normalizeDomainKey,
  normalizeDomainList,
} from "@/lib/tweak-controls";
import { useCallback, useEffect, useState } from "react";

export const DEFAULT_FORCE_DARK_MODE_SETTINGS = {
  forceDarkModeEnabled: false,
  forceDarkModeBlockedDomains: [] as string[],
};

export type ForceDarkModeSettings = {
  forceDarkModeEnabled: boolean;
  forceDarkModeBlockedDomains: string[];
};

type Status = { message: string; isError?: boolean } | null;

export function useForceDarkModeSettings(config: {
  variant: "popup" | "options";
}) {
  const [forceDarkModeEnabled, setForceDarkModeEnabled] = useState(false);
  const [forceDarkModeBlockedDomains, setForceDarkModeBlockedDomains] =
    useState<string[]>([]);
  const [blocklistInput, setBlocklistInput] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [currentHostname, setCurrentHostname] = useState("");
  const isOptions = config.variant === "options";

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_FORCE_DARK_MODE_SETTINGS, (stored) => {
      const settings = {
        ...DEFAULT_FORCE_DARK_MODE_SETTINGS,
        ...stored,
      };

      setForceDarkModeEnabled(Boolean(settings.forceDarkModeEnabled));
      setForceDarkModeBlockedDomains(
        normalizeDomainList(settings.forceDarkModeBlockedDomains)
      );

      if (isOptions) {
        setStatus({ message: "Settings loaded." });
        window.setTimeout(() => setStatus(null), 1000);
      }
    });

    chrome.tabs?.query?.({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url;
      if (!url) {
        return;
      }
      try {
        setCurrentHostname(normalizeDomainKey(new URL(url).hostname));
      } catch (_error) {
        setCurrentHostname("");
      }
    });
  }, [isOptions]);

  const save = useCallback(
    (next: ForceDarkModeSettings) => {
      const payload = {
        forceDarkModeEnabled: next.forceDarkModeEnabled,
        forceDarkModeBlockedDomains: normalizeDomainList(
          next.forceDarkModeBlockedDomains
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

        setForceDarkModeEnabled(payload.forceDarkModeEnabled);
        setForceDarkModeBlockedDomains(payload.forceDarkModeBlockedDomains);
        setStatus({ message: isOptions ? "Settings saved." : "Saved." });
        window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
      });
    },
    [isOptions]
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      save({
        forceDarkModeEnabled: enabled,
        forceDarkModeBlockedDomains,
      });
    },
    [forceDarkModeBlockedDomains, save]
  );

  const addBlockedDomain = useCallback(() => {
    const domain = normalizeDomainKey(blocklistInput.trim());
    if (!domain || forceDarkModeBlockedDomains.includes(domain)) {
      return;
    }

    setBlocklistInput("");
    save({
      forceDarkModeEnabled,
      forceDarkModeBlockedDomains: [...forceDarkModeBlockedDomains, domain],
    });
  }, [
    blocklistInput,
    forceDarkModeBlockedDomains,
    forceDarkModeEnabled,
    save,
  ]);

  const removeBlockedDomain = useCallback(
    (domain: string) => {
      save({
        forceDarkModeEnabled,
        forceDarkModeBlockedDomains: forceDarkModeBlockedDomains.filter(
          (entry) => entry !== domain
        ),
      });
    },
    [forceDarkModeBlockedDomains, forceDarkModeEnabled, save]
  );

  return {
    forceDarkModeEnabled,
    forceDarkModeBlockedDomains,
    blocklistInput,
    setBlocklistInput,
    currentHostname,
    currentSiteBlocked: isHostnameBlocked(
      currentHostname,
      forceDarkModeBlockedDomains
    ),
    status,
    setEnabled,
    addBlockedDomain,
    removeBlockedDomain,
  };
}
