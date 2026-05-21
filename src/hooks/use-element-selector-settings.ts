import { useCallback, useEffect, useState } from "react";

export const DEFAULT_ELEMENT_SELECTOR_SETTINGS = {
  elementSelectorEnabled: false,
} as const;

export type ElementSelectorSettings = {
  elementSelectorEnabled: boolean;
};

type Status = { message: string; isError?: boolean } | null;

export function useElementSelectorSettings(config: {
  variant: "popup" | "options";
}) {
  const [elementSelectorEnabled, setElementSelectorEnabled] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const isOptions = config.variant === "options";

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_ELEMENT_SELECTOR_SETTINGS, (stored) => {
      const settings = {
        ...DEFAULT_ELEMENT_SELECTOR_SETTINGS,
        ...stored,
      };

      setElementSelectorEnabled(Boolean(settings.elementSelectorEnabled));

      if (isOptions) {
        setStatus({ message: "Settings loaded." });
        window.setTimeout(() => setStatus(null), 1000);
      }
    });
  }, [isOptions]);

  const save = useCallback(
    (next: ElementSelectorSettings) => {
      chrome.storage.sync.set(
        {
          elementSelectorEnabled: next.elementSelectorEnabled,
        },
        () => {
          if (chrome.runtime.lastError) {
            setStatus({
              message: isOptions
                ? "Failed to save settings."
                : "Could not save.",
              isError: true,
            });
            return;
          }

          setElementSelectorEnabled(next.elementSelectorEnabled);

          setStatus({
            message: isOptions ? "Settings saved." : "Saved.",
          });
          window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
        }
      );
    },
    [isOptions]
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      save({
        elementSelectorEnabled: enabled,
      });
    },
    [save]
  );

  return {
    elementSelectorEnabled,
    status,
    setEnabled,
  };
}
