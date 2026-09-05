const SYNC_DEFAULT_SETTINGS = {
  themeSyncerEnabled: true,
  themeSyncerYoutubeEnabled: true,
  themeSyncerBlockedDomains: [],
  forceDarkModeEnabled: false,
  forceDarkModeBlockedDomains: [],
  soundBoosterEnabled: false,
  soundBoosterGain: 1.5,
  soundBoosterBlockedDomains: [],
  youtubeAutoTranslateEnabled: true,
  youtubeAutoTranslateTitlesEnabled: true,
  youtubeAutoTranslateDescriptionsEnabled: true,
  youtubeAutoTranslateDebugEnabled: false,
  youtubeAutoTranslateTargetMode: "auto",
  youtubeAutoTranslateTargetLanguage: "en",
  graftAiRewriterEnabled: true,
  assetFinderEnabled: true,
  assetFinderHideBlankAssets: false,
  elementSelectorEnabled: false,
  scrollToTopEnabled: false,
  scrollToTopBlockedDomains: [],
  wikipediaEnhancementsEnabled: false,
  wikipediaReadingWidthEnabled: false,
  wikipediaReadingWidthPreset: "comfortable",
  wikipediaNavigationCleanupEnabled: false,
  wikipediaCollapseReferencesEnabled: false,
  wikipediaFloatingTocEnabled: false,
  wikipediaSearchHighlightEnabled: false,
  wikipediaHideDonationBannersEnabled: false,
  xQuietFeedEnabled: false,
  robloxPlayerWatcherEnabled: false,
  robloxPlayerWatcherNotifyOnline: true,
  robloxPlayerWatcherNotifyOffline: true,
  robloxPlayerWatcherNotifyJoinGame: true,
  robloxPlayerWatcherShowExactGame: false,
  robloxPlayerWatcherAntiSpamEnabled: true,
  robloxPlayerWatcherWhitelist: [],
};

const LOCAL_DEFAULT_SETTINGS = {
  elementSelectorRemovedElementsByDomain: {},
  elementSelectorTextRewritesByDomain: {},
  graftAiRecipesByDomain: {},
  graftAiHelperPort: 27491,
  graftAiHelperToken: "",
  robloxPlayerWatcherLastPresenceByUserId: {},
  robloxPlayerWatcherResolvedIdsByEntry: {},
  robloxPlayerWatcherGameNamesByUniverseId: {},
};

const REMOVALS_KEY = "elementSelectorRemovedElementsByDomain";
const MIGRATION_FLAG_KEY = "graftMigratedElementSelectorRemovalsToLocal";
const GRAFT_NATIVE_HOST = "com.itsasheruwu.graft";
const ROBLOX_WATCHER_ALARM = "graft-roblox-player-watcher";
const ROBLOX_WATCHER_FALLBACK_SEEDED_KEY = "robloxPlayerWatcherFallbackSeeded";
const ROBLOX_WATCHER_LAST_JOIN_NOTIFY_KEY = "robloxPlayerWatcherLastJoinNotifyAtByUserId";
const ROBLOX_WATCHER_ANTI_SPAM_COOLDOWN_MS = 3 * 60 * 1000;
const ROBLOX_WATCHER_POLL_MINUTES = 1;
const ROBLOX_WATCHER_GAME_NAME_TTL_MS = 24 * 60 * 60 * 1000;
const ROBLOX_WATCHER_GAME_NAME_CACHE_LIMIT = 250;

const TRANSLATE_MIN_GAP_MS = 220;
const translateQueue = [];
let translateProcessing = false;
let lastTranslateAt = 0;
let graftNativePort = null;
let graftNativeReconnectTimer = null;
const graftNativeNotificationRequests = new Map();
const graftNativeWatcherOwnerRequests = new Map();
let robloxWatcherFallbackPolling = false;
let robloxWatcherFallbackRevision = 0;

function postGraftNativeSnapshot() {
  if (!graftNativePort) {
    return;
  }

  chrome.storage.sync.get(Object.keys(SYNC_DEFAULT_SETTINGS), (settings) => {
    if (chrome.runtime.lastError || !graftNativePort) {
      return;
    }
    try {
      graftNativePort.postMessage({ type: "snapshot", settings });
    } catch {
      // A disconnect can race with snapshots after an app or extension reload.
    }
  });
}

function connectGraftNativeHost() {
  if (!chrome.runtime?.connectNative || graftNativePort) {
    return;
  }

  try {
    const port = chrome.runtime.connectNative(GRAFT_NATIVE_HOST);
    graftNativePort = port;
    port.onMessage.addListener((message) => {
      if (message?.type === "robloxWatcherOwnerResult" && typeof message.requestID === "string") {
        const resolve = graftNativeWatcherOwnerRequests.get(message.requestID);
        if (resolve) {
          graftNativeWatcherOwnerRequests.delete(message.requestID);
          resolve(Boolean(message.active));
        }
        return;
      }
      if (message?.type === "notificationResult" && typeof message.requestID === "string") {
        const resolve = graftNativeNotificationRequests.get(message.requestID);
        if (resolve) {
          graftNativeNotificationRequests.delete(message.requestID);
          resolve(Boolean(message.handled));
        }
        return;
      }
      if (message?.type !== "applySettings" || !message.changes || typeof message.changes !== "object") {
        return;
      }

      const allowedKeys = new Set(Object.keys(SYNC_DEFAULT_SETTINGS));
      const patch = Object.fromEntries(
        Object.entries(message.changes).filter(([key]) => allowedKeys.has(key))
      );
      if (Object.keys(patch).length > 0) {
        chrome.storage.sync.set(patch, postGraftNativeSnapshot);
      }
    });
    port.onDisconnect.addListener(() => {
      graftNativePort = null;
      for (const resolve of graftNativeNotificationRequests.values()) {
        resolve(false);
      }
      graftNativeNotificationRequests.clear();
      for (const resolve of graftNativeWatcherOwnerRequests.values()) {
        resolve(false);
      }
      graftNativeWatcherOwnerRequests.clear();
      clearTimeout(graftNativeReconnectTimer);
      graftNativeReconnectTimer = setTimeout(connectGraftNativeHost, 5_000);
    });
    postGraftNativeSnapshot();
  } catch {
    graftNativePort = null;
    clearTimeout(graftNativeReconnectTimer);
    graftNativeReconnectTimer = setTimeout(connectGraftNativeHost, 5_000);
  }
}

async function isRobloxWatcherOwnedByGraftApp() {
  if (!graftNativePort) {
    return false;
  }

  const requestID = crypto.randomUUID();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (active) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      graftNativeWatcherOwnerRequests.delete(requestID);
      resolve(Boolean(active));
    };
    const timeout = setTimeout(() => finish(false), 1_500);
    graftNativeWatcherOwnerRequests.set(requestID, finish);
    try {
      graftNativePort.postMessage({ type: "getRobloxWatcherOwner", requestID });
    } catch {
      finish(false);
    }
  });
}

async function sendGraftNativeNotification({ id, title, message }) {
  if (!graftNativePort) {
    return false;
  }

  const requestID = crypto.randomUUID();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (handled) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      graftNativeNotificationRequests.delete(requestID);
      resolve(handled);
    };
    const timeout = setTimeout(() => finish(false), 1_500);
    graftNativeNotificationRequests.set(requestID, finish);
    try {
      graftNativePort.postMessage({
        type: "notification",
        requestID,
        notification: { id, title, message },
      });
    } catch {
      finish(false);
    }
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && Object.keys(changes).some((key) => key in SYNC_DEFAULT_SETTINGS)) {
    postGraftNativeSnapshot();
  }
  if (areaName === "sync" && Object.keys(changes).some((key) => key.startsWith("robloxPlayerWatcher"))) {
    robloxWatcherFallbackRevision += 1;
    const resetBaseline =
      "robloxPlayerWatcherEnabled" in changes ||
      "robloxPlayerWatcherWhitelist" in changes;
    void configureRobloxWatcherFallback({ resetBaseline, pollImmediately: resetBaseline });
  }
});

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
  connectGraftNativeHost();
  void configureRobloxWatcherFallback({ resetBaseline: true, pollImmediately: true });
});

chrome.runtime.onStartup.addListener(() => {
  ensureDefaultSettings();
  migrateElementSelectorRemovalsToLocal();
  connectGraftNativeHost();
  void configureRobloxWatcherFallback({ resetBaseline: true, pollImmediately: true });
});

connectGraftNativeHost();
void configureRobloxWatcherFallback({ resetBaseline: false, pollImmediately: false });

chrome.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm.name === ROBLOX_WATCHER_ALARM) {
    void pollRobloxWatcherFallback();
  }
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
  if (message?.type === "graft-ai-rewriter:generate") {
    generateGraftAiRecipe(message)
      .then((payload) => sendResponse(payload))
      .catch((error) => {
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "AI rewrite request failed",
        });
      });

    return true;
  }

  if (message?.type === "roblox-player-watcher:notify") {
    createRobloxPlayerWatcherNotification(message.event)
      .then((payload) => sendResponse(payload))
      .catch((error) => {
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Roblox watcher notification failed",
        });
      });
    return true;
  }

  if (message?.type === "roblox-player-watcher:test-notification") {
    createRobloxPlayerWatcherTestNotification()
      .then((payload) => sendResponse(payload))
      .catch((error) => {
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Roblox watcher test notification failed",
        });
      });
    return true;
  }

  if (message?.type === "roblox-player-watcher:resolve-account") {
    resolveRobloxPlayerWatcherAccount(message.entry)
      .then((payload) => sendResponse(payload))
      .catch(() => sendResponse({ ok: false, error: "Graft could not reach Roblox. Try again." }));
    return true;
  }

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

function normalizeRobloxWatcherEntry(raw) {
  const value = String(raw || "").trim();
  if (/^\d+$/.test(value)) {
    return value;
  }
  const profileMatch = value.match(/\/users\/(\d+)(?:\/|$)/i);
  if (profileMatch) {
    return profileMatch[1];
  }
  return value.replace(/^@+/, "").toLowerCase();
}

async function resolveRobloxPlayerWatcherAccount(rawEntry) {
  const entry = normalizeRobloxWatcherEntry(rawEntry);
  if (!entry) {
    return { ok: false, error: "Enter a Roblox username, user ID, or profile link." };
  }

  let response;
  if (/^\d+$/.test(entry)) {
    response = await fetch(`https://users.roblox.com/v1/users/${entry}`, {
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return { ok: false, error: "That Roblox account could not be found." };
    if (!response.ok) return { ok: false, error: "Graft could not reach Roblox. Try again." };
    const user = await response.json();
    const username = String(user?.name || "").trim();
    if (!username) return { ok: false, error: "That Roblox account could not be found." };
    await cacheResolvedRobloxAccount(Number(user.id), username);
    return { ok: true, username };
  }

  response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ usernames: [entry], excludeBannedUsers: true }),
  });
  if (!response.ok) return { ok: false, error: "Graft could not reach Roblox. Try again." };
  const payload = await response.json();
  const user = payload?.data?.[0];
  const username = String(user?.name || "").trim();
  if (!username) return { ok: false, error: "That Roblox account could not be found." };
  await cacheResolvedRobloxAccount(Number(user.id), username);
  return { ok: true, username };
}

async function cacheResolvedRobloxAccount(userId, username) {
  if (!Number.isFinite(userId) || userId <= 0) return;
  const stored = await new Promise((resolve) => {
    chrome.storage.local.get({ robloxPlayerWatcherResolvedIdsByEntry: {} }, resolve);
  });
  const map = stored.robloxPlayerWatcherResolvedIdsByEntry || {};
  map[normalizeRobloxWatcherEntry(username)] = userId;
  map[String(userId)] = username;
  await new Promise((resolve) => {
    chrome.storage.local.set({ robloxPlayerWatcherResolvedIdsByEntry: map }, resolve);
  });
}

function storageGet(area, defaults) {
  return new Promise((resolve) => {
    chrome.storage[area].get(defaults, (stored) => {
      if (chrome.runtime.lastError) {
        resolve(defaults);
        return;
      }
      resolve(stored || defaults);
    });
  });
}

function storageSet(area, patch) {
  return new Promise((resolve) => {
    chrome.storage[area].set(patch, () => resolve(!chrome.runtime.lastError));
  });
}

async function configureRobloxWatcherFallback({ resetBaseline, pollImmediately }) {
  if (!chrome.alarms) return;
  const stored = await storageGet("sync", {
    robloxPlayerWatcherEnabled: false,
  });

  if (!stored.robloxPlayerWatcherEnabled) {
    await chrome.alarms.clear(ROBLOX_WATCHER_ALARM);
    if (resetBaseline) await resetRobloxWatcherFallbackBaseline();
    return;
  }

  if (resetBaseline) await resetRobloxWatcherFallbackBaseline();
  const existing = await chrome.alarms.get(ROBLOX_WATCHER_ALARM);
  if (!existing) {
    await chrome.alarms.create(ROBLOX_WATCHER_ALARM, {
      periodInMinutes: ROBLOX_WATCHER_POLL_MINUTES,
    });
  }
  if (pollImmediately) void pollRobloxWatcherFallback();
}

async function resetRobloxWatcherFallbackBaseline() {
  await Promise.all([
    storageSet("local", { robloxPlayerWatcherLastPresenceByUserId: {} }),
    storageSet("session", {
      [ROBLOX_WATCHER_FALLBACK_SEEDED_KEY]: false,
      [ROBLOX_WATCHER_LAST_JOIN_NOTIFY_KEY]: {},
    }),
  ]);
}

async function resolveRobloxWatcherIdentities(entries) {
  const stored = await storageGet("local", {
    robloxPlayerWatcherResolvedIdsByEntry: {},
  });
  const resolvedMap = {
    ...(stored.robloxPlayerWatcherResolvedIdsByEntry || {}),
  };
  const identities = new Map();
  const unresolvedUsernames = [];

  for (const entry of entries) {
    if (/^\d+$/.test(entry)) {
      const userId = Number(entry);
      const cachedName = String(resolvedMap[entry] || "");
      if (cachedName && !/^\d+$/.test(cachedName)) {
        identities.set(userId, cachedName);
        continue;
      }
      try {
        const response = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) continue;
        const user = await response.json();
        const username = String(user?.name || "").trim();
        if (!username) continue;
        resolvedMap[entry] = username;
        resolvedMap[normalizeRobloxWatcherEntry(username)] = userId;
        identities.set(userId, username);
      } catch {
        // Keep polling any entries that did resolve.
      }
      continue;
    }

    const cachedID = Number(resolvedMap[entry]);
    if (Number.isFinite(cachedID) && cachedID > 0) {
      identities.set(cachedID, String(resolvedMap[String(cachedID)] || entry));
    } else {
      unresolvedUsernames.push(entry);
    }
  }

  if (unresolvedUsernames.length > 0) {
    try {
      const response = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ usernames: unresolvedUsernames, excludeBannedUsers: true }),
      });
      if (response.ok) {
        const payload = await response.json();
        for (const user of Array.isArray(payload?.data) ? payload.data : []) {
          const userId = Number(user?.id);
          const username = String(user?.name || "").trim();
          const requested = normalizeRobloxWatcherEntry(user?.requestedUsername || username);
          if (!Number.isFinite(userId) || userId <= 0 || !username || !requested) continue;
          resolvedMap[requested] = userId;
          resolvedMap[String(userId)] = username;
          identities.set(userId, username);
        }
      }
    } catch {
      // Keep polling any entries that did resolve.
    }
  }

  await storageSet("local", { robloxPlayerWatcherResolvedIdsByEntry: resolvedMap });
  return identities;
}

function sameRobloxGameSession(previous, next) {
  if (!previous || Number(previous.presenceType) !== 2) return false;
  if (previous.gameId && next.gameId) return previous.gameId === next.gameId;
  if (previous.placeId != null && next.placeId != null) return previous.placeId === next.placeId;
  if (previous.universeId != null && next.universeId != null) return previous.universeId === next.universeId;
  return Boolean(previous.lastLocation) && previous.lastLocation === next.lastLocation;
}

function diffRobloxWatcherPresence(previousByUserId, snapshots) {
  const events = [];
  const nextByUserId = {};
  for (const snapshot of snapshots) {
    const key = String(snapshot.userId);
    const previous = previousByUserId[key] || null;
    nextByUserId[key] = snapshot;
    if (!previous) continue;

    const wasOffline = Number(previous.presenceType) === 0;
    const isOffline = Number(snapshot.presenceType) === 0;
    const joinedGame = Number(snapshot.presenceType) === 2 && !sameRobloxGameSession(previous, snapshot);
    if (wasOffline && !isOffline && !joinedGame) {
      events.push({ kind: "online", snapshot, previous });
    } else if (!wasOffline && isOffline) {
      events.push({ kind: "offline", snapshot, previous });
    }
    if (joinedGame) events.push({ kind: "join-game", snapshot, previous });
  }
  return { events, nextByUserId };
}

function shouldDeliverRobloxWatcherNotification(
  kind,
  userId,
  antiSpamEnabled,
  lastJoinNotifyAtByUserId,
  now
) {
  if (antiSpamEnabled === false || kind !== "join-game") {
    return true;
  }
  const last = Number(lastJoinNotifyAtByUserId?.[String(userId)]);
  if (!Number.isFinite(last) || last <= 0) {
    return true;
  }
  return now - last >= ROBLOX_WATCHER_ANTI_SPAM_COOLDOWN_MS;
}

async function addExactRobloxGameNames(snapshots) {
  const universeIds = [...new Set(
    snapshots
      .filter((snapshot) => Number(snapshot?.presenceType) === 2)
      .map((snapshot) => Number(snapshot?.universeId))
      .filter((id) => Number.isFinite(id) && id > 0)
  )];
  if (universeIds.length === 0) return snapshots;

  const now = Date.now();
  const stored = await storageGet("local", {
    robloxPlayerWatcherGameNamesByUniverseId: {},
  });
  const cache = { ...(stored.robloxPlayerWatcherGameNamesByUniverseId || {}) };
  const names = new Map();
  const missing = [];

  for (const universeId of universeIds) {
    const entry = cache[String(universeId)];
    const name = String(entry?.name || "").trim();
    const updatedAt = Number(entry?.updatedAt) || 0;
    if (name && now - updatedAt < ROBLOX_WATCHER_GAME_NAME_TTL_MS) {
      names.set(universeId, name);
    } else {
      missing.push(universeId);
    }
  }

  for (let index = 0; index < missing.length; index += 100) {
    const batch = missing.slice(index, index + 100);
    try {
      const url = new URL("https://games.roblox.com/v1/games");
      url.searchParams.set("universeIds", batch.join(","));
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) continue;
      const payload = await response.json();
      for (const game of Array.isArray(payload?.data) ? payload.data : []) {
        const universeId = Number(game?.id);
        const name = String(game?.name || "").trim();
        if (!Number.isFinite(universeId) || universeId <= 0 || !name) continue;
        names.set(universeId, name);
        cache[String(universeId)] = { name, updatedAt: now };
      }
    } catch {
      // Keep the presence-provided location when Roblox game details are unavailable.
    }
  }

  const prunedCache = Object.fromEntries(
    Object.entries(cache)
      .sort(([, left], [, right]) => (Number(right?.updatedAt) || 0) - (Number(left?.updatedAt) || 0))
      .slice(0, ROBLOX_WATCHER_GAME_NAME_CACHE_LIMIT)
  );
  await storageSet("local", { robloxPlayerWatcherGameNamesByUniverseId: prunedCache });

  return snapshots.map((snapshot) => {
    const exactName = names.get(Number(snapshot.universeId));
    return exactName ? { ...snapshot, lastLocation: exactName } : snapshot;
  });
}

async function pollRobloxWatcherFallback() {
  if (robloxWatcherFallbackPolling) return;
  robloxWatcherFallbackPolling = true;
  const revision = robloxWatcherFallbackRevision;

  try {
    const settings = await storageGet("sync", {
      robloxPlayerWatcherEnabled: false,
      robloxPlayerWatcherNotifyOnline: true,
      robloxPlayerWatcherNotifyOffline: true,
      robloxPlayerWatcherNotifyJoinGame: true,
      robloxPlayerWatcherShowExactGame: false,
      robloxPlayerWatcherAntiSpamEnabled: true,
      robloxPlayerWatcherWhitelist: [],
    });
    if (!settings.robloxPlayerWatcherEnabled || revision !== robloxWatcherFallbackRevision) return;

    const whitelist = [...new Set(
      (Array.isArray(settings.robloxPlayerWatcherWhitelist)
        ? settings.robloxPlayerWatcherWhitelist
        : [])
        .map(normalizeRobloxWatcherEntry)
        .filter(Boolean)
    )].slice(0, 50);
    if (whitelist.length === 0) {
      await resetRobloxWatcherFallbackBaseline();
      return;
    }

    if (await isRobloxWatcherOwnedByGraftApp()) {
      await resetRobloxWatcherFallbackBaseline();
      return;
    }
    if (revision !== robloxWatcherFallbackRevision) return;

    const identities = await resolveRobloxWatcherIdentities(whitelist);
    if (revision !== robloxWatcherFallbackRevision || identities.size === 0) return;
    const response = await fetch("https://presence.roblox.com/v1/presence/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ userIds: [...identities.keys()] }),
    });
    if (!response.ok) throw new Error(`Presence request failed (${response.status})`);
    const payload = await response.json();
    const rawSnapshots = (Array.isArray(payload?.userPresences) ? payload.userPresences : [])
      .map((row) => {
        const userId = Number(row?.userId);
        if (!Number.isFinite(userId) || userId <= 0) return null;
        return {
          userId,
          username: identities.get(userId) || `User ${userId}`,
          presenceType: Number(row?.userPresenceType) || 0,
          lastLocation: String(row?.lastLocation || "").trim(),
          placeId: row?.placeId == null ? null : Number(row.placeId),
          universeId: row?.universeId == null ? null : Number(row.universeId),
          gameId: row?.gameId == null ? null : String(row.gameId),
        };
      })
      .filter(Boolean);
    const snapshots = settings.robloxPlayerWatcherShowExactGame
      ? await addExactRobloxGameNames(rawSnapshots)
      : rawSnapshots;

    if (revision !== robloxWatcherFallbackRevision || await isRobloxWatcherOwnedByGraftApp()) {
      await resetRobloxWatcherFallbackBaseline();
      return;
    }

    const [sessionState, localState] = await Promise.all([
      storageGet("session", { [ROBLOX_WATCHER_FALLBACK_SEEDED_KEY]: false }),
      storageGet("local", { robloxPlayerWatcherLastPresenceByUserId: {} }),
    ]);
    if (revision !== robloxWatcherFallbackRevision) return;
    const previous = sessionState[ROBLOX_WATCHER_FALLBACK_SEEDED_KEY]
      ? localState.robloxPlayerWatcherLastPresenceByUserId || {}
      : {};
    const { events, nextByUserId } = diffRobloxWatcherPresence(previous, snapshots);
    await Promise.all([
      storageSet("local", { robloxPlayerWatcherLastPresenceByUserId: nextByUserId }),
      storageSet("session", { [ROBLOX_WATCHER_FALLBACK_SEEDED_KEY]: true }),
    ]);
    if (revision !== robloxWatcherFallbackRevision) return;

    for (const event of events) {
      const enabled = event.kind === "online"
        ? settings.robloxPlayerWatcherNotifyOnline
        : event.kind === "offline"
          ? settings.robloxPlayerWatcherNotifyOffline
          : settings.robloxPlayerWatcherNotifyJoinGame;
      if (enabled) await createRobloxPlayerWatcherNotification(event);
    }
  } catch (error) {
    console.warn("[Graft][Roblox Player Watcher] Background poll failed; retrying on the next alarm:", error);
  } finally {
    robloxWatcherFallbackPolling = false;
  }
}

async function canCreateRobloxPlayerWatcherNotification(kind, userId) {
  const toggleKey =
    kind === "online"
      ? "robloxPlayerWatcherNotifyOnline"
      : kind === "offline"
        ? "robloxPlayerWatcherNotifyOffline"
        : "robloxPlayerWatcherNotifyJoinGame";

  const stored = await new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        robloxPlayerWatcherEnabled: false,
        robloxPlayerWatcherNotifyOnline: true,
        robloxPlayerWatcherNotifyOffline: true,
        robloxPlayerWatcherNotifyJoinGame: true,
        robloxPlayerWatcherAntiSpamEnabled: true,
        robloxPlayerWatcherWhitelist: [],
      },
      (settings) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(settings);
      }
    );
  });

  if (!stored?.robloxPlayerWatcherEnabled || !stored[toggleKey]) {
    return false;
  }

  const whitelist = Array.isArray(stored.robloxPlayerWatcherWhitelist)
    ? stored.robloxPlayerWatcherWhitelist
        .map(normalizeRobloxWatcherEntry)
        .filter(Boolean)
    : [];
  if (whitelist.some((entry) => /^\d+$/.test(entry) && Number(entry) === userId)) {
    return true;
  }

  const resolvedIds = await new Promise((resolve) => {
    chrome.storage.local.get(
      { robloxPlayerWatcherResolvedIdsByEntry: {} },
      (localStored) => {
        if (chrome.runtime.lastError) {
          resolve({});
          return;
        }
        resolve(localStored.robloxPlayerWatcherResolvedIdsByEntry || {});
      }
    );
  });

  return whitelist.some(
    (entry) => Number(resolvedIds[entry]) === Number(userId)
  );
}

async function createRobloxPlayerWatcherNotification(event) {
  if (!event || typeof event !== "object") {
    return { ok: false, error: "Missing presence event" };
  }

  const kind = String(event.kind || "");
  const snapshot = event.snapshot && typeof event.snapshot === "object"
    ? event.snapshot
    : null;
  if (!snapshot) {
    return { ok: false, error: "Missing presence snapshot" };
  }

  const userId = Number(snapshot.userId);
  const username = String(snapshot.username || `User ${userId}`).trim();
  const location = String(snapshot.lastLocation || "").trim();
  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false, error: "Invalid user id" };
  }

  let title = "";
  let message = "";
  let notificationIdPrefix = "";

  if (kind === "online") {
    notificationIdPrefix = `roblox-watcher-${userId}-online`;
    title = `${username} is online`;
    message = location
      ? `${username} came online (${location}).`
      : `${username} came online on Roblox.`;
  } else if (kind === "offline") {
    notificationIdPrefix = `roblox-watcher-${userId}-offline`;
    title = `${username} went offline`;
    message = `${username} is no longer online on Roblox.`;
  } else if (kind === "join-game") {
    notificationIdPrefix = `roblox-watcher-${userId}-join-game`;
    title = `${username} joined a game`;
    message = location
      ? `${username} joined ${location}.`
      : `${username} joined a Roblox experience.`;
  } else {
    return { ok: false, error: "Unknown presence event" };
  }

  if (!(await canCreateRobloxPlayerWatcherNotification(kind, userId))) {
    return { ok: false, error: "Watcher disabled or player not watched" };
  }

  if (kind === "join-game") {
    const [syncState, sessionState] = await Promise.all([
      storageGet("sync", { robloxPlayerWatcherAntiSpamEnabled: true }),
      storageGet("session", { [ROBLOX_WATCHER_LAST_JOIN_NOTIFY_KEY]: {} }),
    ]);
    const lastJoinNotifyAtByUserId = sessionState[ROBLOX_WATCHER_LAST_JOIN_NOTIFY_KEY] || {};
    if (
      !shouldDeliverRobloxWatcherNotification(
        kind,
        userId,
        syncState.robloxPlayerWatcherAntiSpamEnabled !== false,
        lastJoinNotifyAtByUserId,
        Date.now()
      )
    ) {
      return { ok: true, skipped: true };
    }

    const result = await createGraftNotification({
      idPrefix: notificationIdPrefix,
      title,
      message,
    });
    if (result?.ok) {
      await storageSet("session", {
        [ROBLOX_WATCHER_LAST_JOIN_NOTIFY_KEY]: {
          ...lastJoinNotifyAtByUserId,
          [String(userId)]: Date.now(),
        },
      });
    }
    return result;
  }

  return createGraftNotification({
    idPrefix: notificationIdPrefix,
    title,
    message,
  });
}

async function createRobloxPlayerWatcherTestNotification() {
  return createGraftNotification({
    idPrefix: "roblox-watcher-test",
    title: "Roblox Player Watcher is ready",
    message: "Graft can send Roblox player notifications on this device.",
  });
}

async function createGraftNotification({ idPrefix, title, message }) {
  if (await sendGraftNativeNotification({ id: idPrefix, title, message })) {
    return { ok: true, id: idPrefix, deliveredBy: "graft" };
  }

  if (!chrome.notifications?.create) {
    return { ok: false, error: "Notifications API unavailable" };
  }

  const hasPermission = await new Promise((resolve) => {
    if (!chrome.permissions?.contains) {
      resolve(true);
      return;
    }
    chrome.permissions.contains({ permissions: ["notifications"] }, (result) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(result));
    });
  });
  if (!hasPermission) {
    return { ok: false, error: "Notification permission not granted" };
  }

  const permissionLevel = await new Promise((resolve) => {
    if (!chrome.notifications.getPermissionLevel) {
      resolve("granted");
      return;
    }
    chrome.notifications.getPermissionLevel((level) => {
      if (chrome.runtime.lastError) {
        resolve("denied");
        return;
      }
      resolve(level);
    });
  });
  if (permissionLevel !== "granted") {
    return { ok: false, error: "Notifications are blocked" };
  }

  const notificationId = idPrefix;

  if (chrome.notifications.clear) {
    await new Promise((resolve) => {
      chrome.notifications.clear(notificationId, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    });
  }

  await new Promise((resolve, reject) => {
    chrome.notifications.create(
      notificationId,
      {
        type: "basic",
        iconUrl: chrome.runtime.getURL("src/assets/icons/graft-128.png"),
        title,
        message,
        priority: 1,
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      }
    );
  });

  return { ok: true, id: notificationId, deliveredBy: "chrome" };
}

async function generateGraftAiRecipe(message) {
  const prompt = String(message.prompt || "").trim();
  if (!prompt) {
    return { ok: false, error: "Missing rewrite prompt" };
  }

  const helperConfig = await getLocalSettings({
    graftAiHelperPort: LOCAL_DEFAULT_SETTINGS.graftAiHelperPort,
    graftAiHelperToken: LOCAL_DEFAULT_SETTINGS.graftAiHelperToken,
  });
  const port = normalizeHelperPort(helperConfig.graftAiHelperPort);
  const token = String(helperConfig.graftAiHelperToken || "").trim();

  if (!token) {
    return {
      ok: false,
      error: "Start graft-ai-helper and paste its local token in Graft settings.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/rewrite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt,
        context: message.context || {},
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: "Helper token was rejected." };
      }
      if (response.status === 429 || response.status === 503) {
        return { ok: false, retryable: true, error: "Helper is busy. Try again in a moment." };
      }
      return {
        ok: false,
        error: `Helper request failed: ${response.status}`,
      };
    }

    const payload = await response.json();
    if (!payload || typeof payload !== "object") {
      return { ok: false, error: "Helper returned an invalid response." };
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      return { ok: false, retryable: true, error: "AI rewrite timed out." };
    }
    return {
      ok: false,
      retryable: true,
      error: "Could not reach graft-ai-helper on localhost.",
    };
  } finally {
    clearTimeout(timer);
  }
}

function getLocalSettings(defaults) {
  return new Promise((resolve) => {
    chrome.storage.local.get(defaults, (stored) => {
      if (chrome.runtime.lastError) {
        resolve(defaults);
        return;
      }
      resolve({ ...defaults, ...stored });
    });
  });
}

function normalizeHelperPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    return LOCAL_DEFAULT_SETTINGS.graftAiHelperPort;
  }
  return port;
}

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
