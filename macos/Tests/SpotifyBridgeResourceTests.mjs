import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const primaryURL = "https://spclient.wg.spotify.com/presence-view/v1/buddylist";
const fallbackURL = "https://guc-spclient.spotify.com/presence-view/v1/buddylist";
const feedURL = "https://spclient.wg.spotify.com/listening-activity/v1/feed";
const profileURL = "https://spclient.wg.spotify.com/user-profile-view/v3/profile";

function row(userURI, displayName, trackURI, trackName, timestamp) {
  return {
    timestamp,
    user: { uri: userURI, name: displayName },
    track: {
      uri: trackURI,
      name: trackName,
      artist: { name: "Artist" },
    },
  };
}

function activity(userURI, trackURI, timestamp) {
  return {
    userEntity: {
      uri: userURI,
      activity: { entityUri: trackURI, timestamp },
    },
  };
}

function track(uri, name, artist, album = "Album") {
  return {
    uri,
    name,
    albumOfTrack: {
      uri: "spotify:album:test",
      name: album,
      coverArt: { sources: [{ width: 640, url: "https://i.scdn.co/image/test" }] },
    },
    firstArtist: {
      items: [{ uri: "spotify:artist:test", profile: { name: artist } }],
    },
  };
}

async function runBridge(responses, tracks = {}) {
  const requests = [];
  const posts = [];
  const source = await readFile(
    new URL("../Resources/graft-spotify-bridge.js", import.meta.url),
    "utf8",
  );
  const context = {
    clearTimeout() {},
    console,
    Date,
    fetch: async (_url, options) => {
      posts.push(JSON.parse(options.body));
    },
    setTimeout() {},
    Spicetify: {
      GraphQL: { Definitions: { getTrack: {} } },
      Platform: {
        PlatformData: { client_version_string: "test" },
        GraphQLLoader: async (_definition, { uri }) => ({
          data: { trackUnion: tracks[uri] },
        }),
        RequestBuilder: {
          build() {
            let url;
            let host;
            return {
              fromURL(value) {
                url = value;
                return this;
              },
              withBody() { return this; },
              withEndpointIdentifier() { return this; },
              withHost(value) {
                host = value;
                return this;
              },
              withJsonContentType() { return this; },
              withMethod() { return this; },
              withoutMarket() { return this; },
              withPath(value) {
                url = `${host}${value}`;
                return this;
              },
              async send() {
                requests.push(url);
                const response = responses[url];
                if (response instanceof Error) throw response;
                return { body: response };
              },
            };
          },
        },
      },
    },
  };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  for (let attempt = 0; attempt < 20 && posts.length === 0; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  return { requests, payload: posts[0] };
}

test("uses Spotify's complete listening activity feed", async () => {
  const csh = "spotify:user:csh";
  const hannah = "spotify:user:hannah";
  const cshTrack = "spotify:track:csh";
  const hannahTrack = "spotify:track:hannah";
  const { requests, payload } = await runBridge({
    [feedURL]: {
      entities: [
        activity(csh, cshTrack, "2026-08-27T11:52:01.582Z"),
        activity(hannah, hannahTrack, "2026-08-23T21:54:21.569Z"),
      ],
    },
    [`${profileURL}/csh`]: { uri: csh, name: "C$shScar", image_url: "" },
    [`${profileURL}/hannah`]: { uri: hannah, name: "Hannah", image_url: "" },
  }, {
    [cshTrack]: track(cshTrack, "This Could Be Us", "Rae Sremmurd", "SremmLife"),
    [hannahTrack]: track(hannahTrack, "OH!", "MICO", "MICO Popular"),
  });

  assert.deepEqual(requests, [feedURL, `${profileURL}/csh`, `${profileURL}/hannah`]);
  assert.equal(payload.bridgeVersion, "3");
  assert.equal(payload.capability, "ready");
  assert.deepEqual(
    payload.friends.map(({ displayName, trackName }) => ({ displayName, trackName })),
    [
      { displayName: "C$shScar", trackName: "This Could Be Us" },
      { displayName: "Hannah", trackName: "OH!" },
    ],
  );
});

test("merges legacy endpoints when the modern feed is unavailable", async () => {
  const { requests, payload } = await runBridge({
    [feedURL]: new Error("modern feed unavailable"),
    [primaryURL]: {
      friends: [row("spotify:user:v", "V", "spotify:track:old", "Old", 100)],
    },
    [fallbackURL]: {
      friends: [
        row("spotify:user:v", "V", "spotify:track:new", "New", 200),
        row("spotify:user:hannah", "Hannah", "spotify:track:two", "Two", 150),
      ],
    },
  });

  assert.deepEqual(requests, [feedURL, primaryURL, fallbackURL]);
  assert.equal(payload.bridgeVersion, "3");
  assert.equal(payload.capability, "ready");
  assert.deepEqual(
    payload.friends.map(({ userURI, trackURI }) => ({ userURI, trackURI })),
    [
      { userURI: "spotify:user:v", trackURI: "spotify:track:new" },
      { userURI: "spotify:user:hannah", trackURI: "spotify:track:two" },
    ],
  );
});

test("keeps data from one endpoint when the other endpoint fails", async () => {
  const { payload } = await runBridge({
    [feedURL]: new Error("modern feed unavailable"),
    [primaryURL]: new Error("primary unavailable"),
    [fallbackURL]: {
      friends: [row("spotify:user:hannah", "Hannah", "spotify:track:two", "Two", 150)],
    },
  });

  assert.equal(payload.capability, "ready");
  assert.deepEqual(payload.friends.map(({ displayName }) => displayName), ["Hannah"]);
});
