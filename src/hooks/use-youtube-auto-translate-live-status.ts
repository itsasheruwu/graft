import { isYouTubeUrl } from "@/lib/youtube-host";
import { useEffect, useState } from "react";

export type YoutubeLiveStatus = {
  disabled: boolean;
  scannedCount: number;
  latestAction: string;
  latestReason: string;
  latestKind?: string;
  url?: string;
  updatedAt?: number;
};

export type YoutubeLiveStatusState =
  | { state: "loading" }
  | { state: "not-youtube" }
  | { state: "unavailable"; message: string }
  | { state: "ready"; status: YoutubeLiveStatus };

export function useYoutubeAutoTranslateLiveStatus(enabled: boolean) {
  const [status, setStatus] = useState<YoutubeLiveStatusState>({ state: "loading" });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const refresh = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (cancelled) {
          return;
        }

        if (!tab?.id || !isYouTubeUrl(tab.url)) {
          setStatus({ state: "not-youtube" });
          return;
        }

        chrome.tabs.sendMessage(
          tab.id,
          { type: "youtube-auto-translate:get-status" },
          (response) => {
            if (cancelled) {
              return;
            }

            if (chrome.runtime.lastError || !response?.ok || !response.status) {
              setStatus({
                state: "unavailable",
                message: "No status reported yet.",
              });
              return;
            }

            setStatus({ state: "ready", status: response.status });
          }
        );
      });
    };

    refresh();
    const intervalId = window.setInterval(refresh, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled]);

  return status;
}

export function getYoutubeLiveStatusRows(status: YoutubeLiveStatusState) {
  if (status.state === "loading") {
    return [
      { label: "Disabled", value: "Checking..." },
      { label: "Scanned", value: "..." },
      { label: "Latest", value: "Waiting for content script." },
    ];
  }

  if (status.state === "not-youtube") {
    return [
      { label: "Disabled", value: "N/A" },
      { label: "Scanned", value: "0" },
      { label: "Latest", value: "Active tab is not YouTube." },
    ];
  }

  if (status.state === "unavailable") {
    return [
      { label: "Disabled", value: "Unknown" },
      { label: "Scanned", value: "Unknown" },
      { label: "Latest", value: status.message },
    ];
  }

  const latestPrefix = status.status.latestKind
    ? `${status.status.latestKind}: `
    : "";

  return [
    { label: "Disabled", value: status.status.disabled ? "Yes" : "No" },
    { label: "Scanned", value: String(status.status.scannedCount ?? 0) },
    {
      label: "Latest",
      value: `${latestPrefix}${status.status.latestReason || status.status.latestAction || "No activity yet."}`,
    },
  ];
}
