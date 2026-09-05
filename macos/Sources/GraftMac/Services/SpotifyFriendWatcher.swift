import Foundation
import GraftCore
import Observation

nonisolated struct SpotifyFriendSnapshot: Codable, Equatable, Identifiable, Sendable {
    var id: String { userURI }
    let userURI: String
    let displayName: String
    let avatarURL: URL?
    let trackURI: String
    let trackName: String
    let artistName: String
    let contextName: String?
    let contextURI: String?
    let artworkURL: URL?
    let activityAt: Date
}

nonisolated struct SpotifyBridgePayload: Codable, Equatable, Sendable {
    nonisolated enum Capability: String, Codable, Sendable {
        case ready
        case unsupported
    }

    let bridgeVersion: String
    let spotifyVersion: String?
    let observedAt: Date
    let capability: Capability
    let error: String?
    let friends: [SpotifyFriendSnapshot]
}

nonisolated struct SpotifyFriendWatcherConfiguration: Equatable, Sendable {
    var enabled = false
    var notifyStarted = true
    var notifyTrackChanges = true
    var notifyStopped = true
    var timeSensitive = false
    var soundEnabled = true
    var whitelist: [String] = []

    init(settings: MacSettings) {
        enabled = settings.spotifyWatcherEnabled
        notifyStarted = settings.spotifyWatcherNotifyStarted
        notifyTrackChanges = settings.spotifyWatcherNotifyTrackChanges
        notifyStopped = settings.spotifyWatcherNotifyStopped
        timeSensitive = settings.spotifyWatcherTimeSensitive
        soundEnabled = settings.spotifyWatcherNotificationSoundEnabled
        whitelist = Self.normalizeWhitelist(settings.spotifyWatcherWhitelist)
    }

    static func normalizeWhitelist(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.compactMap { value in
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return nil }
            let key = trimmed.lowercased()
            guard seen.insert(key).inserted else { return nil }
            return trimmed
        }.prefix(100).map { $0 }
    }
}

nonisolated enum SpotifyFriendEventKind: Equatable, Sendable {
    case started
    case trackChanged
    case stopped
}

nonisolated struct SpotifyFriendEvent: Equatable, Sendable {
    let kind: SpotifyFriendEventKind
    let snapshot: SpotifyFriendSnapshot
    let previous: SpotifyFriendSnapshot?
}

nonisolated enum SpotifyFriendPresenceLogic {
    static let listeningFreshness: TimeInterval = 15 * 60
    static let bridgeFreshness: TimeInterval = 45

    static func isListening(_ snapshot: SpotifyFriendSnapshot, at date: Date) -> Bool {
        let age = date.timeIntervalSince(snapshot.activityAt)
        return age >= -30 && age < listeningFreshness
    }

    static func activeSnapshots(
        from snapshots: [SpotifyFriendSnapshot],
        whitelist: [String],
        at date: Date
    ) -> [String: SpotifyFriendSnapshot] {
        let allowed = Set(whitelist.map { $0.lowercased() })
        return Dictionary(uniqueKeysWithValues: snapshots.compactMap { snapshot in
            guard allowed.contains(snapshot.userURI.lowercased()), isListening(snapshot, at: date) else {
                return nil
            }
            return (snapshot.userURI, snapshot)
        })
    }

    static func mergeObservations(
        previous: [SpotifyFriendSnapshot],
        current: [SpotifyFriendSnapshot],
        at date: Date
    ) -> [SpotifyFriendSnapshot] {
        var byFriendURI = Dictionary(uniqueKeysWithValues: previous.compactMap { snapshot in
            isListening(snapshot, at: date) ? (snapshot.userURI, snapshot) : nil
        })
        for snapshot in current { byFriendURI[snapshot.userURI] = snapshot }
        return Array(byFriendURI.values.prefix(200))
    }

    static func diff(
        previous: [String: SpotifyFriendSnapshot],
        next: [String: SpotifyFriendSnapshot]
    ) -> [SpotifyFriendEvent] {
        var events: [SpotifyFriendEvent] = []
        for (friendURI, snapshot) in next {
            guard let prior = previous[friendURI] else {
                events.append(.init(kind: .started, snapshot: snapshot, previous: nil))
                continue
            }
            if prior.trackURI != snapshot.trackURI {
                events.append(.init(kind: .trackChanged, snapshot: snapshot, previous: prior))
            }
        }
        for (friendURI, snapshot) in previous where next[friendURI] == nil {
            events.append(.init(kind: .stopped, snapshot: snapshot, previous: snapshot))
        }
        return events.sorted {
            if $0.snapshot.displayName == $1.snapshot.displayName {
                return String(describing: $0.kind) < String(describing: $1.kind)
            }
            return $0.snapshot.displayName.localizedCaseInsensitiveCompare($1.snapshot.displayName) == .orderedAscending
        }
    }

    static func notification(for event: SpotifyFriendEvent) -> GraftNativeNotification {
        let snapshot = event.snapshot
        let safeID = snapshot.userURI.replacingOccurrences(of: ":", with: "-")
        switch event.kind {
        case .started:
            return .init(
                id: "spotify-watcher-\(safeID)-started",
                title: "\(snapshot.displayName) started listening",
                message: "\(snapshot.trackName) by \(snapshot.artistName)"
            )
        case .trackChanged:
            return .init(
                id: "spotify-watcher-\(safeID)-track",
                title: "\(snapshot.displayName) changed tracks",
                message: "\(snapshot.trackName) by \(snapshot.artistName)"
            )
        case .stopped:
            return .init(
                id: "spotify-watcher-\(safeID)-stopped",
                title: "\(snapshot.displayName) stopped listening",
                message: "Last played \(snapshot.trackName) by \(snapshot.artistName)"
            )
        }
    }
}

@MainActor
@Observable
final class SpotifyFriendWatcher {
    private(set) var activeByFriendURI: [String: SpotifyFriendSnapshot] = [:]
    private(set) var lastPayloadAt: Date?

    @ObservationIgnored private let notifications: GraftNotificationService
    @ObservationIgnored private let history: SpotifyListeningHistoryStore
    @ObservationIgnored private var configuration = SpotifyFriendWatcherConfiguration(settings: .init())
    @ObservationIgnored private var latestSnapshots: [SpotifyFriendSnapshot] = []
    @ObservationIgnored private var shouldSeed = true
    @ObservationIgnored private var task: Task<Void, Never>?

    init(notifications: GraftNotificationService, history: SpotifyListeningHistoryStore) {
        self.notifications = notifications
        self.history = history
    }

    func start() {
        guard task == nil else { return }
        task = Task { [weak self] in
            while !Task.isCancelled {
                self?.evaluate(at: Date())
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    func apply(_ next: SpotifyFriendWatcherConfiguration) {
        let ownershipChanged = configuration.enabled != next.enabled
            || configuration.whitelist.map { $0.lowercased() } != next.whitelist.map { $0.lowercased() }
        if configuration.enabled && !next.enabled {
            history.endAll()
        } else if ownershipChanged {
            let retained = Set(next.whitelist.map { $0.lowercased() })
            for key in activeByFriendURI.keys where !retained.contains(key.lowercased()) {
                history.end(friendURI: key)
            }
        }
        configuration = next
        if ownershipChanged {
            activeByFriendURI = [:]
            shouldSeed = true
        }
    }

    func ingest(_ payload: SpotifyBridgePayload, receivedAt: Date = Date()) {
        guard payload.capability == .ready else { return }
        lastPayloadAt = receivedAt
        let current = Array(payload.friends.prefix(100))
        latestSnapshots = SpotifyFriendPresenceLogic.mergeObservations(
            previous: latestSnapshots,
            current: current,
            at: receivedAt
        )
        history.observe(friends: current, at: receivedAt)
        evaluate(at: receivedAt)
    }

    deinit { task?.cancel() }

    private func evaluate(at date: Date) {
        guard configuration.enabled, !configuration.whitelist.isEmpty else { return }
        guard let lastPayloadAt,
              date.timeIntervalSince(lastPayloadAt) >= 0,
              date.timeIntervalSince(lastPayloadAt) < SpotifyFriendPresenceLogic.bridgeFreshness else {
            return
        }

        let next = SpotifyFriendPresenceLogic.activeSnapshots(
            from: latestSnapshots,
            whitelist: configuration.whitelist,
            at: date
        )
        if shouldSeed {
            activeByFriendURI = next
            for snapshot in next.values { history.begin(snapshot, at: date) }
            shouldSeed = false
            return
        }

        let events = SpotifyFriendPresenceLogic.diff(previous: activeByFriendURI, next: next)
        activeByFriendURI = next
        for event in events {
            switch event.kind {
            case .started: history.begin(event.snapshot, at: date)
            case .trackChanged: history.transition(to: event.snapshot, at: date)
            case .stopped: history.end(friendURI: event.snapshot.userURI, at: date)
            }
            guard shouldNotify(event.kind) else { continue }
            notifications.deliver(
                SpotifyFriendPresenceLogic.notification(for: event),
                preferences: .init(
                    timeSensitive: configuration.timeSensitive,
                    soundEnabled: configuration.soundEnabled
                )
            )
        }
    }

    private func shouldNotify(_ kind: SpotifyFriendEventKind) -> Bool {
        switch kind {
        case .started: configuration.notifyStarted
        case .trackChanged: configuration.notifyTrackChanges
        case .stopped: configuration.notifyStopped
        }
    }
}
