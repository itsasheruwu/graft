(function () {
  "use strict";

  const MESSAGE_SOURCE = "graft-sound-booster";
  const MESSAGE_TYPE = "GRAFT_SOUND_BOOSTER_SETTINGS";
  const DEFAULT_SETTINGS = {
    soundBoosterEnabled: false,
    soundBoosterGain: 1.5,
    soundBoosterBlockedDomains: []
  };

  function clampGain(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_SETTINGS.soundBoosterGain;
    }
    return Math.round(Math.min(4, Math.max(1, numeric)) * 10) / 10;
  }

  function broadcast() {
    if (!chrome.storage?.sync) {
      window.postMessage(
        {
          type: MESSAGE_TYPE,
          source: MESSAGE_SOURCE,
          settings: { ...DEFAULT_SETTINGS }
        },
        "*"
      );
      return;
    }

    chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
      const settings = { ...DEFAULT_SETTINGS, ...stored };
      settings.soundBoosterGain = clampGain(settings.soundBoosterGain);
      window.postMessage(
        {
          type: MESSAGE_TYPE,
          source: MESSAGE_SOURCE,
          settings
        },
        "*"
      );
    });
  }

  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") {
        return;
      }
      if (
        !("soundBoosterEnabled" in changes) &&
        !("soundBoosterGain" in changes) &&
        !("soundBoosterBlockedDomains" in changes)
      ) {
        return;
      }
      broadcast();
    });
  }

  broadcast();
})();
