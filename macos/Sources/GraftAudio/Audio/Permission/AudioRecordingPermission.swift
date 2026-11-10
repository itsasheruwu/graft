// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
// FineTune/Audio/Permission/AudioRecordingPermission.swift
import Foundation
import AppKit
import os

private let logger = Logger(subsystem: "com.graft.audio", category: "Permission")

// MARK: - Permission Status

package enum AudioCapturePermissionStatus {
    case unknown
    case authorized
    case denied
}

// MARK: - AudioRecordingPermission

@Observable
@MainActor
package final class AudioRecordingPermission {

    package private(set) var status: AudioCapturePermissionStatus = .unknown
    private let preflightProvider: () -> AudioCapturePermissionStatus
    private let requestAccessProvider: (@escaping (Bool) -> Void) -> Void
    private let notificationCenter: NotificationCenter
    private let recoveryPollingInterval: Duration
    private let recoveryPollingTimeout: Duration
    private var activationObserver: NSObjectProtocol?
    private var recoveryPollingTask: Task<Void, Never>?

    package init(
        preflightProvider: (() -> AudioCapturePermissionStatus)? = nil,
        requestAccessProvider: (((@escaping (Bool) -> Void) -> Void))? = nil,
        notificationCenter: NotificationCenter = .default,
        recoveryPollingInterval: Duration = .seconds(1),
        recoveryPollingTimeout: Duration = .seconds(300)
    ) {
        self.preflightProvider = preflightProvider ?? Self.currentStatus
        self.requestAccessProvider = requestAccessProvider ?? Self.requestAccess
        self.notificationCenter = notificationCenter
        self.recoveryPollingInterval = recoveryPollingInterval
        self.recoveryPollingTimeout = recoveryPollingTimeout
        refreshStatus()
        registerForActivation()
    }

    deinit {
        MainActor.assumeIsolated {
            recoveryPollingTask?.cancel()
            if let activationObserver {
                notificationCenter.removeObserver(activationObserver)
            }
        }
    }

    /// Check current TCC status without prompting.
    package func refreshStatus() {
        let newStatus = preflightProvider()
        if newStatus != .unknown { status = newStatus }
        if newStatus == .authorized {
            stopRecoveryPolling()
        }
        logger.debug("Audio capture permission preflight: \(String(describing: newStatus))")
    }

    /// Trigger the system permission dialog. Only shows once per app per TCC service.
    /// Subsequent calls are no-ops at the OS level.
    package func request() {
        guard status != .authorized else { return }
        requestAccessProvider { [weak self] granted in
            Task { @MainActor in
                guard let self else { return }
                self.status = granted ? .authorized : .denied
                if granted {
                    self.stopRecoveryPolling()
                } else {
                    self.startRecoveryPolling()
                }
                logger.info("Audio capture permission request result: \(granted)")
            }
        }
        startRecoveryPolling()
    }

    /// Called when Core Audio reports a permission failure while creating a process tap.
    /// This keeps the UI in sync even when preflight SPI is unavailable or stale.
    package func markDeniedFromCaptureFailure() {
        status = .denied
        startRecoveryPolling()
    }

    /// System Settings changes do not always reactivate FineTune immediately.
    /// Poll briefly after sending the user there so granting access can recover in place.
    package func prepareForSystemSettingsGrant() {
        guard status != .authorized else { return }
        startRecoveryPolling()
    }

    // MARK: - App Activation Observer

    private func registerForActivation() {
        activationObserver = notificationCenter.addObserver(
            forName: NSApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.refreshStatus()
            }
        }
    }

    private func startRecoveryPolling() {
        guard recoveryPollingTask == nil else { return }

        let interval = recoveryPollingInterval
        let timeout = recoveryPollingTimeout
        recoveryPollingTask = Task { [weak self] in
            let startedAt = ContinuousClock.now
            while !Task.isCancelled {
                try? await Task.sleep(for: interval)

                let status = await MainActor.run { () -> AudioCapturePermissionStatus? in
                    guard let self else { return nil }
                    self.refreshStatus()
                    return self.status
                }

                guard !Task.isCancelled else { break }
                guard status != .authorized else { break }
                guard startedAt.duration(to: ContinuousClock.now) < timeout else { break }
            }

            await MainActor.run {
                if self?.recoveryPollingTask?.isCancelled == false {
                    self?.recoveryPollingTask = nil
                }
            }
        }
    }

    private func stopRecoveryPolling() {
        recoveryPollingTask?.cancel()
        recoveryPollingTask = nil
    }

    package func markAuthorizedFromCaptureSuccess() {
        status = .authorized
        stopRecoveryPolling()
    }

    package func prepareCaptureRetry() { status = .unknown }

    private static func currentStatus() -> AudioCapturePermissionStatus { .unknown }
    private static func requestAccess(completion: @escaping (Bool) -> Void) {
        // The user-initiated CoreAudio tap attempt triggers the system prompt.
        // Unknown remains unknown until CoreAudio confirms capture.
    }
}
