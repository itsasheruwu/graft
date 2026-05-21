import { useCallback, useEffect, useState } from "react";

export const DEFAULT_YOUTUBE_AUTO_TRANSLATE_SETTINGS = {
  youtubeAutoTranslateEnabled: true,
  youtubeAutoTranslateTitlesEnabled: true,
  youtubeAutoTranslateDescriptionsEnabled: true,
  youtubeAutoTranslateDebugEnabled: false,
  youtubeAutoTranslateTargetMode: "auto" as "auto" | "fixed",
  youtubeAutoTranslateTargetLanguage: "en",
};

export type YoutubeAutoTranslateSettings = {
  youtubeAutoTranslateEnabled: boolean;
  youtubeAutoTranslateTitlesEnabled: boolean;
  youtubeAutoTranslateDescriptionsEnabled: boolean;
  youtubeAutoTranslateDebugEnabled: boolean;
  youtubeAutoTranslateTargetMode: "auto" | "fixed";
  youtubeAutoTranslateTargetLanguage: string;
};

type Status = { message: string; isError?: boolean } | null;

const YOUTUBE_AUTO_TRANSLATE_CACHE_KEY = "youtubeAutoTranslateCache";

export function useYoutubeAutoTranslateSettings(config: {
  variant: "popup" | "options";
}) {
  const [youtubeAutoTranslateEnabled, setYoutubeAutoTranslateEnabled] =
    useState(true);
  const [
    youtubeAutoTranslateTitlesEnabled,
    setYoutubeAutoTranslateTitlesEnabled,
  ] = useState(true);
  const [
    youtubeAutoTranslateDescriptionsEnabled,
    setYoutubeAutoTranslateDescriptionsEnabled,
  ] = useState(true);
  const [
    youtubeAutoTranslateDebugEnabled,
    setYoutubeAutoTranslateDebugEnabled,
  ] = useState(false);
  const [youtubeAutoTranslateTargetMode, setYoutubeAutoTranslateTargetMode] =
    useState<"auto" | "fixed">("auto");
  const [
    youtubeAutoTranslateTargetLanguage,
    setYoutubeAutoTranslateTargetLanguage,
  ] = useState("en");
  const [status, setStatus] = useState<Status>(null);

  const isOptions = config.variant === "options";

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_YOUTUBE_AUTO_TRANSLATE_SETTINGS, (stored) => {
      const settings = {
        ...DEFAULT_YOUTUBE_AUTO_TRANSLATE_SETTINGS,
        ...stored,
      };
      setYoutubeAutoTranslateEnabled(settings.youtubeAutoTranslateEnabled);
      setYoutubeAutoTranslateTitlesEnabled(
        settings.youtubeAutoTranslateTitlesEnabled
      );
      setYoutubeAutoTranslateDescriptionsEnabled(
        settings.youtubeAutoTranslateDescriptionsEnabled
      );
      setYoutubeAutoTranslateDebugEnabled(settings.youtubeAutoTranslateDebugEnabled);
      setYoutubeAutoTranslateTargetMode(
        settings.youtubeAutoTranslateTargetMode === "fixed" ? "fixed" : "auto"
      );
      setYoutubeAutoTranslateTargetLanguage(
        settings.youtubeAutoTranslateTargetLanguage || "en"
      );
      if (isOptions) {
        setStatus({ message: "Settings loaded." });
        window.setTimeout(() => setStatus(null), 1000);
      }
    });
  }, [isOptions]);

  const save = useCallback(
    (next: YoutubeAutoTranslateSettings) => {
      const payload = {
        youtubeAutoTranslateEnabled: next.youtubeAutoTranslateEnabled,
        youtubeAutoTranslateTitlesEnabled:
          next.youtubeAutoTranslateEnabled &&
          next.youtubeAutoTranslateTitlesEnabled,
        youtubeAutoTranslateDescriptionsEnabled:
          next.youtubeAutoTranslateEnabled &&
          next.youtubeAutoTranslateDescriptionsEnabled,
        youtubeAutoTranslateDebugEnabled: next.youtubeAutoTranslateDebugEnabled,
        youtubeAutoTranslateTargetMode: next.youtubeAutoTranslateTargetMode,
        youtubeAutoTranslateTargetLanguage: next.youtubeAutoTranslateTargetLanguage,
      };

      chrome.storage.sync.set(payload, () => {
        if (chrome.runtime.lastError) {
          setStatus({
            message: isOptions ? "Failed to save settings." : "Could not save.",
            isError: true,
          });
          return;
        }

        setYoutubeAutoTranslateEnabled(payload.youtubeAutoTranslateEnabled);
        setYoutubeAutoTranslateTitlesEnabled(
          payload.youtubeAutoTranslateTitlesEnabled
        );
        setYoutubeAutoTranslateDescriptionsEnabled(
          payload.youtubeAutoTranslateDescriptionsEnabled
        );
        setYoutubeAutoTranslateDebugEnabled(payload.youtubeAutoTranslateDebugEnabled);
        setYoutubeAutoTranslateTargetMode(payload.youtubeAutoTranslateTargetMode);
        setYoutubeAutoTranslateTargetLanguage(
          payload.youtubeAutoTranslateTargetLanguage
        );
        setStatus({ message: isOptions ? "Settings saved." : "Saved." });
        window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
      });
    },
    [isOptions]
  );

  const setMasterEnabled = useCallback(
    (enabled: boolean) => {
      save({
        youtubeAutoTranslateEnabled: enabled,
        youtubeAutoTranslateTitlesEnabled: enabled
          ? youtubeAutoTranslateTitlesEnabled
          : false,
        youtubeAutoTranslateDescriptionsEnabled: enabled
          ? youtubeAutoTranslateDescriptionsEnabled
          : false,
        youtubeAutoTranslateDebugEnabled,
        youtubeAutoTranslateTargetMode,
        youtubeAutoTranslateTargetLanguage,
      });
    },
    [
      save,
      youtubeAutoTranslateDescriptionsEnabled,
      youtubeAutoTranslateDebugEnabled,
      youtubeAutoTranslateTargetLanguage,
      youtubeAutoTranslateTargetMode,
      youtubeAutoTranslateTitlesEnabled,
    ]
  );

  const setTitlesEnabled = useCallback(
    (enabled: boolean) => {
      save({
        youtubeAutoTranslateEnabled,
        youtubeAutoTranslateTitlesEnabled: enabled,
        youtubeAutoTranslateDescriptionsEnabled,
        youtubeAutoTranslateDebugEnabled,
        youtubeAutoTranslateTargetMode,
        youtubeAutoTranslateTargetLanguage,
      });
    },
    [
      save,
      youtubeAutoTranslateDescriptionsEnabled,
      youtubeAutoTranslateEnabled,
      youtubeAutoTranslateDebugEnabled,
      youtubeAutoTranslateTargetLanguage,
      youtubeAutoTranslateTargetMode,
    ]
  );

  const setDescriptionsEnabled = useCallback(
    (enabled: boolean) => {
      save({
        youtubeAutoTranslateEnabled,
        youtubeAutoTranslateTitlesEnabled,
        youtubeAutoTranslateDescriptionsEnabled: enabled,
        youtubeAutoTranslateDebugEnabled,
        youtubeAutoTranslateTargetMode,
        youtubeAutoTranslateTargetLanguage,
      });
    },
    [
      save,
      youtubeAutoTranslateDebugEnabled,
      youtubeAutoTranslateEnabled,
      youtubeAutoTranslateTargetLanguage,
      youtubeAutoTranslateTargetMode,
      youtubeAutoTranslateTitlesEnabled,
    ]
  );

  const setDebugEnabled = useCallback(
    (enabled: boolean) => {
      save({
        youtubeAutoTranslateEnabled,
        youtubeAutoTranslateTitlesEnabled,
        youtubeAutoTranslateDescriptionsEnabled,
        youtubeAutoTranslateDebugEnabled: enabled,
        youtubeAutoTranslateTargetMode,
        youtubeAutoTranslateTargetLanguage,
      });
    },
    [
      save,
      youtubeAutoTranslateDescriptionsEnabled,
      youtubeAutoTranslateEnabled,
      youtubeAutoTranslateTargetLanguage,
      youtubeAutoTranslateTargetMode,
      youtubeAutoTranslateTitlesEnabled,
    ]
  );

  const setTargetMode = useCallback(
    (mode: "auto" | "fixed") => {
      save({
        youtubeAutoTranslateEnabled,
        youtubeAutoTranslateTitlesEnabled,
        youtubeAutoTranslateDescriptionsEnabled,
        youtubeAutoTranslateDebugEnabled,
        youtubeAutoTranslateTargetMode: mode,
        youtubeAutoTranslateTargetLanguage,
      });
    },
    [
      save,
      youtubeAutoTranslateDescriptionsEnabled,
      youtubeAutoTranslateDebugEnabled,
      youtubeAutoTranslateEnabled,
      youtubeAutoTranslateTargetLanguage,
      youtubeAutoTranslateTitlesEnabled,
    ]
  );

  const setTargetLanguage = useCallback(
    (language: string) => {
      save({
        youtubeAutoTranslateEnabled,
        youtubeAutoTranslateTitlesEnabled,
        youtubeAutoTranslateDescriptionsEnabled,
        youtubeAutoTranslateDebugEnabled,
        youtubeAutoTranslateTargetMode,
        youtubeAutoTranslateTargetLanguage: language,
      });
    },
    [
      save,
      youtubeAutoTranslateDescriptionsEnabled,
      youtubeAutoTranslateDebugEnabled,
      youtubeAutoTranslateEnabled,
      youtubeAutoTranslateTargetMode,
      youtubeAutoTranslateTitlesEnabled,
    ]
  );

  const clearCache = useCallback(() => {
    chrome.storage.local.remove(YOUTUBE_AUTO_TRANSLATE_CACHE_KEY, () => {
      if (chrome.runtime.lastError) {
        setStatus({
          message: isOptions ? "Failed to clear cache." : "Could not clear cache.",
          isError: true,
        });
        window.setTimeout(() => setStatus(null), isOptions ? 1800 : 1200);
        return;
      }

      setStatus({
        message: isOptions ? "Translation cache cleared." : "Cache cleared.",
      });
      window.setTimeout(() => setStatus(null), isOptions ? 1400 : 1000);
    });
  }, [isOptions]);

  return {
    youtubeAutoTranslateEnabled,
    titlesSwitchChecked:
      youtubeAutoTranslateEnabled && youtubeAutoTranslateTitlesEnabled,
    descriptionsSwitchChecked:
      youtubeAutoTranslateEnabled && youtubeAutoTranslateDescriptionsEnabled,
    debugSwitchChecked: youtubeAutoTranslateDebugEnabled,
    targetMode: youtubeAutoTranslateTargetMode,
    targetLanguage: youtubeAutoTranslateTargetLanguage,
    childrenDisabled: !youtubeAutoTranslateEnabled,
    status,
    setMasterEnabled,
    setTitlesEnabled,
    setDescriptionsEnabled,
    setDebugEnabled,
    setTargetMode,
    setTargetLanguage,
    clearCache,
  };
}
