(function () {
  "use strict";

  const MESSAGE_SOURCE = "graft-element-selector";
  const MESSAGE_STATE = "BTM_ELEMENT_SELECTOR_STATE";
  const MESSAGE_REMOVE = "BTM_ELEMENT_SELECTOR_REMOVE";
  const MESSAGE_UNDO = "BTM_ELEMENT_SELECTOR_UNDO";
  const MESSAGE_CLEAR_LOCATE = "BTM_ELEMENT_SELECTOR_CLEAR_LOCATE";
  const MESSAGE_OPEN_HIDDEN_LIST = "BTM_ELEMENT_SELECTOR_OPEN_HIDDEN_LIST";
  const MESSAGE_REWRITE = "BTM_ELEMENT_SELECTOR_REWRITE";

  const STORAGE_LOCATE = "elementSelectorLocateRequest";
  const REMOVALS_KEY = "elementSelectorRemovedElementsByDomain";
  const REWRITES_KEY = "elementSelectorTextRewritesByDomain";

  const SYNC_DEFAULTS = {
    elementSelectorEnabled: false,
  };

  const LOCAL_DEFAULTS = {
    [REMOVALS_KEY]: {},
    [REWRITES_KEY]: {},
  };

  const STATE_FIELDS = {
    enabled: "elementSelectorEnabled",
    removals: REMOVALS_KEY,
    rewrites: REWRITES_KEY,
  };

  function normalizeDomain(domain) {
    if (!domain) {
      return location.hostname.replace(/^www\./, "").toLowerCase();
    }

    return String(domain).replace(/^www\./, "").toLowerCase();
  }

  function normalizeSelectionSignature(signature) {
    if (!signature || typeof signature !== "object") {
      return null;
    }

    const normalized = {
      selectorPath: typeof signature.selectorPath === "string" ? signature.selectorPath : "",
      primarySelector: typeof signature.primarySelector === "string" ? signature.primarySelector : "",
      tagName: typeof signature.tagName === "string" ? signature.tagName.toLowerCase() : "",
      id: typeof signature.id === "string" ? signature.id : "",
      classes: Array.isArray(signature.classes) ? signature.classes.filter(Boolean) : [],
      sourceUrl: typeof signature.sourceUrl === "string" ? signature.sourceUrl : ""
    };

    if (!normalized.primarySelector && !normalized.selectorPath && !normalized.tagName) {
      return null;
    }

    return normalized;
  }

  function normalizeStoredMap(raw) {
    const output = {};

    if (!raw || typeof raw !== "object") {
      return output;
    }

    for (const key of Object.keys(raw)) {
      const normalizedDomain = normalizeDomain(key);
      const list = raw[key];

      if (!Array.isArray(list)) {
        continue;
      }

      const cleaned = [];
      for (const entry of list) {
        const normalized = normalizeSelectionSignature(entry);
        if (normalized) {
          cleaned.push(normalized);
        }
      }
      output[normalizedDomain] = cleaned;
    }

    return output;
  }

  function signaturesMatch(left, right) {
    if (left.primarySelector && right.primarySelector) {
      return left.primarySelector === right.primarySelector;
    }

    if (left.selectorPath && right.selectorPath) {
      return left.selectorPath === right.selectorPath;
    }

    return (
      left.tagName === right.tagName &&
      left.id === right.id &&
      left.classes.join(",") === right.classes.join(",")
    );
  }

  function getDomainRemovals(rawMap, domain) {
    const normalizedDomain = normalizeDomain(domain);
    const normalizedMap = normalizeStoredMap(rawMap);
    return normalizedMap[normalizedDomain] || [];
  }

  function normalizeRewriteEntry(entry) {
    const signature = normalizeSelectionSignature(entry);
    if (!signature) {
      return null;
    }

    return {
      ...signature,
      newText: typeof entry.newText === "string" ? entry.newText : "",
    };
  }

  function normalizeRewriteMap(raw) {
    const output = {};

    if (!raw || typeof raw !== "object") {
      return output;
    }

    for (const key of Object.keys(raw)) {
      const normalizedDomain = normalizeDomain(key);
      const list = raw[key];

      if (!Array.isArray(list)) {
        continue;
      }

      const cleaned = [];
      for (const entry of list) {
        const normalized = normalizeRewriteEntry(entry);
        if (normalized) {
          cleaned.push(normalized);
        }
      }
      output[normalizedDomain] = cleaned;
    }

    return output;
  }

  function getDomainRewrites(rawMap, domain) {
    const normalizedDomain = normalizeDomain(domain);
    const normalizedMap = normalizeRewriteMap(rawMap);
    return normalizedMap[normalizedDomain] || [];
  }

  function pickLocateForPage(locate, pageDomain) {
    if (!locate || typeof locate !== "object") {
      return null;
    }

    if (typeof locate.expiresAt === "number" && locate.expiresAt < Date.now()) {
      return null;
    }

    const targetDomain = normalizeDomain(locate.domain || "");
    if (!targetDomain || targetDomain !== normalizeDomain(pageDomain)) {
      return null;
    }

    const signature = normalizeSelectionSignature(locate.signature);
    if (!signature) {
      return null;
    }

    const kind = locate.kind === "rewrite" ? "rewrite" : "hidden";

    return {
      signature,
      requestId: typeof locate.requestId === "string" ? locate.requestId : "",
      sourceUrl: typeof locate.sourceUrl === "string" ? locate.sourceUrl : "",
      kind,
    };
  }

  function broadcastState(syncStored, localStored, locatePayload) {
    const settings = {
      ...SYNC_DEFAULTS,
      ...syncStored
    };
    const removalsMap = {
      ...LOCAL_DEFAULTS,
      ...localStored
    };
    const normalizedDomain = normalizeDomain();
    const removals = getDomainRemovals(removalsMap[REMOVALS_KEY], normalizedDomain);
    const rewrites = getDomainRewrites(removalsMap[REWRITES_KEY], normalizedDomain);

    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: MESSAGE_STATE,
        elementSelectorEnabled: Boolean(settings.elementSelectorEnabled),
        removals,
        rewrites,
        domain: normalizedDomain,
        locateSignature: locatePayload ? locatePayload.signature : null,
        locateRequestId: locatePayload ? locatePayload.requestId : null,
        locateKind: locatePayload ? locatePayload.kind : null,
      },
      "*"
    );
  }

  function sendState() {
    if (!chrome.storage?.sync) {
      broadcastState(SYNC_DEFAULTS, LOCAL_DEFAULTS, null);
      return;
    }

    chrome.storage.sync.get(SYNC_DEFAULTS, (syncStored) => {
      if (!chrome.storage?.local) {
        broadcastState(syncStored, LOCAL_DEFAULTS, null);
        return;
      }

      chrome.storage.local.get(
        { ...LOCAL_DEFAULTS, [STORAGE_LOCATE]: null },
        (localStored) => {
          const locate = localStored[STORAGE_LOCATE];
          const pageDomain = normalizeDomain();
          const payload = pickLocateForPage(locate, pageDomain);
          broadcastState(syncStored, localStored, payload);
        }
      );
    });
  }

  function clearLocateRequest() {
    if (!chrome.storage?.local) {
      return;
    }
    chrome.storage.local.remove(STORAGE_LOCATE, () => {
      sendState();
    });
  }

  function openHiddenListTab() {
    if (!chrome.runtime?.getURL || !chrome.tabs?.query) {
      return;
    }
    const targetUrl = chrome.runtime.getURL("edited-list.html");
    chrome.tabs.query({}, (tabs) => {
      const found = tabs.find((t) => t.url === targetUrl);
      if (found?.id != null) {
        chrome.tabs.update(found.id, { active: true });
        return;
      }
      chrome.tabs.create({ url: targetUrl });
    });
  }

  function addRemoval(storageMap, domain, payload) {
    const normalizedDomain = normalizeDomain(domain);
    const existing = storageMap[normalizedDomain] || [];

    const match = existing.some((entry) => signaturesMatch(entry, payload));
    if (match) {
      return storageMap;
    }

    const withTimestamp = {
      ...payload,
      removedAt: new Date().toISOString(),
    };
    return {
      ...storageMap,
      [normalizedDomain]: [...existing, withTimestamp]
    };
  }

  function removeLastRemoval(storageMap, domain) {
    const normalizedDomain = normalizeDomain(domain);
    const existing = storageMap[normalizedDomain];
    if (!Array.isArray(existing) || existing.length === 0) {
      return { map: storageMap, removed: null };
    }

    const removed = existing[existing.length - 1];
    const nextList = existing.slice(0, -1);
    const nextMap = { ...storageMap };
    if (nextList.length === 0) {
      delete nextMap[normalizedDomain];
    } else {
      nextMap[normalizedDomain] = nextList;
    }

    return { map: nextMap, removed };
  }

  function persistRemovals(nextMap, callback) {
    chrome.storage.local.set({ [REMOVALS_KEY]: nextMap }, () => {
      if (chrome.runtime.lastError) {
        return;
      }
      sendState();
      if (typeof callback === "function") {
        callback();
      }
    });
  }

  function upsertRewrite(storageMap, domain, payload) {
    const normalizedDomain = normalizeDomain(domain);
    const existing = storageMap[normalizedDomain] || [];
    const filtered = existing.filter((entry) => !signaturesMatch(entry, payload));
    const withTimestamp = {
      ...payload,
      rewrittenAt: new Date().toISOString(),
    };

    return {
      ...storageMap,
      [normalizedDomain]: [...filtered, withTimestamp],
    };
  }

  function persistRewrites(nextMap, callback) {
    chrome.storage.local.set({ [REWRITES_KEY]: nextMap }, () => {
      if (chrome.runtime.lastError) {
        return;
      }
      sendState();
      if (typeof callback === "function") {
        callback();
      }
    });
  }

  function handleRewriteMessage(message) {
    const payload = normalizeRewriteEntry(message.payload);
    if (!payload || !message.persist) {
      return;
    }

    if (!chrome.storage?.local) {
      return;
    }

    const domain = normalizeDomain();

    chrome.storage.local.get(LOCAL_DEFAULTS, (localStored) => {
      const normalizedMap = normalizeRewriteMap(localStored[REWRITES_KEY]);
      const nextMap = upsertRewrite(normalizedMap, domain, payload);
      persistRewrites(nextMap);
    });
  }

  function handleRemoveMessage(message) {
    const payload = normalizeSelectionSignature(message.payload);
    if (!payload) {
      return;
    }

    if (!chrome.storage?.local) {
      return;
    }

    const domain = normalizeDomain();

    chrome.storage.local.get(LOCAL_DEFAULTS, (localStored) => {
      const normalizedMap = normalizeStoredMap(localStored[REMOVALS_KEY]);
      const nextMap = addRemoval(normalizedMap, domain, payload);
      persistRemovals(nextMap);
    });
  }

  function handleUndoMessage() {
    if (!chrome.storage?.local) {
      return;
    }

    const domain = normalizeDomain();

    chrome.storage.local.get(LOCAL_DEFAULTS, (localStored) => {
      const normalizedMap = normalizeStoredMap(localStored[REMOVALS_KEY]);
      const { map: nextMap, removed } = removeLastRemoval(normalizedMap, domain);
      if (!removed) {
        return;
      }

      persistRemovals(nextMap, () => {
        window.postMessage(
          {
            source: MESSAGE_SOURCE,
            type: "BTM_ELEMENT_SELECTOR_UNDO_APPLIED",
            payload: removed,
            domain
          },
          "*"
        );
      });
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== MESSAGE_SOURCE) {
      return;
    }

    if (data.type === MESSAGE_REMOVE) {
      handleRemoveMessage(data);
      return;
    }

    if (data.type === MESSAGE_REWRITE) {
      handleRewriteMessage(data);
      return;
    }

    if (data.type === MESSAGE_UNDO) {
      handleUndoMessage();
      return;
    }

    if (data.type === MESSAGE_CLEAR_LOCATE) {
      clearLocateRequest();
      return;
    }

    if (data.type === MESSAGE_OPEN_HIDDEN_LIST) {
      openHiddenListTab();
      return;
    }
  });

  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && STATE_FIELDS.enabled in changes) {
        sendState();
        return;
      }
      if (
        area === "local" &&
        (REMOVALS_KEY in changes || REWRITES_KEY in changes || STORAGE_LOCATE in changes)
      ) {
        sendState();
      }
    });
  }

  sendState();
})();
