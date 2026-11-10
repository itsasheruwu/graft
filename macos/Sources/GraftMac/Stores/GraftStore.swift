import AppKit
import Foundation
import GraftCore
import GraftAudio
import Observation
import SwiftUI

@Observable
final class GraftStore {
    private(set) var state: GraftSharedState
    private(set) var connectionRefreshTick = 0
    var extensionID = UserDefaults.standard.string(forKey: "graftExtensionID") ?? ""
    var connectionMessage: String?

    let audio = GraftAudioService()
    var requestedDestination: AppDestination?

    let macTweaks = MacTweakService()
    let keepAwake = KeepAwakeService()
    let activity: GraftActivityStore
    let codexResets: CodexResetService
    let dmgInstaller: DMGInstallerService
    let notifications: GraftNotificationService
    let robloxPresenceLogs: RobloxPresenceLogStore
    let robloxWatcher: RobloxPresenceWatcher
    let spotifyHistory: SpotifyListeningHistoryStore
    let spotifyWatcher: SpotifyFriendWatcher
    let spotifyIntegration: SpotifyIntegrationService
    let spotifyBridgeServer: SpotifyBridgeServer
    @ObservationIgnored private var refreshTask: Task<Void, Never>?
    @ObservationIgnored private var lastConnectionState: Bool?
    @ObservationIgnored private var unsavedMutations: [(inout GraftSharedState) throws -> Void] = []

    init() {
        let activity = GraftActivityStore()
        self.activity = activity
        dmgInstaller = DMGInstallerService(activity: activity)
        let notifications = GraftNotificationService()
        let robloxPresenceLogs = RobloxPresenceLogStore()
        let spotifyHistory = SpotifyListeningHistoryStore()
        let spotifyWatcher = SpotifyFriendWatcher(
            notifications: notifications,
            history: spotifyHistory,
            activity: activity
        )
        let spotifyIntegration = SpotifyIntegrationService(activity: activity)
        let spotifyBridgeServer = SpotifyBridgeServer(token: spotifyIntegration.bridgeToken) {
            payload, receivedAt in
            spotifyWatcher.ingest(payload, receivedAt: receivedAt)
        }
        codexResets = CodexResetService(onRedeemed: { creditID in
            notifications.deliver(.init(
                id: "codex-reset-\(creditID)",
                title: "Codex reset used",
                message: "Graft automatically used a banked rate limit reset before it expired."
            ), preferences: .init())
        })
        self.notifications = notifications
        self.robloxPresenceLogs = robloxPresenceLogs
        self.spotifyHistory = spotifyHistory
        self.spotifyWatcher = spotifyWatcher
        self.spotifyIntegration = spotifyIntegration
        self.spotifyBridgeServer = spotifyBridgeServer
        robloxWatcher = RobloxPresenceWatcher(
            notifications: notifications,
            presenceLogs: robloxPresenceLogs,
            activity: activity
        )
        var loaded = GraftStateFile.load()
        var startupError: String?
        do {
            loaded = try GraftStateFile.update { latest in
                for (key, value) in BrowserTweakCatalog.defaults where latest.browserSettings[key] == nil {
                    latest.browserSettings[key] = value
                }
                for key in latest.pendingBrowserChanges.keys where latest.browserChangeTokens[key] == nil {
                    latest.browserChangeTokens[key] = UUID().uuidString
                }
            }
        } catch { startupError = "Could not load settings: \(error.localizedDescription)" }
        state = loaded
        connectionMessage = startupError
        if let startupError { activity.record(.settings, .failure, "Settings could not load", startupError, retry: .syncSettings) }
        keepAwake.onStopped = { [weak self] message, failed in
            guard let self else { return }
            self.activity.record(.keepAwake, failed ? .failure : .success, failed ? "Keep Awake failed" : "Keep Awake stopped", message, retry: failed ? .keepAwake : nil)
            self.commit { $0.macSettings.keepAwake = false; $0.macSettings.keepAwakeDeadline = nil }
        }
        keepAwake.apply(loaded.macSettings)
        codexResets.apply(enabled: loaded.macSettings.codexAutoUseResetsEnabled)
        dmgInstaller.apply(loaded.macSettings)
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
        commit { $0.setBrowserValue(value, for: key) }
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
        let baseline = state.macSettings
        var proposed = settings
        let sessionChanged = settings.keepAwake != baseline.keepAwake || settings.keepAwakeMode != baseline.keepAwakeMode || settings.keepAwakeAppBundleID != baseline.keepAwakeAppBundleID
        if sessionChanged {
            proposed.keepAwakeDeadline = settings.keepAwake ? settings.keepAwakeMode.duration.map { Date().addingTimeInterval($0) } : nil
            if settings.keepAwakeMode == .untilAppQuits {
                let app = NSRunningApplication.runningApplications(withBundleIdentifier: settings.keepAwakeAppBundleID).first { !$0.isTerminated }
                proposed.keepAwakeAppPID = app?.processIdentifier
                proposed.keepAwakeAppLaunchDate = app?.launchDate
            }
        }
        commit { try $0.mergeMacSettings(proposed, baseline: baseline) }
        if sessionChanged {
            activity.record(.keepAwake, .info, keepAwake.isActive ? "Keep Awake started" : "Keep Awake off", keepAwake.detail)
        }
    }

    private func applyRuntimeSettings(previous: MacSettings) {
        let settings = state.macSettings
        keepAwake.apply(settings)
        codexResets.apply(enabled: settings.codexAutoUseResetsEnabled)
        dmgInstaller.apply(settings)
        macTweaks.apply(settings, previous: previous)
        notifications.apply(settings)
        spotifyWatcher.apply(.init(settings: settings))
        robloxWatcher.apply(robloxWatcherConfiguration(for: state))
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

    private func commit(_ mutation: @escaping (inout GraftSharedState) throws -> Void) {
        let previous = state.macSettings
        do {
            let queued = unsavedMutations
            state = try GraftStateFile.update { latest in
                for pending in queued { try pending(&latest) }
                try mutation(&latest)
            }
            unsavedMutations.removeAll()
            connectionMessage = nil
            applyRuntimeSettings(previous: previous)
        }
        catch {
            unsavedMutations.append(mutation)
            connectionMessage = "Could not save settings: \(error.localizedDescription)"
            activity.record(.settings, .failure, "Settings could not save", error.localizedDescription, retry: .syncSettings, coalesce: true)
        }
    }

    private func refreshFromDisk() {
        connectionRefreshTick &+= 1
        spotifyIntegration.refresh()
        spotifyIntegration.checkAutoRepair(
            watcherEnabled: state.macSettings.spotifyWatcherEnabled,
            bridgeServer: spotifyBridgeServer
        )
        let connected = isExtensionConnected
        if lastConnectionState != connected {
            lastConnectionState = connected
            activity.record(.settings, connected ? .success : .warning, connected ? "Browser connected" : "Browser disconnected", connected ? "Settings synchronization is available." : "Queued changes are kept until the extension reconnects.", retry: connected ? nil : .syncSettings)
        }
        let diskState: GraftSharedState
        do { diskState = try GraftStateRepository(fileURL: GraftStateFile.stateURL).read() }
        catch {
            activity.record(.settings, .failure, "Settings could not read", error.localizedDescription, retry: .syncSettings, coalesce: true)
            return
        }
        if diskState.revision != state.revision || diskState.extensionSeenAt != state.extensionSeenAt {
            if !state.pendingBrowserChanges.isEmpty && diskState.pendingBrowserChanges.isEmpty {
                activity.record(.settings, .success, "Settings synced", "The browser acknowledged all queued changes.")
            }
            let previousMacSettings = state.macSettings
            state = diskState
            applyRuntimeSettings(previous: previousMacSettings)
        }
    }

    func retrySettingsSync() {
        commit { latest in
            for (key, value) in latest.browserSettings { latest.setBrowserValue(value, for: key) }
        }
        activity.record(.settings, isExtensionConnected ? .info : .warning, "Settings sync requested", isExtensionConnected ? "Waiting for browser acknowledgement." : "Extension is offline. Open Chrome and enable the Graft extension; queued changes will retry automatically.", retry: .syncSettings)
    }

    func checkSpotifyNow() {
        spotifyIntegration.refresh()
        spotifyWatcher.checkNow()
        let status = spotifyIntegrationStatus
        activity.record(.spotify, status == .connected ? .success : .warning, "Spotify connection checked", status.detail, retry: status == .connected ? nil : .repairSpotify, coalesce: true)
    }

    func retryActivity(_ entry: GraftActivityEntry) async {
        await activity.retry(entry) { [self] action in
            switch action {
            case .installDMG(let file): try await dmgInstaller.retry(file: file)
            case .cleanupDMG(let file, let volume, let applications, let trash):
                try await dmgInstaller.retryCleanup(file: file, volume: volume, applications: applications, trash: trash)
            case .checkRoblox: await robloxWatcher.checkNow()
            case .checkSpotify: checkSpotifyNow()
            case .repairSpotify: await installOrRepairSpotifyBridge()
            case .syncSettings: retrySettingsSync()
            case .keepAwake:
                var settings = state.macSettings
                settings.keepAwake = true
                setMacSettings(settings)
            }
        }
    }

    private func robloxWatcherConfiguration(for state: GraftSharedState) -> RobloxPlayerWatcherConfiguration {
        var configuration = RobloxPlayerWatcherConfiguration(state: state)
        configuration.bridgeConfigured = NativeHostInstaller.isValidExtensionID(extensionID)
        return configuration
    }
}
