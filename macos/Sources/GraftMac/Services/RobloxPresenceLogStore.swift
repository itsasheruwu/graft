import Foundation
import GraftCore
import Observation

enum RobloxPresenceLogKind: String, Codable, CaseIterable, Sendable {
    case online
    case offline
    case joinGame

    init(_ eventKind: RobloxPresenceEventKind) {
        switch eventKind {
        case .online: self = .online
        case .offline: self = .offline
        case .joinGame: self = .joinGame
        }
    }
}

struct RobloxPresenceLogEntry: Codable, Equatable, Identifiable, Sendable {
    let id: UUID
    let kind: RobloxPresenceLogKind
    let userID: Int
    let username: String
    let location: String
    let recordedAt: Date
}

@MainActor
@Observable
final class RobloxPresenceLogStore {
    private static let maximumEntryCount = 250

    private(set) var entries: [RobloxPresenceLogEntry]
    @ObservationIgnored private let fileURL: URL

    init(fileURL: URL = GraftStateFile.directoryURL.appendingPathComponent("roblox-watcher-logs.json")) {
        self.fileURL = fileURL
        entries = Self.load(from: fileURL)
            .sorted { $0.recordedAt > $1.recordedAt }
            .prefix(Self.maximumEntryCount)
            .map { $0 }
    }

    func append(_ event: RobloxPresenceEvent, recordedAt: Date = Date()) {
        let entry = RobloxPresenceLogEntry(
            id: UUID(),
            kind: .init(event.kind),
            userID: event.snapshot.userID,
            username: event.snapshot.username,
            location: event.snapshot.lastLocation,
            recordedAt: recordedAt
        )
        entries.insert(entry, at: 0)
        if entries.count > Self.maximumEntryCount {
            entries.removeLast(entries.count - Self.maximumEntryCount)
        }
        persist()
    }

    private func persist() {
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            try encoder.encode(entries).write(to: fileURL, options: .atomic)
        } catch {
            // Logging must never interrupt watcher polling or notification delivery.
        }
    }

    private static func load(from fileURL: URL) -> [RobloxPresenceLogEntry] {
        guard let data = try? Data(contentsOf: fileURL) else { return [] }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([RobloxPresenceLogEntry].self, from: data)) ?? []
    }
}
