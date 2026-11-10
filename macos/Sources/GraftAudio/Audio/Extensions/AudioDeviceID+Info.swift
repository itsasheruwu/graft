// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
// FineTune/Audio/Extensions/AudioDeviceID+Info.swift
import AudioToolbox
import Foundation

// MARK: - Device Information

extension AudioDeviceID {
    package func readDeviceName() throws -> String {
        try readString(kAudioObjectPropertyName)
    }

    package func readDeviceUID() throws -> String {
        try readString(kAudioDevicePropertyDeviceUID)
    }

    package func readNominalSampleRate() throws -> Float64 {
        try read(kAudioDevicePropertyNominalSampleRate, defaultValue: Float64(48000))
    }

    package func readTransportType() -> TransportType {
        let raw = (try? read(kAudioDevicePropertyTransportType, defaultValue: UInt32(0))) ?? 0
        return TransportType(rawValue: raw)
    }
}

// MARK: - Tap Properties

extension AudioObjectID {
    package func readAudioTapStreamBasicDescription() throws -> AudioStreamBasicDescription {
        try read(kAudioTapPropertyFormat, defaultValue: AudioStreamBasicDescription())
    }
}

// MARK: - Process Properties

extension AudioObjectID {
    package func readProcessPID() throws -> pid_t {
        try read(kAudioProcessPropertyPID, defaultValue: pid_t(0))
    }

    package func readProcessIsRunning() -> Bool {
        (try? readBool(kAudioProcessPropertyIsRunning)) ?? false
    }

    package func readProcessBundleID() -> String? {
        try? readString(kAudioProcessPropertyBundleID)
    }
}
