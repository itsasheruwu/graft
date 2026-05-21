const SYNC_DEFAULT_SETTINGS = {
  themeSyncerEnabled: true,
  themeSyncerYoutubeEnabled: true,
  themeSyncerBlockedDomains: [],
  youtubeAutoTranslateEnabled: true,
  youtubeAutoTranslateTitlesEnabled: true,
  youtubeAutoTranslateDescriptionsEnabled: true,
  youtubeAutoTranslateDebugEnabled: false,
  youtubeAutoTranslateTargetMode: "auto",
  youtubeAutoTranslateTargetLanguage: "en",
  elementSelectorEnabled: false,
};

const LOCAL_DEFAULT_SETTINGS = {
  elementSelectorRemovedElementsByDomain: {},
};

const REMOVALS_KEY = "elementSelectorRemovedElementsByDomain";
const MIGRATION_FLAG_KEY = "graftMigratedElementSelectorRemovalsToLocal";

const TRANSLATE_MIN_GAP_MS = 220;
const translateQueue = [];
let translateProcessing = false;
let lastTranslateAt = 0;

function ensureDefaultSettings() {
  const syncKeys = Object.keys(SYNC_DEFAULT_SETTINGS);
  chrome.storage.sync.get(syncKeys, (stored) => {
    if (chrome.runtime.lastError) {
      return;
    }

    const patch = {};
    for (const key of syncKeys) {
      if (!(key in stored)) {
        patch[key] = SYNC_DEFAULT_SETTINGS[key];
      }
    }

    if (Object.keys(patch).length > 0) {
      chrome.storage.sync.set(patch);
    }
  });

  const localKeys = Object.keys(LOCAL_DEFAULT_SETTINGS);
  chrome.storage.local.get(localKeys, (stored) => {
    if (chrome.runtime.lastError) {
      return;
    }

    const patch = {};
    for (const key of localKeys) {
      if (!(key in stored)) {
        patch[key] = LOCAL_DEFAULT_SETTINGS[key];
      }
    }

    if (Object.keys(patch).length > 0) {
      chrome.storage.local.set(patch);
    }
  });
}

function migrateElementSelectorRemovalsToLocal() {
  chrome.storage.local.get([MIGRATION_FLAG_KEY], (localFlags) => {
    if (chrome.runtime.lastError || localFlags[MIGRATION_FLAG_KEY]) {
      return;
    }

    chrome.storage.sync.get([REMOVALS_KEY], (syncStored) => {
      if (chrome.runtime.lastError) {
        return;
      }

      const fromSync = syncStored[REMOVALS_KEY];
      const hasSyncData =
        fromSync &&
        typeof fromSync === "object" &&
        Object.keys(fromSync).length > 0;

      const finish = () => {
        chrome.storage.local.set({ [MIGRATION_FLAG_KEY]: true });
        if (hasSyncData) {
          chrome.storage.sync.remove(REMOVALS_KEY);
        }
      };

      if (!hasSyncData) {
        finish();
        return;
      }

      chrome.storage.local.get([REMOVALS_KEY], (localStored) => {
        const existing = localStored[REMOVALS_KEY];
        const existingEmpty =
          !existing ||
          typeof existing !== "object" ||
          Object.keys(existing).length === 0;

        if (existingEmpty) {
          chrome.storage.local.set({ [REMOVALS_KEY]: fromSync }, finish);
          return;
        }

        finish();
      });
    });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  ensureDefaultSettings();
  migrateElementSelectorRemovalsToLocal();

  if (details.reason === "update") {
    migrateElementSelectorRemovalsToLocal();
  }
});

chrome.runtime.onStartup.addListener(() => {
  ensureDefaultSettings();
  migrateElementSelectorRemovalsToLocal();
});

chrome.commands?.onCommand?.addListener((command) => {
  if (command !== "toggle-element-selector") {
    return;
  }

  chrome.storage.sync.get(
    { elementSelectorEnabled: SYNC_DEFAULT_SETTINGS.elementSelectorEnabled },
    (stored) => {
      if (chrome.runtime.lastError) {
        return;
      }

      chrome.storage.sync.set({
        elementSelectorEnabled: !Boolean(stored.elementSelectorEnabled),
      });
    }
  );
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "youtube-auto-translate:log") {
    console.log("[Graft][YouTube Auto Translation]", message.event, {
      detail: message.detail,
      url: message.url,
    });
    return false;
  }

  if (message?.type !== "youtube-auto-translate:translate") {
    return false;
  }

  enqueueTranslate(message)
    .then((payload) => sendResponse(payload))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Translation failed",
      });
    });

  return true;
});

function enqueueTranslate(message) {
  return new Promise((resolve, reject) => {
    translateQueue.push({ message, resolve, reject });
    drainTranslateQueue();
  });
}

function drainTranslateQueue() {
  if (translateProcessing || translateQueue.length === 0) {
    return;
  }

  translateProcessing = true;
  const job = translateQueue.shift();

  const waitMs = Math.max(0, TRANSLATE_MIN_GAP_MS - (Date.now() - lastTranslateAt));

  setTimeout(() => {
    translateWithGoogle(job.message)
      .then((result) => {
        lastTranslateAt = Date.now();
        job.resolve(result);
      })
      .catch((error) => {
        job.reject(error);
      })
      .finally(() => {
        translateProcessing = false;
        drainTranslateQueue();
      });
  }, waitMs);
}

async function translateWithGoogle(message) {
  const text = String(message.text || "").trim();
  const targetLanguage = normalizeTranslateLanguage(
    message.targetLanguage || "en"
  );
  const sourceLanguage = normalizeTranslateLanguage(
    message.sourceLanguage || "auto"
  );

  if (!text) {
    return { ok: false, error: "Missing text" };
  }

  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sourceLanguage);
  url.searchParams.set("tl", targetLanguage);
  url.searchParams.append("dt", "t");
  url.searchParams.append("dt", "ld");
  url.searchParams.set("q", text);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Translate request failed: ${response.status}`);
  }

  const data = await response.json();
  const translated = Array.isArray(data?.[0])
    ? data[0].map((part) => part?.[0] || "").join("")
    : "";
  const detectedLanguage = normalizeTranslateLanguage(data?.[2] || sourceLanguage);

  if (!translated.trim()) {
    return { ok: false, error: "Empty translation" };
  }

  return {
    ok: true,
    text: translated.trim(),
    sourceLanguage: detectedLanguage,
  };
}

function normalizeTranslateLanguage(language) {
  const normalized = String(language || "en").replace("_", "-").trim();
  if (normalized === "auto") {
    return "auto";
  }
  if (normalized.toLowerCase() === "zh-hant") {
    return "zh-TW";
  }
  if (normalized.toLowerCase() === "zh-hans") {
    return "zh-CN";
  }
  return normalized.split("-")[0].toLowerCase();
}
