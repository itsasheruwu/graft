import { useCallback, useEffect, useState } from "react";

export const DEFAULT_GRAFT_AI_REWRITER_SETTINGS = {
  graftAiRewriterEnabled: true,
};

export const DEFAULT_GRAFT_AI_HELPER_SETTINGS = {
  graftAiHelperPort: 27491,
  graftAiHelperToken: "",
};

type Status = { message: string; isError?: boolean } | null;

export function useGraftAiRewriterSettings(config: {
  variant: "popup" | "options";
}) {
  const [enabled, setEnabledState] = useState(true);
  const [helperPort, setHelperPort] = useState(27491);
  const [helperToken, setHelperToken] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const isOptions = config.variant === "options";

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_GRAFT_AI_REWRITER_SETTINGS, (stored) => {
      setEnabledState(stored.graftAiRewriterEnabled !== false);
    });
    chrome.storage.local.get(DEFAULT_GRAFT_AI_HELPER_SETTINGS, (stored) => {
      setHelperPort(Number(stored.graftAiHelperPort) || 27491);
      setHelperToken(String(stored.graftAiHelperToken || ""));
    });
  }, []);

  const setEnabled = useCallback(
    (next: boolean) => {
      chrome.storage.sync.set({ graftAiRewriterEnabled: next }, () => {
        if (chrome.runtime.lastError) {
          setStatus({
            message: isOptions ? "Failed to save AI Rewriter." : "Could not save.",
            isError: true,
          });
          return;
        }
        setEnabledState(next);
        setStatus({ message: isOptions ? "AI Rewriter saved." : "Saved." });
        window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
      });
    },
    [isOptions]
  );

  const saveHelper = useCallback(
    (next: { port: number; token: string }) => {
      const port =
        Number.isInteger(next.port) && next.port >= 1024 && next.port <= 65535
          ? next.port
          : 27491;
      const token = next.token.trim();
      chrome.storage.local.set(
        {
          graftAiHelperPort: port,
          graftAiHelperToken: token,
        },
        () => {
          if (chrome.runtime.lastError) {
            setStatus({
              message: isOptions
                ? "Failed to save helper settings."
                : "Could not save helper.",
              isError: true,
            });
            return;
          }
          setHelperPort(port);
          setHelperToken(token);
          setStatus({ message: isOptions ? "Helper settings saved." : "Saved." });
          window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
        }
      );
    },
    [isOptions]
  );

  const openOnCurrentPage = useCallback((prompt?: string) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) {
        setStatus({ message: "No active tab found.", isError: true });
        return;
      }
      chrome.tabs.sendMessage(
        tab.id,
        { type: "graft-ai-rewriter:open", prompt: prompt || "" },
        () => {
          if (chrome.runtime.lastError) {
            setStatus({
              message: "Reload this page, then open AI Rewriter again.",
              isError: true,
            });
            return;
          }
          setStatus({ message: "Opened on current page." });
          window.setTimeout(() => setStatus(null), 900);
        }
      );
    });
  }, []);

  return {
    enabled,
    helperPort,
    helperToken,
    status,
    setEnabled,
    saveHelper,
    openOnCurrentPage,
  };
}
