// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
import Foundation

/// A user-created EQ preset — a named EQ curve that can be applied to any app.
/// Stored in SettingsManager alongside built-in presets (EQPreset enum) which are not modified.
package struct UserEQPreset: Codable, Equatable, Identifiable {
    /// Stable unique identifier for this preset.
    package let id: UUID

    /// User-provided display name (e.g., "My Bass Boost", "Studio Monitor Correction").
    package var name: String

    /// The EQ band gains for this preset. Reuses the existing EQSettings model.
    /// The `isEnabled` field on EQSettings is ignored for presets — it's per-app state.
    /// When applying a preset to an app, the caller should copy `bandGains` only.
    package var settings: EQSettings

    /// When the preset was created (for display ordering).
    package let createdAt: Date

    package init(id: UUID = UUID(), name: String, settings: EQSettings, createdAt: Date = Date()) {
        self.id = id
        self.name = name
        self.settings = settings
        self.createdAt = createdAt
    }
}
