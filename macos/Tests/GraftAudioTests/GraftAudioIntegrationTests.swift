import Foundation
import Testing
@testable import GraftAudio

@Suite("Graft audio ownership and migration") @MainActor
struct GraftAudioIntegrationTests {
    private func directory() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    @Test func disabledAndConflictNeverCreateAnEngine() throws {
        let dir = try directory(); defer { try? FileManager.default.removeItem(at: dir) }
        let suite = "GraftAudioTests.\(UUID())"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let service = GraftAudioService(settings: SettingsManager(directory: dir), defaults: defaults, competingApp: { true }, restore: false)
        defer { service.shutdown() }
        #expect(!service.isEnabled)
        #expect(service.engine == nil)
        service.setEnabled(true)
        service.setEnabled(true)
        #expect(service.conflict)
        #expect(service.engine == nil)
        service.setEnabled(false)
        #expect(!service.conflict)
        #expect(service.engine == nil)
        #expect(!defaults.bool(forKey: "graft.audio.enabled"))
    }

    @Test func automationCannotEnableAudio() throws {
        let dir = try directory(); defer { try? FileManager.default.removeItem(at: dir) }
        let service = GraftAudioService(settings: SettingsManager(directory: dir), restore: false)
        defer { service.shutdown() }
        service.handleURL(URL(string: "graft://audio/set-volumes?app=com.example.app&volume=400")!)
        #expect(!service.isEnabled)
        #expect(service.engine == nil)
        #expect(service.message != nil)
        #expect(service.settings.getVolume(for: "com.example.app") == nil)
    }

    @Test func permissionUsesCaptureEvidenceAndCanBeRevoked() {
        let permission = AudioRecordingPermission()
        #expect(permission.status == .unknown)
        permission.request()
        #expect(permission.status == .unknown)
        permission.markAuthorizedFromCaptureSuccess()
        #expect(permission.status == .authorized)
        permission.markDeniedFromCaptureFailure()
        #expect(permission.status == .denied)
        permission.prepareCaptureRetry()
        #expect(permission.status == .unknown)
    }

    @Test func importPreservesSourceAndExcludesAppPreferences() throws {
        let dir = try directory(); defer { try? FileManager.default.removeItem(at: dir) }
        let manager = SettingsManager(directory: dir.appendingPathComponent("Graft"))
        manager.setVolume(for: "old", to: 0.25)
        var imported = SettingsManager.Settings()
        imported.appVolumes["new"] = 0.6
        imported.appSettings.launchAtLogin = true
        imported.appSettings.menuBarIconStyle = .speaker
        let source = dir.appendingPathComponent("settings.json")
        let original = try JSONEncoder().encode(imported)
        try original.write(to: source)
        try manager.replaceAudioSettings(SettingsManager.readImport(at: source))
        #expect(manager.getVolume(for: "new") == 0.6)
        #expect(manager.getVolume(for: "old") == nil)
        #expect(!manager.appSettings.launchAtLogin)
        #expect(manager.appSettings.menuBarIconStyle == .default)
        #expect(try Data(contentsOf: source) == original)
        let backups = try FileManager.default.contentsOfDirectory(at: manager.settingsDirectory.appendingPathComponent("Backups"), includingPropertiesForKeys: nil)
        #expect(backups.count == 1)
        let previous = try JSONDecoder().decode(SettingsManager.Settings.self, from: Data(contentsOf: backups[0].appendingPathComponent("settings.json")))
        #expect(previous.appVolumes["old"] == 0.25)
    }

    @Test func invalidProfileImportLeavesSettingsAndFilesUntouched() throws {
        let dir = try directory(); defer { try? FileManager.default.removeItem(at: dir) }
        let manager = SettingsManager(directory: dir.appendingPathComponent("Graft"))
        manager.setVolume(for: "old", to: 0.25); manager.flushSync()
        let oldData = try Data(contentsOf: manager.settingsDirectory.appendingPathComponent("settings.json"))
        let incoming = dir.appendingPathComponent("Incoming")
        try FileManager.default.createDirectory(at: incoming, withIntermediateDirectories: true)
        try "not a parametric EQ".write(to: incoming.appendingPathComponent("broken.txt"), atomically: true, encoding: .utf8)
        #expect(throws: (any Error).self) { try manager.replaceAudioSettings(SettingsManager.Settings(), profilesDirectory: incoming) }
        #expect(manager.getVolume(for: "old") == 0.25)
        #expect(try Data(contentsOf: manager.settingsDirectory.appendingPathComponent("settings.json")) == oldData)
    }

    @Test func emptyOrFutureImportsAreRejected() throws {
        let dir = try directory(); defer { try? FileManager.default.removeItem(at: dir) }
        let file = dir.appendingPathComponent("bad.json")
        for json in ["{}", "{\"version\":999,\"appVolumes\":{}}"] {
            try json.write(to: file, atomically: true, encoding: .utf8)
            #expect(throws: (any Error).self) { try SettingsManager.readImport(at: file) }
        }
        #expect(throws: (any Error).self) { try SettingsManager.validateHeadphoneFiles(["../outside.name": "bad"]) }
    }

    @Test func defaultsAreOptIn() throws {
        let dir = try directory(); defer { try? FileManager.default.removeItem(at: dir) }
        let manager = SettingsManager(directory: dir)
        #expect(!manager.appSettings.lockInputDevice)
        #expect(!manager.appSettings.softwareDeviceVolumeEnabled)
        #expect(!manager.appSettings.loudnessCompensationEnabled)
        #expect(!manager.appSettings.loudnessEqualizationEnabled)
        #expect(manager.appSettings.defaultNewAppVolume == 1)
    }
}

@Suite("Aggregate ownership")
struct GraftAggregateOwnershipTests {
    @Test func onlyGraftAggregatesAreEligibleForRecovery() {
        #expect(OrphanedTapCleanup.ownsAggregate(name: "GraftAudio-123", uid: "com.itsasheruwu.graft.audio.abc"))
        #expect(!OrphanedTapCleanup.ownsAggregate(name: "FineTune-123", uid: "com.finetune.abc"))
        #expect(!OrphanedTapCleanup.ownsAggregate(name: "GraftAudio-123", uid: "thirdparty"))
        #expect(!OrphanedTapCleanup.ownsAggregate(name: "Other-123", uid: "com.itsasheruwu.graft.audio.abc"))
    }
}

@Suite("Graft audio command validation") @MainActor
struct GraftAudioCommandValidationTests {
    @Test(arguments: [
        "finetune://set-volumes?app=a&volume=50",
        "graft://audio/set-volumes?app=a&volume=50&app=b&volume=oops",
        "graft://audio/set-volumes?app=a&volume=50&app=b",
        "graft://audio/set-eq?app=a&gains=nan,0,0,0,0,0,0,0,0,0",
        "graft://audio/set-autoeq?device=one&profile=p&enabled=oops",
        "graft://audio/reset/extra",
        "graft://audio/set-device-mode?app=a&mode=multi"
    ])
    func rejectsInvalidCommands(_ text: String) {
        #expect(!URLHandler.isValidCommand(URL(string: text)!))
    }
}

extension GraftAudioIntegrationTests {
    @Test func headphoneFilesTravelWithSettingsExports() throws {
        let dir = try directory(); defer { try? FileManager.default.removeItem(at: dir) }
        let manager = SettingsManager(directory: dir.appendingPathComponent("Audio"))
        let profiles = manager.settingsDirectory.appendingPathComponent("AutoEQ")
        try FileManager.default.createDirectory(at: profiles, withIntermediateDirectories: true)
        let filter = "Preamp: -6 dB\nFilter 1: ON PK Fc 100 Hz Gain -3 dB Q 1.0\n"
        try filter.write(to: profiles.appendingPathComponent("my-headphones.txt"), atomically: true, encoding: .utf8)
        try "My Headphones".write(to: profiles.appendingPathComponent("my-headphones.name"), atomically: true, encoding: .utf8)
        manager.setAutoEQSelection(for: "device-one", to: AutoEQSelection(profileID: "my-headphones", isEnabled: true))
        let exported = dir.appendingPathComponent("export.json")
        try manager.exportSettings(to: exported)
        let files = try #require(try SettingsManager.readHeadphoneFiles(at: exported))
        #expect(files["my-headphones.txt"] == filter)
        #expect(files["my-headphones.name"] == "My Headphones")
        let imported = try SettingsManager.readImport(at: exported)
        #expect(imported.deviceAutoEQ["device-one"]?.profileID == "my-headphones")
    }

    @Test func failedSettingsWriteRollsBackProfileReplacement() throws {
        let dir = try directory(); defer { try? FileManager.default.removeItem(at: dir) }
        let manager = SettingsManager(directory: dir.appendingPathComponent("Audio"))
        manager.setVolume(for: "old", to: 0.3); manager.flushSync()
        let profiles = manager.settingsDirectory.appendingPathComponent("AutoEQ")
        try FileManager.default.createDirectory(at: profiles, withIntermediateDirectories: true)
        let original = "Preamp: -6 dB\nFilter 1: ON PK Fc 100 Hz Gain -3 dB Q 1.0\n"
        try original.write(to: profiles.appendingPathComponent("old.txt"), atomically: true, encoding: .utf8)
        let incoming = dir.appendingPathComponent("Incoming")
        try FileManager.default.createDirectory(at: incoming, withIntermediateDirectories: true)
        try original.write(to: incoming.appendingPathComponent("new.txt"), atomically: true, encoding: .utf8)
        // An occupied directory at the destination forces the atomic file write to fail.
        let settingsURL = manager.settingsDirectory.appendingPathComponent("settings.json")
        try FileManager.default.removeItem(at: settingsURL)
        try FileManager.default.createDirectory(at: settingsURL, withIntermediateDirectories: true)
        try Data([1]).write(to: settingsURL.appendingPathComponent("occupied"))
        #expect(throws: (any Error).self) { try manager.replaceAudioSettings(SettingsManager.Settings(), profilesDirectory: incoming) }
        #expect(manager.getVolume(for: "old") == 0.3)
        #expect(try String(contentsOf: profiles.appendingPathComponent("old.txt"), encoding: .utf8) == original)
        #expect(!FileManager.default.fileExists(atPath: profiles.appendingPathComponent("new.txt").path))
    }
}
