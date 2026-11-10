// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
// FineTune/Models/AudioApp.swift
import AppKit
import AudioToolbox

package struct AudioApp: Identifiable, Hashable {
    package let id: pid_t
    package let processObjectIDs: [AudioObjectID]
    package let name: String
    package let icon: NSImage
    package let bundleID: String?
    package let isHelperBacked: Bool

    package init(
        id: pid_t,
        processObjectIDs: [AudioObjectID],
        name: String,
        icon: NSImage,
        bundleID: String?,
        isHelperBacked: Bool = false
    ) {
        self.id = id
        self.processObjectIDs = processObjectIDs
        self.name = name
        self.icon = icon
        self.bundleID = bundleID
        self.isHelperBacked = isHelperBacked
    }

    package var persistenceIdentifier: String {
        bundleID ?? "name:\(name)"
    }

    package func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    package static func == (lhs: AudioApp, rhs: AudioApp) -> Bool {
        lhs.id == rhs.id
    }
}
