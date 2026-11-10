// FineTuneTests/AudioRecordingPermissionTests.swift

import Testing
import Foundation
@testable import GraftAudio

@Suite("Audio recording permission recovery")
@MainActor
struct AudioRecordingPermissionTests {

    @Test("System Settings recovery polling picks up a later grant")
    func settingsGrantRecoversWithoutRelaunch() async throws {
        var statuses: [AudioCapturePermissionStatus] = [.denied, .authorized]
        let permission = AudioRecordingPermission(
            preflightProvider: {
                statuses.isEmpty ? .authorized : statuses.removeFirst()
            },
            requestAccessProvider: { completion in
                completion(false)
            },
            recoveryPollingInterval: .milliseconds(20),
            recoveryPollingTimeout: .seconds(1)
        )

        #expect(permission.status == .denied)

        permission.prepareForSystemSettingsGrant()
        try await waitForAuthorized(permission)

        #expect(permission.status == .authorized)
    }

    @Test("Denied request starts recovery polling for manual Settings grant")
    func deniedRequestStillRecoversWhenSettingsGrantAppears() async throws {
        var statuses: [AudioCapturePermissionStatus] = [.unknown, .authorized]
        let permission = AudioRecordingPermission(
            preflightProvider: {
                statuses.isEmpty ? .authorized : statuses.removeFirst()
            },
            requestAccessProvider: { completion in
                completion(false)
            },
            recoveryPollingInterval: .milliseconds(20),
            recoveryPollingTimeout: .seconds(1)
        )

        #expect(permission.status == .unknown)

        permission.request()
        try await waitForAuthorized(permission)

        #expect(permission.status == .authorized)
    }

    @Test("Core Audio permission failures can mark permission denied")
    func tapFailureMarksPermissionDenied() {
        let permission = AudioRecordingPermission(
            preflightProvider: { .unknown },
            requestAccessProvider: { completion in completion(true) }
        )

        #expect(permission.status == .unknown)
        permission.markDeniedFromCaptureFailure()
        #expect(permission.status == .denied)
    }

    private func waitForAuthorized(_ permission: AudioRecordingPermission) async throws {
        for _ in 0..<20 {
            if permission.status == .authorized { return }
            try await Task.sleep(for: .milliseconds(50))
        }
    }
}
