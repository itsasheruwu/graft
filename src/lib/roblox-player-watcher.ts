export const ROBLOX_PLAYER_WATCHER_POLL_MS = 30_000;
export const ROBLOX_WATCHER_ANTI_SPAM_COOLDOWN_MS = 3 * 60 * 1000;

export const DEFAULT_ROBLOX_PLAYER_WATCHER_SETTINGS = {
  robloxPlayerWatcherEnabled: false,
  robloxPlayerWatcherNotifyOnline: true,
  robloxPlayerWatcherNotifyOffline: true,
  robloxPlayerWatcherNotifyJoinGame: true,
  robloxPlayerWatcherShowExactGame: false,
  robloxPlayerWatcherAntiSpamEnabled: true,
  robloxPlayerWatcherWhitelist: [] as string[],
};

export type RobloxPlayerWatcherSettings =
  typeof DEFAULT_ROBLOX_PLAYER_WATCHER_SETTINGS;

export type RobloxPresenceType = 0 | 1 | 2 | 3 | 4;

export type RobloxPresenceSnapshot = {
  userId: number;
  username: string;
  presenceType: RobloxPresenceType;
  lastLocation: string;
  placeId: number | null;
  universeId: number | null;
  gameId: string | null;
};

export type RobloxPresenceEventKind = "online" | "offline" | "join-game";

export type RobloxPresenceEvent = {
  kind: RobloxPresenceEventKind;
  snapshot: RobloxPresenceSnapshot;
  previous: RobloxPresenceSnapshot | null;
};

const MAX_WHITELIST = 50;

export function isRobloxHostname(hostname: string) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

  return (
    host === "roblox.com" ||
    host === "www.roblox.com" ||
    host.endsWith(".roblox.com")
  );
}

export function normalizeWhitelistEntry(raw: string) {
  const value = String(raw || "").trim();
  if (!value) {
    return "";
  }

  if (/^\d+$/.test(value)) {
    return value;
  }

  // Accept profile URLs like https://www.roblox.com/users/123/profile
  const profileMatch = value.match(/\/users\/(\d+)(?:\/|$)/i);
  if (profileMatch) {
    return profileMatch[1];
  }

  // Accept @Username or plain username
  return value.replace(/^@+/, "");
}

export function normalizeWhitelist(entries: unknown) {
  if (!Array.isArray(entries)) {
    return [] as string[];
  }

  const seen = new Set<string>();
  const out: string[] = [];

  for (const entry of entries) {
    const normalized = normalizeWhitelistEntry(String(entry ?? ""));
    const dedupeKey = normalized.toLowerCase();
    if (!normalized || seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    out.push(normalized);
    if (out.length >= MAX_WHITELIST) {
      break;
    }
  }

  return out;
}

export async function resolveRobloxWatcherAccount(entry: string) {
  const normalized = normalizeWhitelistEntry(entry);
  if (!normalized) {
    return { ok: false as const, error: "Enter a Roblox username, user ID, or profile link." };
  }
  try {
    const response = await chrome.runtime.sendMessage({
      type: "roblox-player-watcher:resolve-account",
      entry: normalized,
    });
    if (!response?.ok || typeof response.username !== "string") {
      return {
        ok: false as const,
        error: String(response?.error || "That Roblox account could not be found."),
      };
    }
    return { ok: true as const, username: response.username };
  } catch {
    return { ok: false as const, error: "Graft could not reach Roblox. Try again." };
  }
}

export function isOfflinePresence(presenceType: number) {
  return Number(presenceType) === 0;
}

export function isInGamePresence(presenceType: number) {
  return Number(presenceType) === 2;
}

export function presenceLabel(presenceType: number) {
  switch (Number(presenceType)) {
    case 0:
      return "Offline";
    case 1:
      return "Online";
    case 2:
      return "In a game";
    case 3:
      return "In Studio";
    case 4:
      return "Invisible";
    default:
      return "Unknown";
  }
}

function sameGameSession(
  previous: RobloxPresenceSnapshot | null,
  next: RobloxPresenceSnapshot
) {
  if (!previous || !isInGamePresence(previous.presenceType)) {
    return false;
  }

  if (previous.gameId && next.gameId) {
    return previous.gameId === next.gameId;
  }

  if (previous.placeId != null && next.placeId != null) {
    return previous.placeId === next.placeId;
  }

  if (previous.universeId != null && next.universeId != null) {
    return previous.universeId === next.universeId;
  }

  return (
    Boolean(previous.lastLocation) &&
    previous.lastLocation === next.lastLocation
  );
}

export function diffPresenceSnapshots(
  previousByUserId: Record<string, RobloxPresenceSnapshot>,
  nextSnapshots: RobloxPresenceSnapshot[]
) {
  const events: RobloxPresenceEvent[] = [];
  const nextByUserId: Record<string, RobloxPresenceSnapshot> = {};

  for (const next of nextSnapshots) {
    const key = String(next.userId);
    const previous = previousByUserId[key] ?? null;
    nextByUserId[key] = next;

    if (!previous) {
      // First observation seeds state without notifying.
      continue;
    }

    const wasOffline = isOfflinePresence(previous.presenceType);
    const isOffline = isOfflinePresence(next.presenceType);
    const joinedGame =
      isInGamePresence(next.presenceType) &&
      !sameGameSession(previous, next);

    if (wasOffline && !isOffline && !joinedGame) {
      events.push({ kind: "online", snapshot: next, previous });
    } else if (!wasOffline && isOffline) {
      events.push({ kind: "offline", snapshot: next, previous });
    }

    if (joinedGame) {
      events.push({ kind: "join-game", snapshot: next, previous });
    }
  }

  return { events, nextByUserId };
}

export function buildNotificationPayload(event: RobloxPresenceEvent) {
  const name = event.snapshot.username || `User ${event.snapshot.userId}`;
  const location = String(event.snapshot.lastLocation || "").trim();

  if (event.kind === "online") {
    return {
      id: `roblox-watcher-${event.snapshot.userId}-online`,
      title: `${name} is online`,
      message: location
        ? `${name} came online (${location}).`
        : `${name} came online on Roblox.`,
    };
  }

  if (event.kind === "offline") {
    return {
      id: `roblox-watcher-${event.snapshot.userId}-offline`,
      title: `${name} went offline`,
      message: `${name} is no longer online on Roblox.`,
    };
  }

  return {
    id: `roblox-watcher-${event.snapshot.userId}-join-game`,
    title: `${name} joined a game`,
    message: location
      ? `${name} joined ${location}.`
      : `${name} joined a Roblox experience.`,
  };
}

export function shouldNotifyEvent(
  kind: RobloxPresenceEventKind,
  settings: Pick<
    RobloxPlayerWatcherSettings,
    | "robloxPlayerWatcherNotifyOnline"
    | "robloxPlayerWatcherNotifyOffline"
    | "robloxPlayerWatcherNotifyJoinGame"
  >
) {
  if (kind === "online") {
    return Boolean(settings.robloxPlayerWatcherNotifyOnline);
  }
  if (kind === "offline") {
    return Boolean(settings.robloxPlayerWatcherNotifyOffline);
  }
  return Boolean(settings.robloxPlayerWatcherNotifyJoinGame);
}

export function shouldDeliverRobloxWatcherNotification(options: {
  kind: RobloxPresenceEventKind;
  userId: number;
  antiSpamEnabled: boolean;
  lastJoinNotifyAtByUserId: Record<string, number>;
  now?: number;
}) {
  if (!options.antiSpamEnabled || options.kind !== "join-game") {
    return true;
  }
  const last = Number(options.lastJoinNotifyAtByUserId[String(options.userId)]);
  if (!Number.isFinite(last) || last <= 0) {
    return true;
  }
  return (options.now ?? Date.now()) - last >= ROBLOX_WATCHER_ANTI_SPAM_COOLDOWN_MS;
}

export const ROBLOX_WATCHER_NOTIFICATION_PERMISSION = {
  permissions: ["notifications"],
} as const;

export type RobloxWatcherNotificationPermissionReason =
  | "unsupported"
  | "denied"
  | "blocked";

export type RobloxWatcherNotificationPermissionResult =
  | { ok: true }
  | { ok: false; reason: RobloxWatcherNotificationPermissionReason };

export function robloxWatcherNotificationPermissionMessage(
  reason: RobloxWatcherNotificationPermissionReason,
  variant: "popup" | "options" = "options"
) {
  if (reason === "unsupported") {
    return variant === "popup"
      ? "Notifications unavailable here."
      : "This browser cannot show Graft notifications.";
  }
  if (reason === "blocked") {
    return variant === "popup"
      ? "Notifications blocked for Graft. Enable them in Chrome settings."
      : "Chrome or your system is blocking Graft notifications. Enable them in browser or OS notification settings.";
  }
  return variant === "popup"
    ? "Notification permission is required."
    : "Allow notification permission so Graft can alert you about watched players.";
}

function permissionsApiAvailable() {
  return typeof chrome.permissions?.contains === "function" && typeof chrome.permissions?.request === "function";
}

export async function hasRobloxWatcherNotificationPermission() {
  if (!permissionsApiAvailable()) {
    return Boolean(chrome.notifications?.create);
  }

  return chrome.permissions.contains({
    permissions: [...ROBLOX_WATCHER_NOTIFICATION_PERMISSION.permissions],
  });
}

export async function getRobloxWatcherNotificationLevel() {
  if (!chrome.notifications?.getPermissionLevel) {
    return "granted" as const;
  }

  return new Promise<"granted" | "denied">((resolve) => {
    chrome.notifications.getPermissionLevel((level) => resolve(level));
  });
}

export async function ensureRobloxWatcherNotificationPermission(options?: {
  interactive?: boolean;
}): Promise<RobloxWatcherNotificationPermissionResult> {
  const interactive = options?.interactive !== false;

  try {
    const granted =
      interactive && chrome.permissions?.request
        ? await chrome.permissions.request({
            permissions: [
              ...ROBLOX_WATCHER_NOTIFICATION_PERMISSION.permissions,
            ],
          })
        : await hasRobloxWatcherNotificationPermission();

    if (!granted) {
      return { ok: false, reason: "denied" };
    }

    if (!chrome.notifications?.create) {
      return { ok: false, reason: "unsupported" };
    }

    const level = await getRobloxWatcherNotificationLevel();
    if (level !== "granted") {
      return { ok: false, reason: "blocked" };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "denied" };
  }
}

export type RobloxWatcherTestNotificationResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendRobloxWatcherTestNotification() {
  try {
    const result = (await chrome.runtime.sendMessage({
      type: "roblox-player-watcher:test-notification",
    })) as RobloxWatcherTestNotificationResult | undefined;

    if (!result || result.ok !== true) {
      return {
        ok: false,
        error:
          result && "error" in result
            ? result.error
            : "Graft did not receive a notification response.",
      } as const;
    }

    return result;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Graft could not send the test notification.",
    } as const;
  }
}
