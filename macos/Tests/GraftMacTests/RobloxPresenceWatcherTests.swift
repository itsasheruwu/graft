import Foundation
import GraftCore
import Testing
@testable import GraftMac

@Suite("Roblox presence watcher")
@MainActor
struct RobloxPresenceWatcherTests {
    private func snapshot(
        userID: Int = 1,
        username: String = "Ash",
        presenceType: Int,
        location: String = "",
        placeID: Int? = nil,
        universeID: Int? = nil,
        gameID: String? = nil
    ) -> RobloxPresenceSnapshot {
        .init(
            userID: userID,
            username: username,
            presenceType: presenceType,
            lastLocation: location,
            placeID: placeID,
            universeID: universeID,
            gameID: gameID
        )
    }

    @Test("Reads and normalizes shared watcher settings")
    func configurationFromSharedState() {
        var state = GraftSharedState()
        state.browserSettings = [
            "robloxPlayerWatcherEnabled": .bool(true),
            "robloxPlayerWatcherNotifyOnline": .bool(false),
            "robloxPlayerWatcherShowExactGame": .bool(true),
            "robloxPlayerWatcherWhitelist": .array([
                .string(" Builderman "),
                .string("builderman"),
                .string("156"),
                .string(""),
            ]),
        ]

        let configuration = RobloxPlayerWatcherConfiguration(state: state)
        #expect(configuration.enabled)
        #expect(!configuration.bridgeConfigured)
        #expect(!configuration.notifyOnline)
        #expect(configuration.notifyOffline)
        #expect(configuration.notifyJoinGame)
        #expect(configuration.showExactGame)
        #expect(configuration.antiSpamEnabled)
        #expect(configuration.whitelist == ["Builderman", "156"])
    }

    @Test("Anti-spam can be turned off from shared watcher settings")
    func configurationDisablesAntiSpam() {
        var state = GraftSharedState()
        state.browserSettings = [
            "robloxPlayerWatcherAntiSpamEnabled": .bool(false),
        ]
        #expect(!RobloxPlayerWatcherConfiguration(state: state).antiSpamEnabled)
    }

    @Test("Exact game names replace generic presence locations")
    func appliesExactGameNames() {
        let generic = snapshot(
            presenceType: 2,
            location: "Roblox experience",
            universeID: 383_310_974
        )
        let result = RobloxPresenceLogic.applyingExactGameNames(
            to: [generic],
            namesByUniverseID: [383_310_974: "[🦋] Adopt Me!"]
        )
        #expect(result.first?.lastLocation == "[🦋] Adopt Me!")
    }

    @Test("Seeds a first observation without emitting an event")
    func seedsSilently() {
        let result = RobloxPresenceLogic.diff(
            previousByUserID: [:],
            next: [snapshot(presenceType: 1)]
        )
        #expect(result.events.isEmpty)
        #expect(result.nextByUserID[1]?.presenceType == 1)
    }

    @Test("Emits online, offline, and join-game transitions")
    func emitsTransitions() {
        let offline = snapshot(presenceType: 0)
        let online = snapshot(presenceType: 1)
        let inGame = snapshot(presenceType: 2, location: "Adopt Me", placeID: 10, gameID: "abc")

        let onlineResult = RobloxPresenceLogic.diff(previousByUserID: [1: offline], next: [online])
        #expect(onlineResult.events.map(\.kind) == [.online])

        let joinResult = RobloxPresenceLogic.diff(previousByUserID: [1: online], next: [inGame])
        #expect(joinResult.events.map(\.kind) == [.joinGame])

        let offlineResult = RobloxPresenceLogic.diff(previousByUserID: [1: inGame], next: [offline])
        #expect(offlineResult.events.map(\.kind) == [.offline])
    }

    @Test("Does not repeat a join alert for the same game session")
    func sameSessionIsStable() {
        let current = snapshot(presenceType: 2, location: "Adopt Me", placeID: 10, gameID: "abc")
        let result = RobloxPresenceLogic.diff(previousByUserID: [1: current], next: [current])
        #expect(result.events.isEmpty)
    }

    @Test("Missing or newly revealed game details do not repeat join events")
    func missingDetailsAreStable() {
        let hidden = snapshot(presenceType: 2)
        let revealed = snapshot(presenceType: 2, location: "Adopt Me", universeID: 10)
        for (previous, next) in [(hidden, hidden), (hidden, revealed), (revealed, hidden)] {
            #expect(RobloxPresenceLogic.diff(previousByUserID: [1: previous], next: [next]).events.isEmpty)
        }
        let other = snapshot(presenceType: 2, location: "Other", universeID: 20)
        #expect(RobloxPresenceLogic.diff(previousByUserID: [1: revealed], next: [other]).events.map(\.kind) == [.joinGame])
    }

    @Test("Replaces the snapshot map so removed players cannot remain stale")
    func prunesRemovedPlayers() {
        let result = RobloxPresenceLogic.diff(
            previousByUserID: [
                1: snapshot(userID: 1, presenceType: 1),
                2: snapshot(userID: 2, presenceType: 0),
            ],
            next: [snapshot(userID: 1, presenceType: 1)]
        )
        #expect(Set(result.nextByUserID.keys) == Set([1]))
    }

    @Test("Builds the same stable notification copy as the extension")
    func notificationCopy() {
        let event = RobloxPresenceEvent(
            kind: .joinGame,
            snapshot: snapshot(userID: 9, presenceType: 2, location: "Adopt Me")
        )
        let notification = RobloxPresenceLogic.notification(for: event)
        #expect(notification.id == "roblox-watcher-9-join-game")
        #expect(notification.title == "Ash joined Adopt Me")
        #expect(notification.message == "Ash joined Adopt Me.")
    }

    @Test("Anti-spam lets the first join-game through and suppresses rapid repeats")
    func antiSpamThrottlesJoinGame() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        #expect(
            RobloxPresenceLogic.shouldDeliverJoinGame(
                userID: 9,
                lastDeliveredAtByUserID: [:],
                now: now,
                antiSpamEnabled: true
            )
        )
        #expect(
            !RobloxPresenceLogic.shouldDeliverJoinGame(
                userID: 9,
                lastDeliveredAtByUserID: [9: now.addingTimeInterval(-30)],
                now: now,
                antiSpamEnabled: true
            )
        )
        #expect(
            RobloxPresenceLogic.shouldDeliverJoinGame(
                userID: 9,
                lastDeliveredAtByUserID: [9: now.addingTimeInterval(-181)],
                now: now,
                antiSpamEnabled: true
            )
        )
        #expect(
            RobloxPresenceLogic.shouldDeliverJoinGame(
                userID: 9,
                lastDeliveredAtByUserID: [9: now.addingTimeInterval(-30)],
                now: now,
                antiSpamEnabled: false
            )
        )
    }
}
