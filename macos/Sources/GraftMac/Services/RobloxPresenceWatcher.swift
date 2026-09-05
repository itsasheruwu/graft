import Foundation
import GraftCore

struct RobloxPlayerWatcherConfiguration: Equatable, Sendable {
    var enabled = false
    var bridgeConfigured = false
    var notifyOnline = true
    var notifyOffline = true
    var notifyJoinGame = true
    var showExactGame = false
    var antiSpamEnabled = true
    var whitelist: [String] = []

    init(state: GraftSharedState) {
        enabled = state.browserSettings["robloxPlayerWatcherEnabled"]?.boolValue ?? false
        notifyOnline = state.browserSettings["robloxPlayerWatcherNotifyOnline"]?.boolValue ?? true
        notifyOffline = state.browserSettings["robloxPlayerWatcherNotifyOffline"]?.boolValue ?? true
        notifyJoinGame = state.browserSettings["robloxPlayerWatcherNotifyJoinGame"]?.boolValue ?? true
        showExactGame = state.browserSettings["robloxPlayerWatcherShowExactGame"]?.boolValue ?? false
        antiSpamEnabled = state.browserSettings["robloxPlayerWatcherAntiSpamEnabled"]?.boolValue ?? true
        if case .array(let entries) = state.browserSettings["robloxPlayerWatcherWhitelist"] {
            whitelist = Self.normalizeWhitelist(entries.compactMap(\.stringValue))
        }
    }

    private static func normalizeWhitelist(_ entries: [String]) -> [String] {
        var seen = Set<String>()
        return entries.compactMap { raw in
            let entry = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !entry.isEmpty else { return nil }
            let key = entry.lowercased()
            guard seen.insert(key).inserted else { return nil }
            return entry
        }.prefix(50).map { $0 }
    }
}

struct RobloxPresenceSnapshot: Codable, Equatable, Sendable {
    let userID: Int
    let username: String
    let presenceType: Int
    let lastLocation: String
    let placeID: Int?
    let universeID: Int?
    let gameID: String?
}

enum RobloxPresenceEventKind: Equatable, Sendable {
    case online
    case offline
    case joinGame
}

struct RobloxPresenceEvent: Sendable {
    let kind: RobloxPresenceEventKind
    let snapshot: RobloxPresenceSnapshot
}

enum RobloxPresenceLogic {
    static let joinGameAntiSpamCooldown: TimeInterval = 180

    static func applyingExactGameNames(
        to snapshots: [RobloxPresenceSnapshot],
        namesByUniverseID: [Int: String]
    ) -> [RobloxPresenceSnapshot] {
        snapshots.map { snapshot in
            guard snapshot.presenceType == 2,
                  let universeID = snapshot.universeID,
                  let name = namesByUniverseID[universeID],
                  !name.isEmpty else { return snapshot }
            return .init(
                userID: snapshot.userID,
                username: snapshot.username,
                presenceType: snapshot.presenceType,
                lastLocation: name,
                placeID: snapshot.placeID,
                universeID: snapshot.universeID,
                gameID: snapshot.gameID
            )
        }
    }

    static func diff(
        previousByUserID: [Int: RobloxPresenceSnapshot],
        next: [RobloxPresenceSnapshot]
    ) -> (events: [RobloxPresenceEvent], nextByUserID: [Int: RobloxPresenceSnapshot]) {
        var events: [RobloxPresenceEvent] = []
        var nextByUserID: [Int: RobloxPresenceSnapshot] = [:]

        for snapshot in next {
            let previous = previousByUserID[snapshot.userID]
            nextByUserID[snapshot.userID] = snapshot
            guard let previous else { continue }

            let wasOffline = previous.presenceType == 0
            let isOffline = snapshot.presenceType == 0
            let joinedGame = snapshot.presenceType == 2 && !sameGameSession(previous, snapshot)

            if wasOffline && !isOffline && !joinedGame {
                events.append(.init(kind: .online, snapshot: snapshot))
            } else if !wasOffline && isOffline {
                events.append(.init(kind: .offline, snapshot: snapshot))
            }
            if joinedGame {
                events.append(.init(kind: .joinGame, snapshot: snapshot))
            }
        }

        return (events, nextByUserID)
    }

    static func notification(for event: RobloxPresenceEvent) -> GraftNativeNotification {
        let snapshot = event.snapshot
        switch event.kind {
        case .online:
            return .init(
                id: "roblox-watcher-\(snapshot.userID)-online",
                title: "\(snapshot.username) is online",
                message: snapshot.lastLocation.isEmpty
                    ? "\(snapshot.username) came online on Roblox."
                    : "\(snapshot.username) came online (\(snapshot.lastLocation))."
            )
        case .offline:
            return .init(
                id: "roblox-watcher-\(snapshot.userID)-offline",
                title: "\(snapshot.username) went offline",
                message: "\(snapshot.username) is no longer online on Roblox."
            )
        case .joinGame:
            return .init(
                id: "roblox-watcher-\(snapshot.userID)-join-game",
                title: snapshot.lastLocation.isEmpty ? "\(snapshot.username) joined a game" : "\(snapshot.username) joined \(snapshot.lastLocation)",
                message: snapshot.lastLocation.isEmpty
                    ? "\(snapshot.username) joined a Roblox experience."
                    : "\(snapshot.username) joined \(snapshot.lastLocation)."
            )
        }
    }

    static func shouldDeliverJoinGame(
        userID: Int,
        lastDeliveredAtByUserID: [Int: Date],
        now: Date = Date(),
        antiSpamEnabled: Bool
    ) -> Bool {
        guard antiSpamEnabled else { return true }
        guard let last = lastDeliveredAtByUserID[userID] else { return true }
        return now.timeIntervalSince(last) >= joinGameAntiSpamCooldown
    }

    private static func sameGameSession(
        _ previous: RobloxPresenceSnapshot,
        _ next: RobloxPresenceSnapshot
    ) -> Bool {
        guard previous.presenceType == 2 else { return false }
        if let previousID = previous.gameID, let nextID = next.gameID {
            return previousID == nextID
        }
        if let previousID = previous.placeID, let nextID = next.placeID {
            return previousID == nextID
        }
        if let previousID = previous.universeID, let nextID = next.universeID {
            return previousID == nextID
        }
        // Missing details are not evidence of another join. This also avoids
        // recording a join when Roblox reveals or hides a location mid-session.
        return previous.lastLocation.isEmpty || next.lastLocation.isEmpty
            || previous.lastLocation == next.lastLocation
    }
}

private enum RobloxPresenceAPI {
    private struct Response: Decodable { let userPresences: [Row] }
    private struct Request: Encodable { let userIds: [Int] }
    private struct Row: Decodable {
        let userPresenceType: Int
        let lastLocation: String?
        let placeId: Int?
        let gameId: String?
        let universeId: Int?
        let userId: Int
    }
    private struct GamesResponse: Decodable { let data: [Game] }
    private struct Game: Decodable {
        let id: Int
        let name: String
    }

    static func fetch(identities: [RobloxIdentity]) async throws -> [RobloxPresenceSnapshot] {
        guard let url = URL(string: "https://presence.roblox.com/v1/presence/users") else { return [] }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        var usernames: [Int: String] = [:]
        for identity in identities { usernames[identity.id] = identity.username }
        request.httpBody = try JSONEncoder().encode(Request(userIds: Array(usernames.keys)))

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw RobloxAccountResolverError.requestFailed
        }

        let rows = try JSONDecoder().decode(Response.self, from: data).userPresences
        return rows.map { row in
            .init(
                userID: row.userId,
                username: usernames[row.userId] ?? "User \(row.userId)",
                presenceType: row.userPresenceType,
                lastLocation: (row.lastLocation ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
                placeID: row.placeId,
                universeID: row.universeId,
                gameID: row.gameId
            )
        }
    }

    static func fetchGameNames(universeIDs: [Int]) async throws -> [Int: String] {
        guard !universeIDs.isEmpty else { return [:] }
        var components = URLComponents(string: "https://games.roblox.com/v1/games")
        components?.queryItems = [
            .init(name: "universeIds", value: universeIDs.map(String.init).joined(separator: ",")),
        ]
        guard let url = components?.url else { return [:] }
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw RobloxAccountResolverError.requestFailed
        }
        let games = try JSONDecoder().decode(GamesResponse.self, from: data).data
        return Dictionary(uniqueKeysWithValues: games.compactMap { game in
            let name = game.name.trimmingCharacters(in: .whitespacesAndNewlines)
            return name.isEmpty ? nil : (game.id, name)
        })
    }
}

@MainActor
final class RobloxPresenceWatcher {
    private let notifications: GraftNotificationService
    private let presenceLogs: RobloxPresenceLogStore
    private let pollInterval: TimeInterval
    private var configuration = RobloxPlayerWatcherConfiguration(state: .init())
    private var identitiesByEntry: [String: RobloxIdentity] = [:]
    private var gameNamesByUniverseID: [Int: String] = [:]
    private var previousByUserID: [Int: RobloxPresenceSnapshot] = [:]
    private var lastJoinNotifyAtByUserID: [Int: Date] = [:]
    private var shouldSeed = true
    private var wasEligible = false
    private var lastPollAt: Date?
    private var revision = 0
    private var task: Task<Void, Never>?

    init(
        notifications: GraftNotificationService,
        presenceLogs: RobloxPresenceLogStore,
        pollInterval: TimeInterval = 30
    ) {
        self.notifications = notifications
        self.presenceLogs = presenceLogs
        self.pollInterval = pollInterval
    }

    func start() {
        guard task == nil else { return }
        task = Task { [weak self] in
            while !Task.isCancelled {
                await self?.tick()
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    func apply(_ next: RobloxPlayerWatcherConfiguration) {
        let currentEntries = configuration.whitelist.map { $0.lowercased() }
        let nextEntries = next.whitelist.map { $0.lowercased() }
        let ownershipChanged = configuration.enabled != next.enabled
            || currentEntries != nextEntries
        configuration = next
        revision &+= 1
        if ownershipChanged {
            resetBaseline()
            let retainedEntries = Set(nextEntries)
            identitiesByEntry = identitiesByEntry.filter { retainedEntries.contains($0.key) }
        }
    }

    deinit { task?.cancel() }

    private func tick() async {
        let eligible = configuration.enabled
            && configuration.bridgeConfigured
            && !configuration.whitelist.isEmpty
            && notifications.canDeliverNotifications

        guard eligible else {
            if wasEligible { resetBaseline() }
            wasEligible = false
            return
        }

        if !wasEligible {
            resetBaseline()
            wasEligible = true
        }

        if let lastPollAt, Date().timeIntervalSince(lastPollAt) < pollInterval { return }
        lastPollAt = Date()
        await pollOnce(revision: revision)
    }

    private func pollOnce(revision pollRevision: Int) async {
        var identities: [RobloxIdentity] = []
        for entry in configuration.whitelist {
            let key = entry.lowercased()
            if let cached = identitiesByEntry[key] {
                identities.append(cached)
                continue
            }
            guard let identity = try? await RobloxAccountResolver.resolveIdentity(entry) else { continue }
            guard pollRevision == revision else { return }
            identitiesByEntry[key] = identity
            identities.append(identity)
        }

        guard pollRevision == revision, !identities.isEmpty,
              var snapshots = try? await RobloxPresenceAPI.fetch(identities: identities),
              pollRevision == revision else { return }

        if configuration.showExactGame {
            let missingUniverseIDs = Set<Int>(snapshots.compactMap { snapshot -> Int? in
                guard snapshot.presenceType == 2,
                      let universeID = snapshot.universeID,
                      gameNamesByUniverseID[universeID] == nil else { return nil }
                return universeID
            })
            if !missingUniverseIDs.isEmpty,
               let fetchedNames = try? await RobloxPresenceAPI.fetchGameNames(
                   universeIDs: missingUniverseIDs.sorted()
               ) {
                guard pollRevision == revision else { return }
                gameNamesByUniverseID.merge(fetchedNames) { _, new in new }
            }
            snapshots = RobloxPresenceLogic.applyingExactGameNames(
                to: snapshots,
                namesByUniverseID: gameNamesByUniverseID
            )
        }

        let previous = shouldSeed ? [:] : previousByUserID
        let result = RobloxPresenceLogic.diff(previousByUserID: previous, next: snapshots)
        previousByUserID = result.nextByUserID
        shouldSeed = false

        for event in result.events {
            guard pollRevision == revision,
                  configuration.enabled,
                  notifications.canDeliverNotifications else { return }
            presenceLogs.append(event)
            guard shouldNotify(event.kind) else { continue }
            if event.kind == .joinGame,
               !RobloxPresenceLogic.shouldDeliverJoinGame(
                   userID: event.snapshot.userID,
                   lastDeliveredAtByUserID: lastJoinNotifyAtByUserID,
                   antiSpamEnabled: configuration.antiSpamEnabled
               ) {
                continue
            }
            notifications.deliver(RobloxPresenceLogic.notification(for: event))
            if event.kind == .joinGame {
                lastJoinNotifyAtByUserID[event.snapshot.userID] = Date()
            }
        }
    }

    private func shouldNotify(_ kind: RobloxPresenceEventKind) -> Bool {
        switch kind {
        case .online: configuration.notifyOnline
        case .offline: configuration.notifyOffline
        case .joinGame: configuration.notifyJoinGame
        }
    }

    private func resetBaseline() {
        previousByUserID = [:]
        lastJoinNotifyAtByUserID = [:]
        shouldSeed = true
        lastPollAt = nil
    }
}
