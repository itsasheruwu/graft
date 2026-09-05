import { DEFAULT_X_QUIET_FEED_SETTINGS } from "@/lib/x-quiet-feed";
import { useCallback, useEffect, useState } from "react";

type Status = { message: string; isError?: boolean } | null;

export function useXQuietFeedSettings(config: { variant: "popup" | "options" }) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const isOptions = config.variant === "options";

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_X_QUIET_FEED_SETTINGS, (stored) => {
      if (chrome.runtime.lastError) {
        setStatus({ message: isOptions ? "Failed to load settings." : "Could not load.", isError: true });
        return;
      }
      setEnabled(Boolean(stored.xQuietFeedEnabled));
    });
  }, [isOptions]);

  const setMasterEnabled = useCallback(
    (value: boolean) => {
      chrome.storage.sync.set({ xQuietFeedEnabled: value }, () => {
        if (chrome.runtime.lastError) {
          setStatus({ message: isOptions ? "Failed to save settings." : "Could not save.", isError: true });
          return;
        }
        setEnabled(value);
        setStatus({ message: isOptions ? "Settings saved." : "Saved." });
        window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
      });
    },
    [isOptions]
  );

  return { xQuietFeedEnabled: enabled, setMasterEnabled, status };
}
