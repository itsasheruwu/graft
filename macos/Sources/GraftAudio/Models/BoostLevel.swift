// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
// FineTune/Models/BoostLevel.swift
import Foundation

/// Per-app volume boost multiplier
package enum BoostLevel: Float, CaseIterable, Codable {
    case x1 = 1.0
    case x2 = 2.0
    case x3 = 3.0
    case x4 = 4.0

    package var label: String {
        switch self {
        case .x1: "1x"
        case .x2: "2x"
        case .x3: "3x"
        case .x4: "4x"
        }
    }

    /// Next boost level (cycles: 1x → 2x → 3x → 4x → 1x)
    package var next: BoostLevel {
        switch self {
        case .x1: .x2
        case .x2: .x3
        case .x3: .x4
        case .x4: .x1
        }
    }

    /// Whether this boost level amplifies above unity
    package var isBoosted: Bool { self != .x1 }
}
