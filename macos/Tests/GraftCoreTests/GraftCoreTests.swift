import Foundation
import Testing
@testable import GraftCore

@Suite("JSONValue coding")
struct JSONValueTests {
    @Test("Round-trips every case, including nesting")
    func roundTripsNestedValues() throws {
        let value: JSONValue = .object([
            "enabled": .bool(true),
            "gain": .number(1.5),
            "mode": .string("auto"),
            "missing": .null,
            "list": .array([.bool(false), .number(0), .string(""), .null]),
            "nested": .object(["depth": .number(2)]),
        ])

        let data = try JSONEncoder().encode(value)
        #expect(try JSONDecoder().decode(JSONValue.self, from: data) == value)
    }

    @Test("Encodes as bare JSON rather than a wrapped enum")
    func encodesAsBareJSON() throws {
        let data = try JSONEncoder().encode(["gain": JSONValue.number(1.5)])
        let raw = try #require(String(data: data, encoding: .utf8))
        #expect(raw == #"{"gain":1.5}"#)
    }

    @Test("Typed accessors only match their own case", arguments: [
        JSONValue.bool(true), .number(3), .string("x"), .null,
    ])
    func accessorsAreCaseSpecific(value: JSONValue) {
        let matches = [value.boolValue != nil, value.numberValue != nil, value.stringValue != nil]
        #expect(matches.count(where: { $0 }) <= 1)
    }

    @Test func boolAccessorDoesNotCoerceNumbers() {
        #expect(JSONValue.number(1).boolValue == nil)
        #expect(JSONValue.bool(true).numberValue == nil)
    }
}

@Suite("Shared state file")
struct GraftSharedStateTests {
    @Test("Round-trips through the on-disk encoder, preserving the seen-at date")
    func roundTripsThroughStateFile() throws {
        var state = GraftSharedState()
        state.revision = 7
        state.browserSettings = ["forceDarkModeEnabled": .bool(true), "soundBoosterGain": .number(2.25)]
        state.pendingBrowserChanges = ["forceDarkModeEnabled": .bool(true)]
        state.macSettings.keepAwake = true
        state.macSettings.robloxWatcherTimeSensitive = true
        state.macSettings.robloxWatcherNotificationSoundEnabled = false
        // ISO-8601 has whole-second resolution, so compare against a truncated date.
        state.extensionSeenAt = Date(timeIntervalSince1970: 1_700_000_000)

        let url = URL.temporaryDirectory.appending(path: "graft-state-\(UUID().uuidString).json")
        defer { try? FileManager.default.removeItem(at: url) }

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(state).write(to: url, options: .atomic)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = try decoder.decode(GraftSharedState.self, from: Data(contentsOf: url))
        #expect(decoded == state)
    }

    @Test("A fresh state has no pending work and no contact from the extension")
    func defaultsAreEmpty() {
        let state = GraftSharedState()
        #expect(state.revision == 0)
        #expect(state.browserSettings.isEmpty)
        #expect(state.pendingBrowserChanges.isEmpty)
        #expect(state.extensionSeenAt == nil)
        #expect(state.macSettings == MacSettings())
    }

    @Test("Older Mac settings gain safe notification defaults")
    func olderMacSettingsDecodeWithNotificationDefaults() throws {
        let data = Data(#"{"keepAwake":true,"floatGraftWindow":false,"showHiddenFinderFiles":false,"hideDesktopIcons":false}"#.utf8)
        let settings = try JSONDecoder().decode(MacSettings.self, from: data)
        #expect(settings.keepAwake)
        #expect(!settings.robloxWatcherTimeSensitive)
        #expect(settings.robloxWatcherNotificationSoundEnabled)
        #expect(!settings.spotifyWatcherEnabled)
        #expect(settings.spotifyWatcherNotifyStarted)
        #expect(settings.spotifyWatcherNotifyTrackChanges)
        #expect(settings.spotifyWatcherNotifyStopped)
        #expect(!settings.spotifyWatcherTimeSensitive)
        #expect(settings.spotifyWatcherNotificationSoundEnabled)
        #expect(settings.spotifyWatcherWhitelist.isEmpty)
    }

    // Documents current behaviour rather than endorsing it: the synthesized Decodable
    // requires every key, so a state file written by a build that lacks a later-added
    // field fails to decode outright, and GraftStateFile.load() resets to defaults.
    @Test("A state file missing any key fails to decode")
    func partialStateFailsToDecode() {
        let data = Data(#"{"revision":3}"#.utf8)
        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(GraftSharedState.self, from: data)
        }
    }

    @Test("The state file lives beside the app's other support files")
    func stateURLIsUnderApplicationSupport() {
        #expect(GraftStateFile.stateURL.lastPathComponent == "companion-state.json")
        #expect(GraftStateFile.stateURL.deletingLastPathComponent() == GraftStateFile.directoryURL)
        #expect(GraftStateFile.directoryURL.lastPathComponent == "Graft")
    }
}

@Suite("Companion presence")
struct GraftCompanionPresenceTests {
    @Test("A recent app heartbeat is live and an old heartbeat is stale")
    func freshness() {
        let now = Date(timeIntervalSince1970: 1_700_000_100)
        #expect(GraftCompanionPresence(
            processIdentifier: 42,
            updatedAt: now.addingTimeInterval(-2),
            canDeliverNotifications: true
        ).isFresh(at: now))
        #expect(!GraftCompanionPresence(
            processIdentifier: 42,
            updatedAt: now.addingTimeInterval(-9),
            canDeliverNotifications: true
        ).isFresh(at: now))
    }
}
