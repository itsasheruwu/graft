(function graftSpotifyBridge() {
  "use strict";

  const BRIDGE_VERSION = "3";
  const TOKEN = "__GRAFT_BRIDGE_TOKEN__";
  const ENDPOINT = "http://127.0.0.1:__GRAFT_BRIDGE_PORT__/v1/spotify/friends-snapshot";
  const POLL_INTERVAL_MS = 15_000;
  const LISTENING_ACTIVITY_HOST = "https://spclient.wg.spotify.com/listening-activity/v1";
  const LISTENING_ACTIVITY_FEED_URL = `${LISTENING_ACTIVITY_HOST}/feed`;
  const USER_PROFILE_URL = "https://spclient.wg.spotify.com/user-profile-view/v3/profile";
  const PRIMARY_PRESENCE_URL = "https://spclient.wg.spotify.com/presence-view/v1/buddylist";
  const FALLBACK_PRESENCE_URL = "https://guc-spclient.spotify.com/presence-view/v1/buddylist";

  if (globalThis.__graftSpotifyFriendBridge) {
    globalThis.__graftSpotifyFriendBridge.stop();
  }

  let stopped = false;
  let timer = null;
  const profileCache = new Map();
  const trackCache = new Map();

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function imageURL(value) {
    const candidate = text(value);
    if (!candidate) return null;
    if (candidate.startsWith("https://") || candidate.startsWith("http://")) return candidate;
    return candidate.startsWith("spotify:image:")
      ? `https://i.scdn.co/image/${candidate.slice("spotify:image:".length)}`
      : null;
  }

  function activityDate(value) {
    const number = Number(value);
    if (Number.isFinite(number)) {
      const milliseconds = number < 10_000_000_000 ? number * 1000 : number;
      const date = new Date(milliseconds);
      if (!Number.isNaN(date.valueOf())) return date.toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? new Date().toISOString() : parsed.toISOString();
  }

  function normalizeFriend(row) {
    const user = row && row.user;
    const track = row && row.track;
    const artist = track && track.artist;
    if (!user || !track) return null;

    const userURI = text(user.uri);
    const trackURI = text(track.uri);
    const displayName = text(user.name);
    const trackName = text(track.name);
    const artistName = text(artist && artist.name);
    if (!userURI || !trackURI || !displayName || !trackName || !artistName) return null;

    return {
      userURI,
      displayName,
      avatarURL: imageURL(user.imageUrl || user.image_url),
      trackURI,
      trackName,
      artistName,
      contextName: text(track.context && track.context.name) || null,
      contextURI: text(track.context && track.context.uri) || null,
      artworkURL: imageURL(track.imageUrl || track.image_url),
      activityAt: activityDate(row.timestamp),
    };
  }

  function spotifyVersion() {
    return text(
      globalThis.Spicetify?.Platform?.PlatformData?.client_version_string ||
      globalThis.Spicetify?.Platform?.PlatformData?.clientVersion
    ) || null;
  }

  function usernameFromURI(uri) {
    const match = text(uri).match(/^spotify:user:(.+)$/);
    return match ? match[1] : "";
  }

  function largestImage(sources) {
    if (!Array.isArray(sources)) return null;
    return sources.reduce((best, source) => {
      if (!text(source?.url)) return best;
      return !best || Number(source.width || 0) > Number(best.width || 0) ? source : best;
    }, null)?.url ?? null;
  }

  async function cached(cache, key, load) {
    if (cache.has(key)) return cache.get(key);
    const pending = load();
    cache.set(key, pending);
    try {
      return await pending;
    } catch (error) {
      cache.delete(key);
      throw error;
    }
  }

  async function post(payload) {
    try {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Graft-Bridge-Token": TOKEN,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
    } catch (_) {
      // Graft is not running. The next scheduled poll retries silently.
    }
  }

  function mergePresenceResponses(responses) {
    const friendsByUserURI = new Map();
    for (const response of responses) {
      const rows = Array.isArray(response?.friends) ? response.friends : [];
      for (const row of rows) {
        const friend = normalizeFriend(row);
        if (!friend) continue;

        const existing = friendsByUserURI.get(friend.userURI);
        if (!existing || friend.activityAt > existing.activityAt) {
          friendsByUserURI.set(friend.userURI, friend);
        }
      }
    }
    return Array.from(friendsByUserURI.values()).slice(0, 100);
  }

  async function fetchPresenceFrom(url) {
    if (globalThis.Spicetify?.CosmosAsync?.get) {
      return await globalThis.Spicetify.CosmosAsync.get(url);
    }
    if (globalThis.Spicetify?.Platform?.RequestBuilder?.build) {
      const response = await globalThis.Spicetify.Platform.RequestBuilder
        .build()
        .fromURL(url)
        .send();
      return response?.body ?? response;
    }
    throw new Error("Spotify's internal request API is not ready.");
  }

  async function fetchLegacyPresence() {
    let firstError;
    const responses = [];
    for (const url of [PRIMARY_PRESENCE_URL, FALLBACK_PRESENCE_URL]) {
      try {
        responses.push(await fetchPresenceFrom(url));
      } catch (error) {
        firstError ||= error;
      }
    }
    if (responses.length === 0) {
      throw firstError || new Error("Spotify friend activity is unavailable.");
    }
    return mergePresenceResponses(responses);
  }

  async function fetchListeningActivityFeed() {
    if (!globalThis.Spicetify?.Platform?.RequestBuilder?.build) {
      throw new Error("Spotify's listening activity API is not ready.");
    }
    const response = await globalThis.Spicetify.Platform.RequestBuilder
      .build()
      .withHost(LISTENING_ACTIVITY_HOST)
      .withMethod("POST")
      .withoutMarket()
      .withJsonContentType()
      .withPath("/feed")
      .withEndpointIdentifier("/listening-activity/v1/feed")
      .withBody({ unused: true, resultLimit: 100 })
      .send();
    return response?.body ?? response;
  }

  async function fetchProfile(userURI) {
    const username = usernameFromURI(userURI);
    if (!username) throw new Error("Spotify returned an invalid friend URI.");
    return cached(profileCache, username, async () => {
      const response = await globalThis.Spicetify.Platform.RequestBuilder
        .build()
        .fromURL(`${USER_PROFILE_URL}/${encodeURIComponent(username)}`)
        .send();
      const profile = response?.body ?? response;
      if (!text(profile?.name)) throw new Error("Spotify friend profile metadata is unavailable.");
      return profile;
    });
  }

  async function fetchTrack(trackURI) {
    return cached(trackCache, trackURI, async () => {
      const loader = globalThis.Spicetify?.Platform?.GraphQLLoader;
      const definition = globalThis.Spicetify?.GraphQL?.Definitions?.getTrack;
      if (typeof loader !== "function" || !definition) {
        throw new Error("Spotify's track metadata API is not ready.");
      }
      const response = await loader(definition, { uri: trackURI });
      const track = response?.data?.trackUnion;
      if (!track) throw new Error("Spotify track metadata is unavailable.");
      return track;
    });
  }

  async function enrichListeningActivity(entity) {
    const pointer = entity?.userEntity ?? entity?.followEntity;
    const userURI = text(pointer?.uri);
    const trackURI = text(pointer?.activity?.entityUri);
    if (!userURI || !trackURI) return null;

    const [profile, track] = await Promise.all([
      fetchProfile(userURI),
      fetchTrack(trackURI),
    ]);
    const artist = track?.firstArtist?.items?.[0];
    const album = track?.albumOfTrack;
    const displayName = text(profile?.name);
    const trackName = text(track?.name);
    const artistName = text(artist?.profile?.name);
    if (!displayName || !trackName || !artistName) return null;

    const suppliedContextURI = text(pointer.activity.contextUri);
    const albumURI = text(album?.uri);
    return {
      userURI,
      displayName,
      avatarURL: imageURL(profile?.image_url || profile?.imageUrl),
      trackURI,
      trackName,
      artistName,
      contextName: !suppliedContextURI || suppliedContextURI === albumURI
        ? text(album?.name) || null
        : null,
      contextURI: suppliedContextURI || albumURI || null,
      artworkURL: imageURL(largestImage(album?.coverArt?.sources)),
      activityAt: activityDate(pointer.activity.timestamp),
    };
  }

  async function fetchModernPresence() {
    const response = await fetchListeningActivityFeed();
    const entities = Array.isArray(response?.entities) ? response.entities.slice(0, 100) : [];
    const results = await Promise.allSettled(entities.map(enrichListeningActivity));
    const friends = results
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result) => result.value);
    if (entities.length > 0 && friends.length === 0) {
      const failure = results.find((result) => result.status === "rejected");
      throw failure?.reason || new Error("Spotify friend activity metadata is unavailable.");
    }
    return friends;
  }

  async function fetchPresence() {
    try {
      return await fetchModernPresence();
    } catch (modernError) {
      try {
        return await fetchLegacyPresence();
      } catch (_) {
        throw modernError;
      }
    }
  }

  async function poll() {
    if (stopped) return;
    try {
      const friends = await fetchPresence();
      await post({
        bridgeVersion: BRIDGE_VERSION,
        spotifyVersion: spotifyVersion(),
        observedAt: new Date().toISOString(),
        capability: "ready",
        error: null,
        friends,
      });
    } catch (error) {
      await post({
        bridgeVersion: BRIDGE_VERSION,
        spotifyVersion: spotifyVersion(),
        observedAt: new Date().toISOString(),
        capability: "unsupported",
        error: text(error?.message) || "Spotify friend activity is unavailable in this client version.",
        friends: [],
      });
    } finally {
      if (!stopped) timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
  }

  function waitForSpicetify() {
    if (stopped) return;
    if (
      globalThis.Spicetify?.CosmosAsync?.get ||
      (
        globalThis.Spicetify?.Platform?.RequestBuilder?.build &&
        globalThis.Spicetify?.Platform?.GraphQLLoader
      )
    ) {
      poll();
    } else {
      timer = setTimeout(waitForSpicetify, 1_000);
    }
  }

  globalThis.__graftSpotifyFriendBridge = {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
  waitForSpicetify();
})();
