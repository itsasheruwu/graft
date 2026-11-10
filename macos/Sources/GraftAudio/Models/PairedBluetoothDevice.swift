// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
// FineTune/Models/PairedBluetoothDevice.swift
import AppKit

/// A Bluetooth device that is paired with macOS but not currently connected.
/// These devices are not visible in the CoreAudio HAL.
package struct PairedBluetoothDevice: Identifiable, Hashable {
    /// MAC address string "XX:XX:XX:XX:XX:XX" — stable identity across sessions
    package let id: String
    package let name: String
    package let icon: NSImage?

    package func hash(into hasher: inout Hasher) { hasher.combine(id) }
    package static func == (lhs: Self, rhs: Self) -> Bool { lhs.id == rhs.id }
}
