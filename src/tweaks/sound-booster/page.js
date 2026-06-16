(function () {
  "use strict";

  const MESSAGE_SOURCE = "graft-sound-booster";
  const MESSAGE_TYPE = "GRAFT_SOUND_BOOSTER_SETTINGS";
  const DEFAULT_SETTINGS = {
    soundBoosterEnabled: false,
    soundBoosterGain: 1.5,
    soundBoosterBlockedDomains: []
  };

  const chains = new WeakMap();
  const wiredElements = new Set();
  const state = {
    settings: { ...DEFAULT_SETTINGS },
    audioContext: null,
    observer: null,
    scanQueued: false
  };

  function normalizeDomainKey(value) {
    return String(value || "")
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .split(":")[0]
      .toLowerCase();
  }

  function normalizeDomainList(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((entry) => normalizeDomainKey(entry)).filter(Boolean);
  }

  function clampGain(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_SETTINGS.soundBoosterGain;
    }
    return Math.round(Math.min(4, Math.max(1, numeric)) * 10) / 10;
  }

  function isBlocked() {
    const host = normalizeDomainKey(location.hostname);
    return normalizeDomainList(state.settings.soundBoosterBlockedDomains).some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  }

  function isActive() {
    return Boolean(state.settings.soundBoosterEnabled) && !isBlocked();
  }

  function currentGain() {
    return isActive() ? clampGain(state.settings.soundBoosterGain) : 1;
  }

  function getAudioContext() {
    if (state.audioContext) {
      return state.audioContext;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    state.audioContext = new AudioContextCtor();
    return state.audioContext;
  }

  function resumeContext() {
    const context = state.audioContext;
    if (context?.state === "suspended") {
      context.resume().catch(() => {});
    }
  }

  function setAllGains(gainValue) {
    for (const element of wiredElements) {
      const chain = chains.get(element);
      if (!chain) {
        continue;
      }
      chain.gain.gain.value = gainValue;
    }
  }

  function wireMediaElement(element) {
    if (!(element instanceof HTMLMediaElement)) {
      return;
    }
    if (chains.has(element)) {
      const chain = chains.get(element);
      if (chain) {
        chain.gain.gain.value = currentGain();
      }
      return;
    }

    const context = getAudioContext();
    if (!context) {
      return;
    }

    try {
      const source = context.createMediaElementSource(element);
      const gain = context.createGain();
      gain.gain.value = currentGain();
      source.connect(gain);
      gain.connect(context.destination);
      chains.set(element, { source, gain });
      wiredElements.add(element);
      element.addEventListener("play", resumeContext, { passive: true });
      element.addEventListener("volumechange", resumeContext, { passive: true });
    } catch (_error) {
      element.dataset.graftSoundBoosterSkipped = "true";
    }
  }

  function scanMedia() {
    state.scanQueued = false;
    if (!isActive()) {
      setAllGains(1);
      return;
    }

    document.querySelectorAll("audio, video").forEach(wireMediaElement);
    setAllGains(currentGain());
  }

  function queueScan() {
    if (state.scanQueued) {
      return;
    }
    state.scanQueued = true;
    requestAnimationFrame(scanMedia);
  }

  function ensureObserver() {
    if (state.observer || !document.documentElement) {
      return;
    }

    state.observer = new MutationObserver((mutations) => {
      if (!isActive()) {
        return;
      }

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLMediaElement) {
            queueScan();
            return;
          }
          if (node instanceof Element && node.querySelector?.("audio, video")) {
            queueScan();
            return;
          }
        }
      }
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function applySettings(nextSettings) {
    state.settings = {
      ...DEFAULT_SETTINGS,
      ...nextSettings,
      soundBoosterGain: clampGain(nextSettings?.soundBoosterGain)
    };

    ensureObserver();
    if (!isActive()) {
      setAllGains(1);
      return;
    }

    queueScan();
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== MESSAGE_SOURCE || data.type !== MESSAGE_TYPE) {
      return;
    }

    applySettings(data.settings);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensureObserver();
      queueScan();
    }, { once: true });
  } else {
    ensureObserver();
    queueScan();
  }
})();
