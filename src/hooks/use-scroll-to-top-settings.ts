import {
  isHostnameBlocked,
  normalizeDomainKey,
  normalizeDomainList,
} from "@/lib/tweak-controls";
import { useCallback, useEffect, useState } from "react";

export const DEFAULT_SCROLL_TO_TOP_SETTINGS = {
  scrollToTopEnabled: false,
  scrollToTopBlockedDomains: [] as string[],
};

export type ScrollToTopSettings = {
  scrollToTopEnabled: boolean;
  scrollToTopBlockedDomains: string[];
};

type Status = { message: string; isError?: boolean } | null;

export function useScrollToTopSettings(config: {
  variant: "popup" | "options";
}) {
  const [scrollToTopEnabled, setScrollToTopEnabled] = useState(false);
  const [scrollToTopBlockedDomains, setScrollToTopBlockedDomains] = useState<
    string[]
  >([]);
  const [blocklistInput, setBlocklistInput] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [currentHostname, setCurrentHostname] = useState("");
  const isOptions = config.variant === "options";

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_SCROLL_TO_TOP_SETTINGS, (stored) => {
      const settings = {
        ...DEFAULT_SCROLL_TO_TOP_SETTINGS,
        ...stored,
      };

      setScrollToTopEnabled(Boolean(settings.scrollToTopEnabled));
      setScrollToTopBlockedDomains(
        normalizeDomainList(settings.scrollToTopBlockedDomains)
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
    (next: ScrollToTopSettings) => {
      const payload = {
        scrollToTopEnabled: next.scrollToTopEnabled,
        scrollToTopBlockedDomains: normalizeDomainList(
          next.scrollToTopBlockedDomains
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

        setScrollToTopEnabled(payload.scrollToTopEnabled);
        setScrollToTopBlockedDomains(payload.scrollToTopBlockedDomains);
        setStatus({ message: isOptions ? "Settings saved." : "Saved." });
        window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
      });
    },
    [isOptions]
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      save({
        scrollToTopEnabled: enabled,
        scrollToTopBlockedDomains,
      });
    },
    [scrollToTopBlockedDomains, save]
  );

  const addBlockedDomain = useCallback(() => {
    const domain = normalizeDomainKey(blocklistInput.trim());
    if (!domain || scrollToTopBlockedDomains.includes(domain)) {
      return;
    }

    setBlocklistInput("");
    save({
      scrollToTopEnabled,
      scrollToTopBlockedDomains: [...scrollToTopBlockedDomains, domain],
    });
  }, [
    blocklistInput,
    scrollToTopBlockedDomains,
    scrollToTopEnabled,
    save,
  ]);

  const removeBlockedDomain = useCallback(
    (domain: string) => {
      save({
        scrollToTopEnabled,
        scrollToTopBlockedDomains: scrollToTopBlockedDomains.filter(
          (entry) => entry !== domain
        ),
      });
    },
    [scrollToTopBlockedDomains, scrollToTopEnabled, save]
  );

  return {
    scrollToTopEnabled,
    scrollToTopBlockedDomains,
    blocklistInput,
    setBlocklistInput,
    currentHostname,
    currentSiteBlocked: isHostnameBlocked(
      currentHostname,
      scrollToTopBlockedDomains
    ),
    status,
    setEnabled,
    addBlockedDomain,
    removeBlockedDomain,
  };
}
