// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
// FineTune/Audio/Engine/CrossfadeOrchestrator.swift
import AudioToolbox
import os

/// Error types for crossfade and tap operations
package enum CrossfadeError: LocalizedError {
    case tapCreationFailed(OSStatus)
    case aggregateCreationFailed(OSStatus)
    case deviceNotReady
    case secondaryTapFailed
    case noTapDescription

    package var errorDescription: String? {
        switch self {
        case .tapCreationFailed(let status):
            return "Failed to create process tap: \(status)"
        case .aggregateCreationFailed(let status):
            return "Failed to create aggregate device: \(status)"
        case .deviceNotReady:
            return "Device not ready within timeout"
        case .secondaryTapFailed:
            return "Secondary tap invalid after timeout"
        case .noTapDescription:
            return "No tap description available"
        }
    }
}

/// Configuration for crossfade behavior during device switching.
/// The crossfade overlaps audio from old and new devices using equal-power curves
/// to maintain perceived loudness during the transition.
package enum CrossfadeConfig {
    /// 50ms is short enough to feel instantaneous but long enough to avoid clicks.
    /// Shorter durations risk audible artifacts; longer durations feel sluggish.
    /// Can be overridden via UserDefaults for testing/debugging.
    package static let defaultDuration: TimeInterval = 0.050  // 50ms

    package static var duration: TimeInterval {
        let custom = UserDefaults.standard.double(forKey: "graft.audio.crossfadeDuration")
        return custom > 0 ? custom : defaultDuration
    }

    package static func totalSamples(at sampleRate: Double) -> Int64 {
        max(1, Int64(sampleRate * duration))
    }
}
