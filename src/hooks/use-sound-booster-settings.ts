import {
  SOUND_BOOSTER_DEFAULT_GAIN,
  clampSoundBoosterGain,
  isHostnameBlocked,
  normalizeDomainKey,
  normalizeDomainList,
} from "@/lib/tweak-controls";
import { useCallback, useEffect, useState } from "react";

export const DEFAULT_SOUND_BOOSTER_SETTINGS = {
  soundBoosterEnabled: false,
  soundBoosterGain: SOUND_BOOSTER_DEFAULT_GAIN,
  soundBoosterBlockedDomains: [] as string[],
};

export type SoundBoosterSettings = {
  soundBoosterEnabled: boolean;
  soundBoosterGain: number;
  soundBoosterBlockedDomains: string[];
};

type Status = { message: string; isError?: boolean } | null;

export function useSoundBoosterSettings(config: {
  variant: "popup" | "options";
}) {
  const [soundBoosterEnabled, setSoundBoosterEnabled] = useState(false);
  const [soundBoosterGain, setSoundBoosterGain] = useState(
    SOUND_BOOSTER_DEFAULT_GAIN
  );
  const [soundBoosterBlockedDomains, setSoundBoosterBlockedDomains] =
    useState<string[]>([]);
  const [blocklistInput, setBlocklistInput] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [currentHostname, setCurrentHostname] = useState("");
  const isOptions = config.variant === "options";

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_SOUND_BOOSTER_SETTINGS, (stored) => {
      const settings = {
        ...DEFAULT_SOUND_BOOSTER_SETTINGS,
        ...stored,
      };

      setSoundBoosterEnabled(Boolean(settings.soundBoosterEnabled));
      setSoundBoosterGain(clampSoundBoosterGain(settings.soundBoosterGain));
      setSoundBoosterBlockedDomains(
        normalizeDomainList(settings.soundBoosterBlockedDomains)
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
    (next: SoundBoosterSettings) => {
      const payload = {
        soundBoosterEnabled: next.soundBoosterEnabled,
        soundBoosterGain: clampSoundBoosterGain(next.soundBoosterGain),
        soundBoosterBlockedDomains: normalizeDomainList(
          next.soundBoosterBlockedDomains
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

        setSoundBoosterEnabled(payload.soundBoosterEnabled);
        setSoundBoosterGain(payload.soundBoosterGain);
        setSoundBoosterBlockedDomains(payload.soundBoosterBlockedDomains);
        setStatus({ message: isOptions ? "Settings saved." : "Saved." });
        window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
      });
    },
    [isOptions]
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      save({
        soundBoosterEnabled: enabled,
        soundBoosterGain,
        soundBoosterBlockedDomains,
      });
    },
    [save, soundBoosterBlockedDomains, soundBoosterGain]
  );

  const setGain = useCallback(
    (gain: number) => {
      save({
        soundBoosterEnabled,
        soundBoosterGain: gain,
        soundBoosterBlockedDomains,
      });
    },
    [save, soundBoosterBlockedDomains, soundBoosterEnabled]
  );

  const addBlockedDomain = useCallback(() => {
    const domain = normalizeDomainKey(blocklistInput.trim());
    if (!domain || soundBoosterBlockedDomains.includes(domain)) {
      return;
    }

    setBlocklistInput("");
    save({
      soundBoosterEnabled,
      soundBoosterGain,
      soundBoosterBlockedDomains: [...soundBoosterBlockedDomains, domain],
    });
  }, [
    blocklistInput,
    save,
    soundBoosterBlockedDomains,
    soundBoosterEnabled,
    soundBoosterGain,
  ]);

  const removeBlockedDomain = useCallback(
    (domain: string) => {
      save({
        soundBoosterEnabled,
        soundBoosterGain,
        soundBoosterBlockedDomains: soundBoosterBlockedDomains.filter(
          (entry) => entry !== domain
        ),
      });
    },
    [save, soundBoosterBlockedDomains, soundBoosterEnabled, soundBoosterGain]
  );

  return {
    soundBoosterEnabled,
    soundBoosterGain,
    soundBoosterBlockedDomains,
    blocklistInput,
    setBlocklistInput,
    currentHostname,
    currentSiteBlocked: isHostnameBlocked(
      currentHostname,
      soundBoosterBlockedDomains
    ),
    status,
    setEnabled,
    setGain,
    addBlockedDomain,
    removeBlockedDomain,
  };
}
