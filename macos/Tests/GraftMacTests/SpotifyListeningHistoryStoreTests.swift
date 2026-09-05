import Foundation
import Testing
@testable import GraftMac

@Suite("Spotify listening history")
@MainActor
struct SpotifyListeningHistoryStoreTests {
    private func snapshot(trackURI: String = "spotify:track:one", track: String = "Friends") -> SpotifyFriendSnapshot {
        .init(
            userURI: "spotify:user:ash",
            displayName: "Ash",
            avatarURL: nil,
            trackURI: trackURI,
            trackName: track,
            artistName: "Chase Atlantic",
            contextName: "The Ankle Biters",
            contextURI: "spotify:playlist:test",
            artworkURL: nil,
            activityAt: Date(timeIntervalSince1970: 1_800_000_000)
        )
    }

    @Test("Persists detected friends and complete listening sessions")
    func persistsSessions() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("graft-spotify-tests-\(UUID().uuidString)", isDirectory: true)
        let file = directory.appendingPathComponent("history.json")
        defer { try? FileManager.default.removeItem(at: directory) }
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        let store = SpotifyListeningHistoryStore(fileURL: file, now: start)
        let first = snapshot()
        let second = snapshot(trackURI: "spotify:track:two", track: "Swim")

        store.observe(friends: [first], at: start)
        store.begin(first, at: start)
        store.transition(to: second, at: start.addingTimeInterval(180))
        store.end(friendURI: second.userURI, at: start.addingTimeInterval(360))

        let reloaded = SpotifyListeningHistoryStore(fileURL: file, now: start.addingTimeInterval(360))
        #expect(reloaded.knownFriends.map(\.id) == [first.userURI])
        #expect(reloaded.entries.count == 2)
        #expect(reloaded.entries.allSatisfy { $0.endedAt != nil })
        #expect(reloaded.entries.first?.trackName == "Swim")
    }

    @Test("Prunes sessions outside the retention window")
    func prunesOldSessions() {
        let file = FileManager.default.temporaryDirectory
            .appendingPathComponent("graft-spotify-history-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: file) }
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        let store = SpotifyListeningHistoryStore(
            fileURL: file,
            retentionInterval: 60,
            maximumEntryCount: 10,
            now: start
        )
        store.begin(snapshot(), at: start)
        store.endAll(at: start.addingTimeInterval(10))
        let reloaded = SpotifyListeningHistoryStore(
            fileURL: file,
            retentionInterval: 60,
            maximumEntryCount: 10,
            now: start.addingTimeInterval(71)
        )
        #expect(reloaded.entries.isEmpty)
    }
}
