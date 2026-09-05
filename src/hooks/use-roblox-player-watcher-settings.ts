import {
  DEFAULT_ROBLOX_PLAYER_WATCHER_SETTINGS,
  ensureRobloxWatcherNotificationPermission,
  normalizeWhitelist,
  robloxWatcherNotificationPermissionMessage,
  resolveRobloxWatcherAccount,
  sendRobloxWatcherTestNotification,
  type RobloxWatcherNotificationPermissionReason,
} from "@/lib/roblox-player-watcher";
import { useCallback, useEffect, useState } from "react";

type Status = { message: string; isError?: boolean } | null;

type WatcherSettings = typeof DEFAULT_ROBLOX_PLAYER_WATCHER_SETTINGS;

export function useRobloxPlayerWatcherSettings(config: {
  variant: "popup" | "options";
}) {
  const [enabled, setEnabled] = useState(false);
  const [notifyOnline, setNotifyOnline] = useState(true);
  const [notifyOffline, setNotifyOffline] = useState(true);
  const [notifyJoinGame, setNotifyJoinGame] = useState(true);
  const [showExactGame, setShowExactGame] = useState(false);
  const [antiSpamEnabled, setAntiSpamEnabled] = useState(true);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [whitelistInput, setWhitelistInput] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [notificationPermissionReady, setNotificationPermissionReady] =
    useState(true);
  const [notificationPermissionReason, setNotificationPermissionReason] =
    useState<RobloxWatcherNotificationPermissionReason | null>(null);
  const [sendingTestNotification, setSendingTestNotification] = useState(false);
  const [addingWhitelistEntry, setAddingWhitelistEntry] = useState(false);
  const isOptions = config.variant === "options";
  const variant = config.variant;

  const refreshNotificationPermission = useCallback(async () => {
    const ensured = await ensureRobloxWatcherNotificationPermission({
      interactive: false,
    });
    setNotificationPermissionReady(ensured.ok);
    setNotificationPermissionReason(ensured.ok ? null : ensured.reason);
    return ensured.ok;
  }, []);

  useEffect(() => {
    chrome.storage.sync.get(DEFAULT_ROBLOX_PLAYER_WATCHER_SETTINGS, (stored) => {
      if (chrome.runtime.lastError) {
        setStatus({
          message: isOptions ? "Failed to load settings." : "Could not load.",
          isError: true,
        });
        return;
      }
      setEnabled(Boolean(stored.robloxPlayerWatcherEnabled));
      setNotifyOnline(stored.robloxPlayerWatcherNotifyOnline !== false);
      setNotifyOffline(stored.robloxPlayerWatcherNotifyOffline !== false);
      setNotifyJoinGame(stored.robloxPlayerWatcherNotifyJoinGame !== false);
      setShowExactGame(Boolean(stored.robloxPlayerWatcherShowExactGame));
      setAntiSpamEnabled(stored.robloxPlayerWatcherAntiSpamEnabled !== false);
      setWhitelist(normalizeWhitelist(stored.robloxPlayerWatcherWhitelist));
    });
    void refreshNotificationPermission();
  }, [isOptions, refreshNotificationPermission]);

  const save = useCallback(
    (patch: WatcherSettings) => {
      chrome.storage.sync.set(patch, () => {
        if (chrome.runtime.lastError) {
          setStatus({
            message: isOptions ? "Failed to save settings." : "Could not save.",
            isError: true,
          });
          return;
        }
        setEnabled(patch.robloxPlayerWatcherEnabled);
        setNotifyOnline(patch.robloxPlayerWatcherNotifyOnline);
        setNotifyOffline(patch.robloxPlayerWatcherNotifyOffline);
        setNotifyJoinGame(patch.robloxPlayerWatcherNotifyJoinGame);
        setShowExactGame(patch.robloxPlayerWatcherShowExactGame);
        setAntiSpamEnabled(patch.robloxPlayerWatcherAntiSpamEnabled);
        setWhitelist(patch.robloxPlayerWatcherWhitelist);
        setStatus({ message: isOptions ? "Settings saved." : "Saved." });
        window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
      });
    },
    [isOptions]
  );

  const persist = useCallback(
    (patch: Partial<WatcherSettings>) => {
      save({
        robloxPlayerWatcherEnabled: enabled,
        robloxPlayerWatcherNotifyOnline: notifyOnline,
        robloxPlayerWatcherNotifyOffline: notifyOffline,
        robloxPlayerWatcherNotifyJoinGame: notifyJoinGame,
        robloxPlayerWatcherShowExactGame: showExactGame,
        robloxPlayerWatcherAntiSpamEnabled: antiSpamEnabled,
        robloxPlayerWatcherWhitelist: whitelist,
        ...patch,
      });
    },
    [
      antiSpamEnabled,
      enabled,
      notifyJoinGame,
      notifyOffline,
      notifyOnline,
      save,
      showExactGame,
      whitelist,
    ]
  );

  const persistEnabled = useCallback(
    (value: boolean) => {
      persist({ robloxPlayerWatcherEnabled: value });
    },
    [persist]
  );

  const requestNotificationPermission = useCallback(async () => {
    const ensured = await ensureRobloxWatcherNotificationPermission({
      interactive: true,
    });
    setNotificationPermissionReady(ensured.ok);
    setNotificationPermissionReason(ensured.ok ? null : ensured.reason);
    if (!ensured.ok) {
      setStatus({
        message: robloxWatcherNotificationPermissionMessage(
          ensured.reason,
          variant
        ),
        isError: true,
      });
      return false;
    }
    setStatus({
      message: isOptions ? "Notification permission granted." : "Permission granted.",
    });
    window.setTimeout(() => setStatus(null), isOptions ? 1200 : 900);
    return true;
  }, [isOptions, variant]);

  const setMasterEnabled = useCallback(
    async (value: boolean) => {
      if (!value) {
        persistEnabled(false);
        return;
      }

      const allowed = await requestNotificationPermission();
      if (!allowed) {
        return;
      }

      persistEnabled(true);
    },
    [persistEnabled, requestNotificationPermission]
  );

  const testNotification = useCallback(async () => {
    setSendingTestNotification(true);
    try {
      const allowed = await requestNotificationPermission();
      if (!allowed) {
        return;
      }

      const result = await sendRobloxWatcherTestNotification();
      setStatus(
        result.ok
          ? {
              message: isOptions
                ? "Test notification sent."
                : "Test sent.",
            }
          : {
              message: result.error,
              isError: true,
            }
      );
    } finally {
      setSendingTestNotification(false);
    }
  }, [isOptions, requestNotificationPermission]);

  const addWhitelistEntry = useCallback(async () => {
    if (addingWhitelistEntry) return;
    setAddingWhitelistEntry(true);
    const resolved = await resolveRobloxWatcherAccount(whitelistInput);
    if (!resolved.ok) {
      setStatus({ message: resolved.error, isError: true });
      setAddingWhitelistEntry(false);
      return;
    }
    const next = normalizeWhitelist([...whitelist, resolved.username]);
    if (next.length === whitelist.length) {
      setStatus({ message: "That player is already watched.", isError: true });
      setAddingWhitelistEntry(false);
      return;
    }
    setWhitelistInput("");
    persist({ robloxPlayerWatcherWhitelist: next });
    setAddingWhitelistEntry(false);
  }, [addingWhitelistEntry, persist, whitelist, whitelistInput]);

  return {
    robloxPlayerWatcherEnabled: enabled,
    robloxPlayerWatcherNotifyOnline: notifyOnline,
    robloxPlayerWatcherNotifyOffline: notifyOffline,
    robloxPlayerWatcherNotifyJoinGame: notifyJoinGame,
    robloxPlayerWatcherShowExactGame: showExactGame,
    robloxPlayerWatcherAntiSpamEnabled: antiSpamEnabled,
    robloxPlayerWatcherWhitelist: whitelist,
    whitelistInput,
    setWhitelistInput,
    status,
    notificationPermissionReady,
    notificationPermissionReason,
    sendingTestNotification,
    addingWhitelistEntry,
    setMasterEnabled,
    setNotifyOnlineEnabled: (value: boolean) => {
      persist({ robloxPlayerWatcherNotifyOnline: value });
    },
    setNotifyOfflineEnabled: (value: boolean) => {
      persist({ robloxPlayerWatcherNotifyOffline: value });
    },
    setNotifyJoinGameEnabled: (value: boolean) => {
      persist({ robloxPlayerWatcherNotifyJoinGame: value });
    },
    setShowExactGameEnabled: (value: boolean) => {
      persist({ robloxPlayerWatcherShowExactGame: value });
    },
    setAntiSpamEnabled: (value: boolean) => {
      persist({ robloxPlayerWatcherAntiSpamEnabled: value });
    },
    addWhitelistEntry,
    removeWhitelistEntry: (entry: string) => {
      persist({
        robloxPlayerWatcherWhitelist: whitelist.filter((item) => item !== entry),
      });
    },
    requestNotificationPermission,
    testNotification,
  };
}
