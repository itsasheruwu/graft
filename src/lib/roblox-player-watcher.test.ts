import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildNotificationPayload,
  DEFAULT_ROBLOX_PLAYER_WATCHER_SETTINGS,
  diffPresenceSnapshots,
  ensureRobloxWatcherNotificationPermission,
  isRobloxHostname,
  normalizeWhitelist,
  normalizeWhitelistEntry,
  resolveRobloxWatcherAccount,
  robloxWatcherNotificationPermissionMessage,
  sendRobloxWatcherTestNotification,
  shouldDeliverRobloxWatcherNotification,
  shouldNotifyEvent,
  type RobloxPresenceSnapshot,
} from "@/lib/roblox-player-watcher";

function snapshot(
  partial: Partial<RobloxPresenceSnapshot> &
    Pick<RobloxPresenceSnapshot, "userId" | "presenceType">
): RobloxPresenceSnapshot {
  return {
    username: partial.username ?? `user${partial.userId}`,
    lastLocation: partial.lastLocation ?? "",
    placeId: partial.placeId ?? null,
    universeId: partial.universeId ?? null,
    gameId: partial.gameId ?? null,
    userId: partial.userId,
    presenceType: partial.presenceType,
  };
}

describe("Roblox Player Watcher settings", () => {
  it("is opt-in by default with notify flags on", () => {
    expect(DEFAULT_ROBLOX_PLAYER_WATCHER_SETTINGS).toEqual({
      robloxPlayerWatcherEnabled: false,
      robloxPlayerWatcherNotifyOnline: true,
      robloxPlayerWatcherNotifyOffline: true,
      robloxPlayerWatcherNotifyJoinGame: true,
      robloxPlayerWatcherShowExactGame: false,
      robloxPlayerWatcherAntiSpamEnabled: true,
      robloxPlayerWatcherWhitelist: [],
    });
  });

  it("only scopes the pack to Roblox hosts", () => {
    expect(isRobloxHostname("www.roblox.com")).toBe(true);
    expect(isRobloxHostname("roblox.com")).toBe(true);
    expect(isRobloxHostname("web.roblox.com")).toBe(true);
    expect(isRobloxHostname("x.com")).toBe(false);
  });

});

describe("whitelist normalization", () => {
  it("normalizes usernames, ids, and profile urls", () => {
    expect(normalizeWhitelistEntry("Builderman")).toBe("Builderman");
    expect(normalizeWhitelistEntry("@Builderman")).toBe("Builderman");
    expect(normalizeWhitelistEntry("12345")).toBe("12345");
    expect(
      normalizeWhitelistEntry("https://www.roblox.com/users/12345/profile")
    ).toBe("12345");
  });

  it("dedupes and bounds whitelist entries", () => {
    expect(
      normalizeWhitelist(["Builderman", "@builderman", "1", "1", ""])
    ).toEqual(["Builderman", "1"]);
  });
});

describe("account resolution", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stores the canonical username returned for a user ID", async () => {
    vi.stubGlobal("chrome", {
      runtime: { sendMessage: vi.fn(async () => ({ ok: true, username: "Builderman" })) },
    });
    await expect(resolveRobloxWatcherAccount("156")).resolves.toEqual({
      ok: true,
      username: "Builderman",
    });
  });
});

describe("presence diffs", () => {
  it("seeds first observations without events", () => {
    const next = [snapshot({ userId: 1, presenceType: 1 })];
    const result = diffPresenceSnapshots({}, next);
    expect(result.events).toEqual([]);
    expect(result.nextByUserId["1"]?.presenceType).toBe(1);
  });

  it("emits online and offline transitions", () => {
    const previous = {
      "1": snapshot({ userId: 1, presenceType: 0, username: "Ash" }),
    };
    const online = diffPresenceSnapshots(previous, [
      snapshot({ userId: 1, presenceType: 1, username: "Ash" }),
    ]);
    expect(online.events.map((event) => event.kind)).toEqual(["online"]);

    const offline = diffPresenceSnapshots(online.nextByUserId, [
      snapshot({ userId: 1, presenceType: 0, username: "Ash" }),
    ]);
    expect(offline.events.map((event) => event.kind)).toEqual(["offline"]);
  });

  it("treats offline-to-in-game as join only", () => {
    const previous = {
      "1": snapshot({ userId: 1, presenceType: 0, username: "Ash" }),
    };
    const result = diffPresenceSnapshots(previous, [
      snapshot({
        userId: 1,
        presenceType: 2,
        username: "Ash",
        lastLocation: "Adopt Me",
        placeId: 10,
        gameId: "abc",
      }),
    ]);
    expect(result.events.map((event) => event.kind)).toEqual(["join-game"]);
  });

  it("emits join-game when entering a game or switching sessions", () => {
    const previous = {
      "1": snapshot({ userId: 1, presenceType: 1, username: "Ash" }),
    };
    const joined = diffPresenceSnapshots(previous, [
      snapshot({
        userId: 1,
        presenceType: 2,
        username: "Ash",
        lastLocation: "Adopt Me",
        placeId: 10,
        gameId: "abc",
      }),
    ]);
    expect(joined.events.map((event) => event.kind)).toEqual(["join-game"]);

    const switched = diffPresenceSnapshots(joined.nextByUserId, [
      snapshot({
        userId: 1,
        presenceType: 2,
        username: "Ash",
        lastLocation: "Brookhaven",
        placeId: 20,
        gameId: "def",
      }),
    ]);
    expect(switched.events.map((event) => event.kind)).toEqual(["join-game"]);

    const sameSession = diffPresenceSnapshots(switched.nextByUserId, [
      snapshot({
        userId: 1,
        presenceType: 2,
        username: "Ash",
        lastLocation: "Brookhaven",
        placeId: 20,
        gameId: "def",
      }),
    ]);
    expect(sameSession.events).toEqual([]);
  });

  it("prunes snapshots that are no longer returned", () => {
    const previous = {
      "1": snapshot({ userId: 1, presenceType: 1 }),
      "2": snapshot({ userId: 2, presenceType: 0 }),
    };

    const result = diffPresenceSnapshots(previous, [
      snapshot({ userId: 1, presenceType: 1 }),
    ]);

    expect(Object.keys(result.nextByUserId)).toEqual(["1"]);
  });
});

describe("notification helpers", () => {
  it("builds stable notification copy", () => {
    const payload = buildNotificationPayload({
      kind: "join-game",
      previous: null,
      snapshot: snapshot({
        userId: 9,
        presenceType: 2,
        username: "Ash",
        lastLocation: "Adopt Me",
      }),
    });
    expect(payload.id).toBe("roblox-watcher-9-join-game");
    expect(payload.title).toBe("Ash joined a game");
    expect(payload.message).toContain("Adopt Me");
  });

  it("respects per-event notify toggles", () => {
    expect(
      shouldNotifyEvent("online", {
        robloxPlayerWatcherNotifyOnline: false,
        robloxPlayerWatcherNotifyOffline: true,
        robloxPlayerWatcherNotifyJoinGame: true,
      })
    ).toBe(false);
    expect(
      shouldNotifyEvent("join-game", DEFAULT_ROBLOX_PLAYER_WATCHER_SETTINGS)
    ).toBe(true);
  });

  it("throttles rapid join-game alerts when anti-spam is on", () => {
    const now = 1_700_000_000_000;
    expect(
      shouldDeliverRobloxWatcherNotification({
        kind: "join-game",
        userId: 9,
        antiSpamEnabled: true,
        lastJoinNotifyAtByUserId: {},
        now,
      })
    ).toBe(true);
    expect(
      shouldDeliverRobloxWatcherNotification({
        kind: "join-game",
        userId: 9,
        antiSpamEnabled: true,
        lastJoinNotifyAtByUserId: { "9": now - 30_000 },
        now,
      })
    ).toBe(false);
    expect(
      shouldDeliverRobloxWatcherNotification({
        kind: "join-game",
        userId: 9,
        antiSpamEnabled: true,
        lastJoinNotifyAtByUserId: { "9": now - 181_000 },
        now,
      })
    ).toBe(true);
    expect(
      shouldDeliverRobloxWatcherNotification({
        kind: "online",
        userId: 9,
        antiSpamEnabled: true,
        lastJoinNotifyAtByUserId: { "9": now - 30_000 },
        now,
      })
    ).toBe(true);
    expect(
      shouldDeliverRobloxWatcherNotification({
        kind: "join-game",
        userId: 9,
        antiSpamEnabled: false,
        lastJoinNotifyAtByUserId: { "9": now - 30_000 },
        now,
      })
    ).toBe(true);
  });
});

describe("notification permission copy", () => {
  it("explains denied and blocked states", () => {
    expect(robloxWatcherNotificationPermissionMessage("denied", "popup")).toContain(
      "permission"
    );
    expect(
      robloxWatcherNotificationPermissionMessage("blocked", "options")
    ).toContain("blocking");
  });
});

describe("notification permission requests", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests interactive permission before any asynchronous preflight", async () => {
    const contains = vi.fn(async () => false);
    const request = vi.fn(async () => true);
    vi.stubGlobal("chrome", {
      permissions: { contains, request },
      notifications: {
        create: vi.fn(),
        getPermissionLevel: (
          callback: (level: "granted" | "denied") => void
        ) => callback("granted"),
      },
    });

    await expect(
      ensureRobloxWatcherNotificationPermission({ interactive: true })
    ).resolves.toEqual({ ok: true });
    expect(request).toHaveBeenCalledOnce();
    expect(contains).not.toHaveBeenCalled();
  });

  it("turns permission request errors into a denied result", async () => {
    vi.stubGlobal("chrome", {
      permissions: {
        contains: vi.fn(async () => false),
        request: vi.fn(async () => {
          throw new Error("User gesture expired");
        }),
      },
      notifications: { create: vi.fn() },
    });

    await expect(
      ensureRobloxWatcherNotificationPermission({ interactive: true })
    ).resolves.toEqual({ ok: false, reason: "denied" });
  });

  it("surfaces test notification delivery failures", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => ({
          ok: false,
          error: "Notifications are blocked",
        })),
      },
    });

    await expect(sendRobloxWatcherTestNotification()).resolves.toEqual({
      ok: false,
      error: "Notifications are blocked",
    });
  });
});
