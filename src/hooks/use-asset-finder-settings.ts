import { useCallback, useEffect, useState } from "react";

export const DEFAULT_ASSET_FINDER_SETTINGS = {
  assetFinderEnabled: true,
  assetFinderHideBlankAssets: false,
} as const;

export type AssetFinderSettings = {
  assetFinderEnabled: boolean;
  assetFinderHideBlankAssets: boolean;
};

type Status = { message: string; isError?: boolean } | null;

export function useAssetFinderSettings(config: {
  variant: "popup" | "options";
}) {
  const [assetFinderEnabled, setAssetFinderEnabled] = useState(true);
  const [assetFinderHideBlankAssets, setAssetFinderHideBlankAssets] =
    useState(false);
  const [status, setStatus] = useState<Status>(null);
  const isOptions = config.variant === "options";

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_ASSET_FINDER_SETTINGS, (stored) => {
      const settings = {
        ...DEFAULT_ASSET_FINDER_SETTINGS,
        ...stored,
      };

      setAssetFinderEnabled(Boolean(settings.assetFinderEnabled));
      setAssetFinderHideBlankAssets(Boolean(settings.assetFinderHideBlankAssets));

      if (isOptions) {
        setStatus({ message: "Settings loaded." });
        window.setTimeout(() => setStatus(null), 1000);
      }
    });
  }, [isOptions]);

  const save = useCallback(
    (next: AssetFinderSettings) => {
      chrome.storage.sync.set(
        {
          assetFinderEnabled: next.assetFinderEnabled,
          assetFinderHideBlankAssets: next.assetFinderHideBlankAssets,
        },
        () => {
          if (chrome.runtime.lastError) {
            setStatus({
              message: isOptions ? "Failed to save settings." : "Could not save.",
              isError: true,
            });
            return;
          }

          setAssetFinderEnabled(next.assetFinderEnabled);
          setAssetFinderHideBlankAssets(next.assetFinderHideBlankAssets);
          setStatus({ message: isOptions ? "Settings saved." : "Saved." });
          window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
        }
      );
    },
    [isOptions]
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      save({ assetFinderEnabled: enabled, assetFinderHideBlankAssets });
    },
    [assetFinderHideBlankAssets, save]
  );

  const setHideBlankAssets = useCallback(
    (hideBlankAssets: boolean) => {
      save({
        assetFinderEnabled,
        assetFinderHideBlankAssets: hideBlankAssets,
      });
    },
    [assetFinderEnabled, save]
  );

  const openAssetBrowser = useCallback(() => {
    if (!assetFinderEnabled) {
      setStatus({ message: "Enable Asset Finder first.", isError: true });
      window.setTimeout(() => setStatus(null), 1200);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId == null) {
        setStatus({ message: "No active tab found.", isError: true });
        return;
      }

      chrome.tabs.sendMessage(tabId, { type: "asset-finder:open" }, (response) => {
        if (chrome.runtime.lastError || response?.ok === false) {
          setStatus({
            message:
              response?.error ||
              chrome.runtime.lastError?.message ||
              "Asset Finder is not available on this page.",
            isError: true,
          });
          window.setTimeout(() => setStatus(null), 2200);
          return;
        }

        setStatus({ message: "Opened asset browser." });
        window.setTimeout(() => setStatus(null), 1200);
      });
    });
  }, [assetFinderEnabled]);

  return {
    assetFinderEnabled,
    assetFinderHideBlankAssets,
    status,
    setEnabled,
    setHideBlankAssets,
    openAssetBrowser,
  };
}
