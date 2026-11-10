import AppKit
import Foundation
import Observation
import UserNotifications

/// App-lifetime owner. No dependency on browser connectivity or any particular window.
@Observable @MainActor
package final class GraftAudioService {
    package let settings: SettingsManager
    package private(set) var engine: AudioEngine?
    package private(set) var isEnabled = false
    package private(set) var conflict = false
    package var message: String?
    private let defaults: UserDefaults
    private let competingApp: () -> Bool
    private var recoveryTask: Task<Void, Never>?
    private var activationObserver: NSObjectProtocol?
    private var workspaceObservers: [NSObjectProtocol] = []
    private var suspended = false

    package init(settings: SettingsManager? = nil, defaults: UserDefaults = .standard,
                 competingApp: @escaping () -> Bool = {
                     NSWorkspace.shared.runningApplications.contains { $0.bundleIdentifier == "com.finetuneapp.FineTune" }
                 }, restore: Bool = true) {
        self.settings = settings ?? SettingsManager()
        self.defaults = defaults
        self.competingApp = competingApp
        activationObserver = NotificationCenter.default.addObserver(forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.retryCapture() }
        }
        let center = NSWorkspace.shared.notificationCenter
        workspaceObservers = [
            center.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.suspended = true; self?.shutdownEngine() }
            },
            center.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.suspended = false; self?.reconcile() }
            }
        ]
        if restore && defaults.bool(forKey: "graft.audio.enabled") { setEnabled(true) }
    }

    package var status: String {
        if !isEnabled { return "Audio management is off" }
        if conflict { return "Quit FineTune to start Graft audio" }
        guard let engine else { return "Starting audio…" }
        switch engine.permission.status {
        case .denied: return "Allow Graft in System Settings → Privacy & Security → Screen & System Audio Recording, then retry."
        case .unknown: return "Play audio in an app to finish checking system audio access."
        case .authorized: return "Managing audio on this Mac"
        }
    }

    package func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
        defaults.set(enabled, forKey: "graft.audio.enabled")
        recoveryTask?.cancel()
        recoveryTask = nil
        if !enabled {
            shutdownEngine()
            conflict = false
            return
        }
        reconcile()
        recoveryTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2))
                guard !Task.isCancelled else { return }
                self?.reconcile()
            }
        }
    }

    private func reconcile() {
        guard isEnabled, !suspended else { return }
        conflict = competingApp()
        if conflict { shutdownEngine(); return }
        if engine == nil {
            OrphanedTapCleanup.destroyOrphanedDevices()
            let created = AudioEngine(settingsManager: settings, startMonitorsAutomatically: false)
            engine = created
            created.start()
        }
    }

    package func retryCapture() {
        guard isEnabled, !competingApp() else { return }
        reconcile()
        guard let engine, engine.permission.status != .authorized else { return }
        engine.permission.prepareCaptureRetry()
        engine.processMonitor.start()
        engine.applyPersistedSettings()
    }

    package func openPermissionSettings() {
        NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AudioCapture")!)
    }

    private func shutdownEngine() {
        engine?.shutdown()
        engine = nil
        settings.flushSync()
    }

    package func shutdown() {
        recoveryTask?.cancel()
        recoveryTask = nil
        if let activationObserver { NotificationCenter.default.removeObserver(activationObserver) }
        activationObserver = nil
        workspaceObservers.forEach { NSWorkspace.shared.notificationCenter.removeObserver($0) }
        workspaceObservers.removeAll()
        shutdownEngine()
    }

    package func updateSettings(_ change: (inout AppSettings) -> Void) {
        let previousAlerts = settings.appSettings.showDeviceDisconnectAlerts
        var value = settings.appSettings
        change(&value)
        value.launchAtLogin = false
        settings.updateAppSettings(value)
        if value.showDeviceDisconnectAlerts && !previousAlerts {
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        }
        engine?.setLoudnessCompensationEnabled(value.loudnessCompensationEnabled)
        engine?.setLoudnessEqualizationEnabled(value.loudnessEqualizationEnabled)
        engine?.handleSoftwareVolumeSettingChanged()
        if value.lockInputDevice { engine?.handleInputLockEnabled() }
    }

    /// Automation cannot enable capture or silently claim permission.
    package func handleURL(_ url: URL) {
        guard url.scheme == "graft", url.host == "audio" else { return }
        guard isEnabled, !conflict, let engine, engine.permission.status == .authorized else {
            message = "Enable Audio and grant system audio access before running audio commands."
            return
        }
        guard URLHandler.isValidCommand(url) else { message = "Invalid audio command. No settings were changed."; return }
        URLHandler(audioEngine: engine).handleURL(url)
    }

    package var fineTuneDirectory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("FineTune")
    }

    package var hasFineTuneImport: Bool {
        !defaults.bool(forKey: "graft.audio.fineTuneImported") &&
        FileManager.default.fileExists(atPath: fineTuneDirectory.appendingPathComponent("settings.json").path)
    }

    package func previewFineTuneImport() throws -> String {
        let candidate = try SettingsManager.readImport(at: fineTuneDirectory.appendingPathComponent("settings.json"))
        let files = (try? FileManager.default.contentsOfDirectory(at: fineTuneDirectory.appendingPathComponent("AutoEQ"), includingPropertiesForKeys: nil)) ?? []
        return "Import \(candidate.appVolumes.count) app volume settings, \(candidate.pinnedApps.count) pinned apps, \(candidate.userEQPresets.count) EQ presets, \(candidate.audioProfiles.count) audio profiles, and \(files.filter { $0.pathExtension == "txt" }.count) headphone files. Graft’s current audio settings will be backed up before replacement. FineTune’s files stay intact."
    }

    package func importFineTune() throws {
        try importAudio(from: fineTuneDirectory.appendingPathComponent("settings.json"), profilesDirectory: fineTuneDirectory.appendingPathComponent("AutoEQ"))
        defaults.set(true, forKey: "graft.audio.fineTuneImported")
    }

    package func importAudio(from url: URL, profilesDirectory: URL? = nil) throws {
        // Decode and validate before touching playback or persisted state.
        let candidate = try SettingsManager.readImport(at: url)
        var incoming = profilesDirectory
        var staged: URL?
        defer { if let staged { try? FileManager.default.removeItem(at: staged) } }
        if profilesDirectory == nil, let files = try SettingsManager.readHeadphoneFiles(at: url) {
            let directory = settings.settingsDirectory.appendingPathComponent("Import-\(UUID().uuidString)")
            staged = directory
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            for (name, contents) in files { try contents.write(to: directory.appendingPathComponent(name), atomically: true, encoding: .utf8) }
            incoming = directory
        }
        shutdownEngine()
        defer { if isEnabled { reconcile() } }
        try settings.replaceAudioSettings(candidate, profilesDirectory: incoming)
        message = "Audio settings imported. Previous settings are in Audio/Backups."
    }
}
