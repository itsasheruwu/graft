// FineTuneTests/AudioEngineMacOS27CompatibilityTests.swift

import AppKit
import AudioToolbox
import Foundation
import Testing
@testable import GraftAudio

@Suite("AudioEngine macOS 27 compatibility")
@MainActor
struct AudioEngineMacOS27CompatibilityTests {

    @Test("Unknown audio capture permission still starts process monitoring and attempts taps")
    func unknownPermissionIsProvisional() async throws {
        let app = makeApp(objectIDs: [101])
        let processMonitor = MockProcessMonitor(apps: [app])
        let deviceMonitor = MockDeviceProvider()
        let volumeMonitor = MockDeviceVolumeProvider()
        var createdTaps: [MockTap] = []

        let engine = AudioEngine(
            permission: AudioRecordingPermission(preflightProvider: { .unknown }, requestAccessProvider: { $0(true) }),
            settingsManager: makeSettingsManager(),
            deviceProvider: deviceMonitor,
            processMonitor: processMonitor,
            deviceVolumeMonitor: volumeMonitor,
            tapFactory: { app, deviceUIDs, _ in
                let tap = MockTap(app: app, deviceUIDs: deviceUIDs)
                createdTaps.append(tap)
                return tap
            },
            startMonitorsAutomatically: false
        )

        engine.start()

        #expect(processMonitor.startCount == 1)
        #expect(engine.debugTapCount == 1)
        #expect(createdTaps.first?.didActivate == true)
        #expect(engine.debugTappedProcessObjectIDs(for: app.id) == [101])
    }

    @Test("Changed process object IDs recreate an existing tap")
    func processObjectChangeRecreatesTap() async throws {
        let initialApp = makeApp(objectIDs: [101])
        let changedApp = makeApp(objectIDs: [101, 102])
        let processMonitor = MockProcessMonitor(apps: [initialApp])
        let deviceMonitor = MockDeviceProvider()
        let volumeMonitor = MockDeviceVolumeProvider()
        let permission = AudioRecordingPermission(preflightProvider: { .authorized }, requestAccessProvider: { $0(true) })
        var createdTaps: [MockTap] = []

        let engine = AudioEngine(
            permission: permission,
            settingsManager: makeSettingsManager(),
            deviceProvider: deviceMonitor,
            processMonitor: processMonitor,
            deviceVolumeMonitor: volumeMonitor,
            tapFactory: { app, deviceUIDs, _ in
                let tap = MockTap(app: app, deviceUIDs: deviceUIDs)
                createdTaps.append(tap)
                return tap
            },
            startMonitorsAutomatically: false
        )

        engine.start()
        #expect(createdTaps.count == 1)

        processMonitor.publish([changedApp])
        try await Task.sleep(for: .milliseconds(100))

        #expect(createdTaps.count == 2)
        #expect(createdTaps[0].didInvalidateAsync == true)
        #expect(engine.debugTappedProcessObjectIDs(for: changedApp.id) == [101, 102])
    }

    @Test("Unchanged process object IDs do not recreate an existing tap")
    func unchangedProcessObjectsDoNotRecreateTap() async throws {
        let app = makeApp(objectIDs: [101])
        let processMonitor = MockProcessMonitor(apps: [app])
        let deviceMonitor = MockDeviceProvider()
        let volumeMonitor = MockDeviceVolumeProvider()
        let permission = AudioRecordingPermission(preflightProvider: { .authorized }, requestAccessProvider: { $0(true) })
        var createdTaps: [MockTap] = []

        let engine = AudioEngine(
            permission: permission,
            settingsManager: makeSettingsManager(),
            deviceProvider: deviceMonitor,
            processMonitor: processMonitor,
            deviceVolumeMonitor: volumeMonitor,
            tapFactory: { app, deviceUIDs, _ in
                let tap = MockTap(app: app, deviceUIDs: deviceUIDs)
                createdTaps.append(tap)
                return tap
            },
            startMonitorsAutomatically: false
        )

        engine.start()
        processMonitor.publish([app])
        try await Task.sleep(for: .milliseconds(100))

        #expect(createdTaps.count == 1)
    }

    private func makeApp(
        objectIDs: [AudioObjectID]
    ) -> AudioApp {
        AudioApp(
            id: 1234,
            processObjectIDs: objectIDs,
            name: "Browser",
            icon: NSImage(),
            bundleID: "com.example.browser",
            isHelperBacked: true
        )
    }

    private func makeSettingsManager() -> SettingsManager {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("FineTuneTests-\(UUID().uuidString)", isDirectory: true)
        return SettingsManager(directory: directory)
    }
}

@MainActor
private final class MockProcessMonitor: AudioProcessMonitoring {
    var activeApps: [AudioApp]
    var onAppsChanged: (([AudioApp]) -> Void)?
    var startCount = 0
    var stopCount = 0

    init(apps: [AudioApp]) {
        self.activeApps = apps
    }

    func start() {
        startCount += 1
    }

    func stop() {
        stopCount += 1
    }

    func publish(_ apps: [AudioApp]) {
        activeApps = apps
        onAppsChanged?(apps)
    }
}

@MainActor
private final class MockDeviceProvider: AudioDeviceProviding {
    var outputDevices: [AudioDevice] = [
        AudioDevice(id: 200, uid: "default-output", name: "Default Output", icon: nil, supportsAutoEQ: false)
    ]
    var inputDevices: [AudioDevice] = []
    var onDeviceDisconnected: ((String, String) -> Void)?
    var onDeviceConnected: ((String, String) -> Void)?
    var onInputDeviceDisconnected: ((String, String) -> Void)?
    var onInputDeviceConnected: ((String, String) -> Void)?

    func device(for uid: String) -> AudioDevice? {
        outputDevices.first { $0.uid == uid }
    }

    func inputDevice(for uid: String) -> AudioDevice? {
        inputDevices.first { $0.uid == uid }
    }

    func start() {}
    func stop() {}
}

@MainActor
private final class MockDeviceVolumeProvider: DeviceVolumeProviding {
    var defaultDeviceUID: String? = "default-output"
    var defaultInputDeviceUID: String?
    var volumes: [AudioDeviceID: Float] = [200: 1.0]
    var muteStates: [AudioDeviceID: Bool] = [200: false]
    var onVolumeChanged: ((AudioDeviceID, Float) -> Void)?
    var onMuteChanged: ((AudioDeviceID, Bool) -> Void)?
    var onDefaultDeviceChanged: ((String) -> Void)?
    var onDefaultInputDeviceChanged: ((String) -> Void)?

    func setDefaultDevice(_ deviceID: AudioDeviceID) -> Bool { true }
    func setDefaultInputDevice(_ deviceID: AudioDeviceID) -> Bool { true }
    func outputVolumeBackend(for deviceID: AudioDeviceID) -> VolumeControlTier { .hardware }
    func start() {}
    func stop() {}
}

private final class MockTap: ProcessTapControlling {
    let app: AudioApp
    var volume: Float = 1.0
    var isMuted = false
    var currentDeviceVolume: Float = 1.0
    var isDeviceMuted = false
    var audioLevel: Float = 0
    var currentDeviceUID: String? { currentDeviceUIDs.first }
    var currentDeviceUIDs: [String]
    var tapSourceDeviceUID: String?
    var tappedProcessObjectIDs: [AudioObjectID] { app.processObjectIDs }
    var didActivate = false
    var didInvalidate = false
    var didInvalidateAsync = false

    init(app: AudioApp, deviceUIDs: [String]) {
        self.app = app
        self.currentDeviceUIDs = deviceUIDs
    }

    func activate() throws { didActivate = true }
    func invalidate() { didInvalidate = true }
    func invalidateAsync() async { didInvalidateAsync = true }
    func updateEQSettings(_ settings: EQSettings) {}
    func updateAutoEQProfile(_ profile: AutoEQProfile?) {}
    func setAutoEQPreampEnabled(_ enabled: Bool) {}
    func updateLoudnessCompensation(volume: Float, enabled: Bool) {}
    func updateLoudnessEqualization(_ settings: LoudnessEqualizerSettings) {}
    func switchDevice(to newDeviceUID: String, preferredTapSourceDeviceUID: String?, sourceDeviceDead: Bool) async throws {
        currentDeviceUIDs = [newDeviceUID]
        tapSourceDeviceUID = preferredTapSourceDeviceUID
    }
    func updateDevices(to newDeviceUIDs: [String], preferredTapSourceDeviceUID: String?, sourceDeviceDead: Bool) async throws {
        currentDeviceUIDs = newDeviceUIDs
        tapSourceDeviceUID = preferredTapSourceDeviceUID
    }
    func hasRecentAudioCallback(within seconds: Double) -> Bool { true }
    func isHealthCheckEligible(minActiveSeconds: Double) -> Bool { true }
    func refreshTapSource(_ preferredDeviceUID: String?) async throws {
        tapSourceDeviceUID = preferredDeviceUID
    }
}

extension AudioEngineMacOS27CompatibilityTests {
    @Test("Repeated start and stop retain one tap and release it on shutdown")
    func lifecycleIsIdempotent() throws {
        let app = makeApp(objectIDs: [301])
        let processes = MockProcessMonitor(apps: [app])
        var created: [MockTap] = []
        let engine = AudioEngine(
            permission: AudioRecordingPermission(preflightProvider: { .unknown }),
            settingsManager: makeSettingsManager(), deviceProvider: MockDeviceProvider(),
            processMonitor: processes, deviceVolumeMonitor: MockDeviceVolumeProvider(),
            tapFactory: { app, uids, _ in let tap = MockTap(app: app, deviceUIDs: uids); created.append(tap); return tap },
            startMonitorsAutomatically: false)
        defer { engine.shutdown() }
        #expect(engine.debugTapCount == 0)
        engine.start(); engine.start()
        #expect(processes.startCount == 1)
        #expect(created.count == 1)
        #expect(engine.permission.status == .authorized)
        engine.shutdown()
        #expect(created[0].didInvalidate)
        #expect(engine.debugTapCount == 0)
        engine.applyPersistedSettings()
        #expect(engine.debugTapCount == 0)
        engine.start()
        #expect(created.count == 2)
        #expect(engine.debugTapCount == 1)
    }
}
