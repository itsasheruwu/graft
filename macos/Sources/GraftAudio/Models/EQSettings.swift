// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
import Foundation

package struct EQSettings: Codable, Equatable {
    package static let bandCount = 10
    package static let maxGainDB: Float = 12.0
    package static let minGainDB: Float = -12.0

    /// ISO standard frequencies for 10-band graphic EQ
    package static let frequencies: [Double] = [
        31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000
    ]

    /// Gain in dB for each band (-12 to +12)
    package var bandGains: [Float]

    /// Whether EQ processing is enabled
    package var isEnabled: Bool

    package init(bandGains: [Float] = Array(repeating: 0, count: 10), isEnabled: Bool = true) {
        self.bandGains = Self.normalizeBands(bandGains)
        self.isEnabled = isEnabled
    }

    package init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decoded = try container.decodeIfPresent([Float].self, forKey: .bandGains)
            ?? Array(repeating: 0, count: Self.bandCount)
        self.bandGains = Self.normalizeBands(decoded)
        self.isEnabled = try container.decodeIfPresent(Bool.self, forKey: .isEnabled) ?? true
    }

    /// Normalize band gains array to exactly `bandCount` elements,
    /// padding with 0 or truncating as needed.
    private static func normalizeBands(_ gains: [Float]) -> [Float] {
        if gains.count == bandCount { return gains }
        if gains.count > bandCount { return Array(gains.prefix(bandCount)) }
        return gains + Array(repeating: Float(0), count: bandCount - gains.count)
    }

    /// Returns gains clamped to valid range
    package var clampedGains: [Float] {
        bandGains.map { $0.isFinite ? max(Self.minGainDB, min(Self.maxGainDB, $0)) : 0 }
    }

    /// Flat EQ preset
    package static let flat = EQSettings()
}
