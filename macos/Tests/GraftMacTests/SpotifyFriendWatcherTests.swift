import Foundation
import GraftCore
import Testing
@testable import GraftMac

@Suite("Spotify friend watcher")
struct SpotifyFriendWatcherTests {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    private func snapshot(
        userURI: String = "spotify:user:ash",
        name: String = "Ash",
        trackURI: String = "spotify:track:one",
        track: String = "Friends",
        artist: String = "Chase Atlantic",
        age: TimeInterval = 10
    ) -> SpotifyFriendSnapshot {
        .init(
            userURI: userURI,
            displayName: name,
            avatarURL: nil,
            trackURI: trackURI,
            trackName: track,
            artistName: artist,
            contextName: "The Ankle Biters",
            contextURI: "spotify:playlist:test",
            artworkURL: nil,
            activityAt: now.addingTimeInterval(-age)
        )
    }

    @Test("Normalizes and bounds the whitelist")
    func normalizesWhitelist() {
        let values = [" spotify:user:ash ", "SPOTIFY:USER:ASH", "", "spotify:user:friend"]
        #expect(SpotifyFriendWatcherConfiguration.normalizeWhitelist(values) == [
            "spotify:user:ash", "spotify:user:friend",
        ])
    }

    @Test("Only fresh whitelisted friends are active")
    func filtersActiveFriends() {
        let ash = snapshot()
        let old = snapshot(userURI: "spotify:user:old", age: 15 * 60)
        let stranger = snapshot(userURI: "spotify:user:stranger")
        let result = SpotifyFriendPresenceLogic.activeSnapshots(
            from: [ash, old, stranger],
            whitelist: [ash.userURI, old.userURI],
            at: now
        )
        #expect(Set(result.keys) == Set([ash.userURI]))
    }

    @Test("A missing poll does not imply stopped before the freshness window")
    func retainsBrieflyMissingFriends() {
        let value = snapshot(age: 60)
        let retained = SpotifyFriendPresenceLogic.mergeObservations(
            previous: [value],
            current: [],
            at: now
        )
        let expired = SpotifyFriendPresenceLogic.mergeObservations(
            previous: [value],
            current: [],
            at: now.addingTimeInterval(14 * 60)
        )
        #expect(retained == [value])
        #expect(expired.isEmpty)
    }

    @Test("Emits started, track-change, and stopped events")
    func emitsTransitions() {
        let first = snapshot()
        let changed = snapshot(trackURI: "spotify:track:two", track: "Swim")
        #expect(SpotifyFriendPresenceLogic.diff(previous: [:], next: [first.userURI: first]).map(\.kind) == [.started])
        #expect(SpotifyFriendPresenceLogic.diff(previous: [first.userURI: first], next: [changed.userURI: changed]).map(\.kind) == [.trackChanged])
        #expect(SpotifyFriendPresenceLogic.diff(previous: [changed.userURI: changed], next: [:]).map(\.kind) == [.stopped])
    }

    @Test("Stable track observations do not repeat events")
    func stableTrack() {
        let value = snapshot()
        #expect(SpotifyFriendPresenceLogic.diff(previous: [value.userURI: value], next: [value.userURI: value]).isEmpty)
    }

    @Test("Builds readable start and stop notification copy")
    func notificationCopy() {
        let value = snapshot()
        let started = SpotifyFriendPresenceLogic.notification(for: .init(kind: .started, snapshot: value, previous: nil))
        let stopped = SpotifyFriendPresenceLogic.notification(for: .init(kind: .stopped, snapshot: value, previous: value))
        #expect(started.title == "Ash started listening")
        #expect(started.message == "Friends by Chase Atlantic")
        #expect(stopped.title == "Ash stopped listening")
        #expect(stopped.message == "Last played Friends by Chase Atlantic")
    }
}

@Suite("Spotify bridge HTTP parser")
struct SpotifyBridgeHTTPParserTests {
    @Test("Parses a complete authenticated JSON request")
    func parsesRequest() throws {
        let body = Data(#"{"capability":"ready"}"#.utf8)
        let head = "POST /v1/spotify/friends-snapshot HTTP/1.1\r\nOrigin: https://xpui.app.spotify.com\r\nX-Graft-Bridge-Token: secret\r\nContent-Length: \(body.count)\r\n\r\n"
        var bytes = Data(head.utf8)
        bytes.append(body)
        let request = try #require(SpotifyBridgeHTTPParser.parse(bytes))
        #expect(request.method == "POST")
        #expect(request.path == "/v1/spotify/friends-snapshot")
        #expect(request.headers["origin"] == "https://xpui.app.spotify.com")
        #expect(request.body == body)
    }

    @Test("Rejects incomplete and oversized requests")
    func rejectsInvalidRequests() {
        #expect(SpotifyBridgeHTTPParser.parse(Data("POST / HTTP/1.1\r\n".utf8)) == nil)
        #expect(SpotifyBridgeHTTPParser.parse(Data(repeating: 0, count: SpotifyBridgeHTTPParser.maximumRequestSize + 1)) == nil)
    }
}

@Suite("Spotify integration configuration")
struct SpotifyIntegrationServiceTests {
    @Test("Finds only the exact configured bridge entry")
    func configParsing() {
        #expect(SpotifyIntegrationService.configContainsBridge("extensions = theme.js|graft-spotify-bridge.js"))
        #expect(!SpotifyIntegrationService.configContainsBridge("extensions = graft-spotify-bridge.js.old"))
        #expect(!SpotifyIntegrationService.configContainsBridge("; extensions = graft-spotify-bridge.js"))
    }

    @Test("Renders the per-install token and loopback port")
    func bridgeRendering() {
        let result = SpotifyIntegrationService.renderBridge(
            "token=__GRAFT_BRIDGE_TOKEN__;port=__GRAFT_BRIDGE_PORT__",
            token: "secret",
            port: 27_492
        )
        #expect(result == "token=secret;port=27492")
    }

    @Test("Only treats backup/version failures as repairable mismatches")
    func backupMismatchDetection() {
        #expect(SpotifyIntegrationService.requiresBackupRefresh("Spotify version is newer than the backup"))
        #expect(SpotifyIntegrationService.requiresBackupRefresh("Spotify is not backed up"))
        #expect(!SpotifyIntegrationService.requiresBackupRefresh("permission denied"))
    }

    @Test("Creates a stable owner-only loopback token")
    func tokenPersistence() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("graft-token-tests-\(UUID().uuidString)", isDirectory: true)
        let file = directory.appendingPathComponent("spotify-bridge-token")
        defer { try? FileManager.default.removeItem(at: directory) }
        let first = try SpotifyIntegrationService.loadOrCreateBridgeToken(
            fileManager: .default,
            fileURL: file
        )
        let second = try SpotifyIntegrationService.loadOrCreateBridgeToken(
            fileManager: .default,
            fileURL: file
        )
        let attributes = try FileManager.default.attributesOfItem(atPath: file.path)
        #expect(first.count == 64)
        #expect(second == first)
        #expect((attributes[.posixPermissions] as? NSNumber)?.intValue == 0o600)
    }
}
