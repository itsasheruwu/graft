// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
// FineTune/Models/AudioDevice.swift
import AppKit
import AudioToolbox

package struct AudioDevice: Identifiable, Hashable {
    package let id: AudioDeviceID
    package let uid: String
    package let name: String
    package let icon: NSImage?
    package let supportsAutoEQ: Bool

    package func hash(into hasher: inout Hasher) {
        hasher.combine(uid)
    }

    package static func == (lhs: AudioDevice, rhs: AudioDevice) -> Bool {
        lhs.uid == rhs.uid
    }
}
