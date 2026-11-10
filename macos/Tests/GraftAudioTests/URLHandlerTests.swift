// FineTuneTests/URLHandlerTests.swift
// Focused parser tests for FineTune URL scheme handling.

import AppKit
import Foundation
import Testing
@testable import GraftAudio

@MainActor
@Suite("URLHandler set-volumes parser")
struct URLHandlerSetVolumesTests {

    @Test("set-volumes accepts documented boosted range up to 400 percent")
    func setVolumesAcceptsBoostedRange() throws {
        let app = AudioApp(
            id: 42,
            processObjectIDs: [],
            name: "Boosted App",
            icon: NSImage(),
            bundleID: "com.example.boosted"
        )
        let engine = MockURLHandlerEngine(apps: [app])
        let handler = URLHandler(audioEngine: engine)

        handler.handleURL(try #require(URL(string: "graft://audio/set-volumes?app=com.example.boosted&volume=400")))

        #expect(engine.activeVolumes[app] == 1.0)
        #expect(engine.activeBoosts[app] == .x4)
        #expect(engine.inactiveVolumes.isEmpty)
    }

    @Test("set-volumes persists boosted volume for inactive apps")
    func setVolumesPersistsBoostedInactiveAppVolume() throws {
        let engine = MockURLHandlerEngine()
        let handler = URLHandler(audioEngine: engine)

        handler.handleURL(try #require(URL(string: "graft://audio/set-volumes?app=com.example.inactive&volume=250")))

        #expect(engine.inactiveVolumes["com.example.inactive"] == 2.5 / 3)
        #expect(engine.inactiveBoosts["com.example.inactive"] == .x3)
        #expect(engine.activeVolumes.isEmpty)
    }

    @Test("set-volumes rejects volumes above 400 percent")
    func setVolumesRejectsAboveBoostedRange() throws {
        let app = AudioApp(
            id: 7,
            processObjectIDs: [],
            name: "Too Loud",
            icon: NSImage(),
            bundleID: "com.example.too-loud"
        )
        let engine = MockURLHandlerEngine(apps: [app])
        let handler = URLHandler(audioEngine: engine)

        handler.handleURL(try #require(URL(string: "graft://audio/set-volumes?app=com.example.too-loud&volume=401")))

        #expect(engine.activeVolumes.isEmpty)
        #expect(engine.inactiveVolumes.isEmpty)
    }

    @Test("set-boost persists boost for inactive apps")
    func setBoostPersistsInactiveApp() throws {
        let engine = MockURLHandlerEngine()
        let handler = URLHandler(audioEngine: engine)

        handler.handleURL(try #require(URL(string: "graft://audio/set-boost?app=com.example.inactive&boost=3x")))

        #expect(engine.inactiveBoosts["com.example.inactive"] == .x3)
    }

    @Test("set-eq applies built-in presets to active apps")
    func setEQAppliesPreset() throws {
        let app = AudioApp(
            id: 8,
            processObjectIDs: [],
            name: "Podcast App",
            icon: NSImage(),
            bundleID: "com.example.podcast"
        )
        let engine = MockURLHandlerEngine(apps: [app])
        let handler = URLHandler(audioEngine: engine)

        handler.handleURL(try #require(URL(string: "graft://audio/set-eq?app=com.example.podcast&preset=podcast&enabled=false")))

        #expect(engine.activeEQ[app]?.bandGains == EQPreset.podcast.settings.bandGains)
        #expect(engine.activeEQ[app]?.isEnabled == false)
    }

    @Test("set-device-mode persists multi-device routing for inactive apps")
    func setDeviceModePersistsInactiveMultiRouting() throws {
        let engine = MockURLHandlerEngine()
        let handler = URLHandler(audioEngine: engine)

        handler.handleURL(try #require(URL(string: "graft://audio/set-device-mode?app=com.example.inactive&mode=multi&device=A&device=B")))

        #expect(engine.inactiveModes["com.example.inactive"] == .multi)
        #expect(engine.inactiveSelectedDevices["com.example.inactive"] == Set(["A", "B"]))
    }

    @Test("set-autoeq assigns and enables device profile")
    func setAutoEQAssignsProfile() throws {
        let engine = MockURLHandlerEngine()
        let handler = URLHandler(audioEngine: engine)

        handler.handleURL(try #require(URL(string: "graft://audio/set-autoeq?device=headphones&profile=hd600&enabled=true")))

        #expect(engine.autoEQProfiles["headphones"] == "hd600")
        #expect(engine.autoEQEnabled["headphones"] == true)
    }

    @Test("set-loudness toggles both loudness engines and persists app setting")
    func setLoudnessTogglesBoth() throws {
        let engine = MockURLHandlerEngine()
        let handler = URLHandler(audioEngine: engine)

        handler.handleURL(try #require(URL(string: "graft://audio/set-loudness?enabled=true")))

        #expect(engine.loudnessCompensationEnabled == true)
        #expect(engine.loudnessEqualizationEnabled == true)
        #expect(engine.settingsManager.appSettings.loudnessCompensationEnabled == true)
        #expect(engine.settingsManager.appSettings.loudnessEqualizationEnabled == true)
    }

    @Test("pin and ignore actions persist inactive app metadata")
    func pinAndIgnorePersistInactiveMetadata() throws {
        let engine = MockURLHandlerEngine()
        let handler = URLHandler(audioEngine: engine)

        handler.handleURL(try #require(URL(string: "graft://audio/pin-app?app=com.example.app&name=Example&bundle=com.example.app")))
        handler.handleURL(try #require(URL(string: "graft://audio/ignore-app?app=com.example.noisy&name=Noisy")))

        #expect(engine.pinned["com.example.app"]?.displayName == "Example")
        #expect(engine.ignored["com.example.noisy"]?.displayName == "Noisy")
    }
}

@MainActor
private final class MockURLHandlerEngine: URLHandlerEngine {
    var apps: [AudioApp]
    let settingsManager: SettingsManager
    var activeVolumes: [AudioApp: Float] = [:]
    var inactiveVolumes: [String: Float] = [:]
    var activeBoosts: [AudioApp: BoostLevel] = [:]
    var inactiveBoosts: [String: BoostLevel] = [:]
    var activeMutes: [AudioApp: Bool] = [:]
    var inactiveMutes: [String: Bool] = [:]
    var activeEQ: [AudioApp: EQSettings] = [:]
    var inactiveEQ: [String: EQSettings] = [:]
    var devices: [AudioApp: String?] = [:]
    var inactiveDevices: [String: String?] = [:]
    var activeModes: [AudioApp: DeviceSelectionMode] = [:]
    var inactiveModes: [String: DeviceSelectionMode] = [:]
    var activeSelectedDevices: [AudioApp: Set<String>] = [:]
    var inactiveSelectedDevices: [String: Set<String>] = [:]
    var autoEQProfiles: [String: String?] = [:]
    var autoEQEnabled: [String: Bool] = [:]
    var loudnessCompensationEnabled: Bool?
    var loudnessEqualizationEnabled: Bool?
    var pinned: [String: PinnedAppInfo] = [:]
    var ignored: [String: IgnoredAppInfo] = [:]

    init(apps: [AudioApp] = []) {
        self.apps = apps
        self.settingsManager = SettingsManager(directory: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString))
    }

    func setVolume(for app: AudioApp, to volume: Float) {
        activeVolumes[app] = volume
    }

    func getVolume(for app: AudioApp) -> Float {
        activeVolumes[app] ?? 1.0
    }

    func setBoost(for app: AudioApp, to boost: BoostLevel) {
        activeBoosts[app] = boost
    }

    func setMute(for app: AudioApp, to muted: Bool) {
        activeMutes[app] = muted
    }

    func getMute(for app: AudioApp) -> Bool {
        activeMutes[app] ?? false
    }

    func setEQSettings(_ settings: EQSettings, for app: AudioApp) {
        activeEQ[app] = settings
    }

    func setDevice(for app: AudioApp, deviceUID: String?) {
        devices[app] = deviceUID
    }

    func setDeviceSelectionMode(for app: AudioApp, to mode: DeviceSelectionMode) {
        activeModes[app] = mode
    }

    func setSelectedDeviceUIDs(for app: AudioApp, to uids: Set<String>) {
        activeSelectedDevices[app] = uids
    }

    func setAutoEQProfile(for deviceUID: String, profileID: String?) {
        autoEQProfiles[deviceUID] = profileID
    }

    func setAutoEQEnabled(for deviceUID: String, enabled: Bool) {
        autoEQEnabled[deviceUID] = enabled
    }

    func setLoudnessCompensationEnabled(_ enabled: Bool) {
        loudnessCompensationEnabled = enabled
    }

    func setLoudnessEqualizationEnabled(_ enabled: Bool) {
        loudnessEqualizationEnabled = enabled
    }

    func setVolumeForInactive(identifier: String, to volume: Float) {
        inactiveVolumes[identifier] = volume
    }

    func setBoostForInactive(identifier: String, to boost: BoostLevel) {
        inactiveBoosts[identifier] = boost
    }

    func setMuteForInactive(identifier: String, to muted: Bool) {
        inactiveMutes[identifier] = muted
    }

    func getMuteForInactive(identifier: String) -> Bool {
        inactiveMutes[identifier] ?? false
    }

    func setEQSettingsForInactive(_ settings: EQSettings, identifier: String) {
        inactiveEQ[identifier] = settings
    }

    func setDeviceRoutingForInactive(identifier: String, deviceUID: String?) {
        inactiveDevices[identifier] = deviceUID
    }

    func setDeviceSelectionModeForInactive(identifier: String, to mode: DeviceSelectionMode) {
        inactiveModes[identifier] = mode
    }

    func setSelectedDeviceUIDsForInactive(identifier: String, to uids: Set<String>) {
        inactiveSelectedDevices[identifier] = uids
    }

    func pinApp(identifier: String, displayName: String?, bundleID: String?) {
        pinned[identifier] = PinnedAppInfo(
            persistenceIdentifier: identifier,
            displayName: displayName ?? identifier,
            bundleID: bundleID
        )
    }

    func unpinApp(_ identifier: String) {
        pinned.removeValue(forKey: identifier)
    }

    func ignoreApp(identifier: String, displayName: String?, bundleID: String?) {
        ignored[identifier] = IgnoredAppInfo(
            persistenceIdentifier: identifier,
            displayName: displayName ?? identifier,
            bundleID: bundleID
        )
    }

    func unignoreApp(_ identifier: String) {
        ignored.removeValue(forKey: identifier)
    }
}
