import AppKit
import Foundation
import GraftCore
import Observation
import SwiftUI

@Observable
final class GraftStore {
    private(set) var state: GraftSharedState
    private(set) var connectionRefreshTick = 0
    var extensionID = UserDefaults.standard.string(forKey: "graftExtensionID") ?? ""
    var connectionMessage: String?

    let macTweaks = MacTweakService()
    let notifications: GraftNotificationService
    let robloxPresenceLogs: RobloxPresenceLogStore
    let robloxWatcher: RobloxPresenceWatcher
    let spotifyHistory: SpotifyListeningHistoryStore
    let spotifyWatcher: SpotifyFriendWatcher
    let spotifyIntegration: SpotifyIntegrationService
    let spotifyBridgeServer: SpotifyBridgeServer
    @ObservationIgnored private var refreshTask: Task<Void, Never>?

    init() {
        let notifications = GraftNotificationService()
        let robloxPresenceLogs = RobloxPresenceLogStore()
        let spotifyHistory = SpotifyListeningHistoryStore()
        let spotifyWatcher = SpotifyFriendWatcher(
            notifications: notifications,
            history: spotifyHistory
        )
        let spotifyIntegration = SpotifyIntegrationService()
        let spotifyBridgeServer = SpotifyBridgeServer(token: spotifyIntegration.bridgeToken) {
            payload, receivedAt in
            spotifyWatcher.ingest(payload, receivedAt: receivedAt)
        }
        self.notifications = notifications
        self.robloxPresenceLogs = robloxPresenceLogs
        self.spotifyHistory = spotifyHistory
        self.spotifyWatcher = spotifyWatcher
        self.spotifyIntegration = spotifyIntegration
        self.spotifyBridgeServer = spotifyBridgeServer
        robloxWatcher = RobloxPresenceWatcher(
            notifications: notifications,
            presenceLogs: robloxPresenceLogs
        )
        var loaded = GraftStateFile.load()
        for (key, value) in BrowserTweakCatalog.defaults where loaded.browserSettings[key] == nil {
            loaded.browserSettings[key] = value
        }
        state = loaded
        try? GraftStateFile.save(loaded)
        macTweaks.restore(loaded.macSettings)
        notifications.apply(loaded.macSettings)
        notifications.start()
        robloxWatcher.apply(robloxWatcherConfiguration(for: loaded))
        robloxWatcher.start()
        spotifyWatcher.apply(.init(settings: loaded.macSettings))
        spotifyWatcher.start()
        spotifyBridgeServer.start()
        refreshTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                self?.refreshFromDisk()
            }
        }
    }

    deinit {
        refreshTask?.cancel()
    }

    var isExtensionConnected: Bool {
        _ = connectionRefreshTick
        return GraftStateFile.extensionWasSeenRecently()
    }

    var canDeliverNativeNotifications: Bool {
        _ = connectionRefreshTick
        return notifications.canDeliverNotifications
    }

    var nativeNotificationStatusDetail: String {
        _ = connectionRefreshTick
        if let error = notifications.authorizationError {
            return "macOS notification authorization failed: \(error)"
        }
        switch notifications.authorizationStatus {
        case .authorized, .provisional:
            return "Player Watcher alerts are delivered by Graft for Mac."
        case .denied:
            return "Enable Graft notifications in System Settings to use native alerts."
        case .notDetermined:
            return "Waiting for macOS notification permission."
        @unknown default:
            return "macOS notification permission is unavailable."
        }
    }

    func value(for control: TweakControlDefinition) -> JSONValue {
        state.browserSettings[control.id] ?? control.defaultValue
    }

    func bool(for key: String, default fallback: Bool = false) -> Bool {
        state.browserSettings[key]?.boolValue ?? fallback
    }

    var robloxPlayerWatcherWhitelist: [String] {
        guard case .array(let values) = state.browserSettings["robloxPlayerWatcherWhitelist"] else { return [] }
        return values.compactMap(\.stringValue)
    }

    var spotifyDetectedFriends: [SpotifyKnownFriend] {
        spotifyHistory.knownFriends
    }

    var spotifyIntegrationStatus: SpotifyIntegrationStatus {
        _ = connectionRefreshTick
        return spotifyIntegration.status(bridgeServer: spotifyBridgeServer)
    }

    func isSpotifyFriendWhitelisted(_ friendURI: String) -> Bool {
        state.macSettings.spotifyWatcherWhitelist.contains {
            $0.caseInsensitiveCompare(friendURI) == .orderedSame
        }
    }

    func setSpotifyFriend(_ friendURI: String, whitelisted: Bool) {
        var settings = state.macSettings
        settings.spotifyWatcherWhitelist.removeAll {
            $0.caseInsensitiveCompare(friendURI) == .orderedSame
        }
        if whitelisted { settings.spotifyWatcherWhitelist.append(friendURI) }
        setMacSettings(settings)
    }

    func addRobloxPlayer(_ entry: String) async throws {
        let normalized = try await RobloxAccountResolver.resolve(entry)
        var entries = robloxPlayerWatcherWhitelist
        guard !entries.contains(where: { $0.caseInsensitiveCompare(normalized) == .orderedSame }), entries.count < 50 else { return }
        entries.append(normalized)
        setBrowserValue(.array(entries.map(JSONValue.string)), for: "robloxPlayerWatcherWhitelist")
    }

    func removeRobloxPlayer(_ entry: String) {
        let entries = robloxPlayerWatcherWhitelist.filter { $0 != entry }
        setBrowserValue(.array(entries.map(JSONValue.string)), for: "robloxPlayerWatcherWhitelist")
    }

    func setBrowserValue(_ value: JSONValue, for key: String) {
        state.browserSettings[key] = value
        state.pendingBrowserChanges[key] = value
        robloxWatcher.apply(robloxWatcherConfiguration(for: state))
        persist()
    }

    func macToggle(_ path: WritableKeyPath<MacSettings, Bool>) -> Binding<Bool> {
        Binding(
            get: { self.state.macSettings[keyPath: path] },
            set: { value in
                var settings = self.state.macSettings
                settings[keyPath: path] = value
                self.setMacSettings(settings)
            }
        )
    }

    func setMacSettings(_ settings: MacSettings) {
        let previous = state.macSettings
        state.macSettings = settings
        macTweaks.apply(settings, previous: previous)
        notifications.apply(settings)
        spotifyWatcher.apply(.init(settings: settings))
        persist()
    }

    func reapplyWindowSettings() {
        macTweaks.restore(state.macSettings)
    }

    func installNativeHost() {
        do {
            try NativeHostInstaller.install(extensionID: extensionID)
            UserDefaults.standard.set(extensionID, forKey: "graftExtensionID")
            robloxWatcher.apply(robloxWatcherConfiguration(for: state))
            connectionMessage = "Bridge installed. Reload Graft in Chrome to connect."
        } catch {
            connectionMessage = error.localizedDescription
        }
    }

    func openChromeExtensions() {
        do {
            try NativeHostInstaller.openChromeExtensions()
        } catch {
            connectionMessage = error.localizedDescription
        }
    }

    func openNotificationSettings() {
        guard let url = URL(string: "x-apple.systempreferences:com.apple.Notifications-Settings.extension") else { return }
        NSWorkspace.shared.open(url)
    }

    func installOrRepairSpotifyBridge() async {
        await spotifyIntegration.installOrRepair()
    }

    func removeSpotifyBridge() async {
        var settings = state.macSettings
        settings.spotifyWatcherEnabled = false
        setMacSettings(settings)
        await spotifyIntegration.removeBridge()
    }

    private func persist() {
        state.revision += 1
        do { try GraftStateFile.save(state) }
        catch { connectionMessage = "Could not save settings: \(error.localizedDescription)" }
    }

    private func refreshFromDisk() {
        connectionRefreshTick &+= 1
        spotifyIntegration.refresh()
        let diskState = GraftStateFile.load()
        if diskState.revision != state.revision || diskState.extensionSeenAt != state.extensionSeenAt {
            let previousMacSettings = state.macSettings
            state = diskState
            if diskState.macSettings != previousMacSettings {
                macTweaks.apply(diskState.macSettings, previous: previousMacSettings)
                notifications.apply(diskState.macSettings)
                spotifyWatcher.apply(.init(settings: diskState.macSettings))
            }
            robloxWatcher.apply(robloxWatcherConfiguration(for: diskState))
        }
    }

    private func robloxWatcherConfiguration(for state: GraftSharedState) -> RobloxPlayerWatcherConfiguration {
        var configuration = RobloxPlayerWatcherConfiguration(state: state)
        configuration.bridgeConfigured = NativeHostInstaller.isValidExtensionID(extensionID)
        return configuration
    }
}
