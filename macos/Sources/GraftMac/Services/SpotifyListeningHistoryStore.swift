import Foundation
import GraftCore
import Observation

nonisolated struct SpotifyKnownFriend: Codable, Equatable, Identifiable, Sendable {
    let id: String
    var displayName: String
    var avatarURL: URL?
    var lastSeenAt: Date
}

nonisolated struct SpotifyListeningLogEntry: Codable, Equatable, Identifiable, Sendable {
    let id: UUID
    let friendURI: String
    let friendName: String
    let friendAvatarURL: URL?
    let trackURI: String
    let trackName: String
    let artistName: String
    let contextName: String?
    let artworkURL: URL?
    let startedAt: Date
    var endedAt: Date?

    var isListening: Bool { endedAt == nil }
}

nonisolated private struct SpotifyListeningHistoryEnvelope: Codable {
    var version = 1
    var knownFriends: [SpotifyKnownFriend] = []
    var entries: [SpotifyListeningLogEntry] = []
}

@MainActor
@Observable
final class SpotifyListeningHistoryStore {
    private(set) var knownFriends: [SpotifyKnownFriend]
    private(set) var entries: [SpotifyListeningLogEntry]

    @ObservationIgnored private let fileURL: URL
    @ObservationIgnored private let retentionInterval: TimeInterval
    @ObservationIgnored private let maximumEntryCount: Int

    init(
        fileURL: URL = GraftStateFile.directoryURL.appendingPathComponent("spotify-watcher-history.json"),
        retentionInterval: TimeInterval = 30 * 24 * 60 * 60,
        maximumEntryCount: Int = 5_000,
        now: Date = Date()
    ) {
        self.fileURL = fileURL
        self.retentionInterval = retentionInterval
        self.maximumEntryCount = maximumEntryCount
        let loaded = Self.load(from: fileURL)
        knownFriends = loaded.knownFriends.sorted {
            if $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedSame {
                return $0.id < $1.id
            }
            return $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending
        }
        entries = loaded.entries
        prune(now: now, persistChanges: false)
    }

    func observe(friends: [SpotifyFriendSnapshot], at date: Date = Date()) {
        var byID = Dictionary(uniqueKeysWithValues: knownFriends.map { ($0.id, $0) })
        for friend in friends {
            byID[friend.userURI] = SpotifyKnownFriend(
                id: friend.userURI,
                displayName: friend.displayName,
                avatarURL: friend.avatarURL,
                lastSeenAt: date
            )
        }
        knownFriends = byID.values.sorted {
            $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending
        }
        persist()
    }

    func begin(_ snapshot: SpotifyFriendSnapshot, at date: Date = Date()) {
        end(friendURI: snapshot.userURI, at: date, persistChanges: false)
        entries.insert(.init(
            id: UUID(),
            friendURI: snapshot.userURI,
            friendName: snapshot.displayName,
            friendAvatarURL: snapshot.avatarURL,
            trackURI: snapshot.trackURI,
            trackName: snapshot.trackName,
            artistName: snapshot.artistName,
            contextName: snapshot.contextName,
            artworkURL: snapshot.artworkURL,
            startedAt: date,
            endedAt: nil
        ), at: 0)
        prune(now: date, persistChanges: false)
        persist()
    }

    func transition(to snapshot: SpotifyFriendSnapshot, at date: Date = Date()) {
        end(friendURI: snapshot.userURI, at: date, persistChanges: false)
        begin(snapshot, at: date)
    }

    func end(friendURI: String, at date: Date = Date()) {
        end(friendURI: friendURI, at: date, persistChanges: true)
    }

    func endAll(at date: Date = Date()) {
        var changed = false
        for index in entries.indices where entries[index].endedAt == nil {
            entries[index].endedAt = max(date, entries[index].startedAt)
            changed = true
        }
        if changed { persist() }
    }

    func clear() {
        entries = []
        persist()
    }

    private func end(friendURI: String, at date: Date, persistChanges: Bool) {
        guard let index = entries.firstIndex(where: {
            $0.friendURI == friendURI && $0.endedAt == nil
        }) else { return }
        entries[index].endedAt = max(date, entries[index].startedAt)
        if persistChanges { persist() }
    }

    private func prune(now: Date, persistChanges: Bool) {
        let cutoff = now.addingTimeInterval(-retentionInterval)
        entries.removeAll { ($0.endedAt ?? $0.startedAt) < cutoff }
        entries.sort { $0.startedAt > $1.startedAt }
        if entries.count > maximumEntryCount {
            entries.removeLast(entries.count - maximumEntryCount)
        }
        if persistChanges { persist() }
    }

    private func persist() {
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            let envelope = SpotifyListeningHistoryEnvelope(
                knownFriends: knownFriends,
                entries: entries
            )
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(envelope).write(to: fileURL, options: .atomic)
        } catch {
            // History is best-effort and must never interrupt presence handling.
        }
    }

    private static func load(from fileURL: URL) -> SpotifyListeningHistoryEnvelope {
        guard let data = try? Data(contentsOf: fileURL) else { return .init() }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode(SpotifyListeningHistoryEnvelope.self, from: data)) ?? .init()
    }
}
