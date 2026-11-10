// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
// FineTune/Models/AutoEQProfile.swift

/// A single biquad filter in an AutoEQ correction profile.
package struct AutoEQFilter: Codable, Equatable {
    package enum FilterType: String, Codable {
        case peaking, lowShelf, highShelf
    }
    package let type: FilterType
    package let frequency: Double    // Hz
    package let gainDB: Float        // dB
    package let q: Double            // Quality factor
}

/// A headphone/speaker correction profile from AutoEQ.
package struct AutoEQProfile: Codable, Equatable, Identifiable {
    package let id: String           // Slug for fetched, UUID for imported
    package let name: String         // "Sennheiser HD 600"
    package let source: AutoEQSource
    package let preampDB: Float      // Negative preamp to prevent clipping
    package let filters: [AutoEQFilter]
    /// Measurement source (e.g. "oratory1990", "crinacle"). Nil for imported profiles.
    package let measuredBy: String?
    /// Sample rate the filter parameters were optimized for (Hz).
    package var optimizedSampleRate: Double

    package static let maxFilters = 10

    package enum CodingKeys: String, CodingKey {
        case id, name, source, preampDB, filters, measuredBy, optimizedSampleRate
    }

    package init(
        id: String, name: String, source: AutoEQSource,
        preampDB: Float, filters: [AutoEQFilter],
        measuredBy: String? = nil,
        optimizedSampleRate: Double = 48000
    ) {
        self.id = id
        self.name = name
        self.source = source
        self.preampDB = preampDB
        self.filters = filters
        self.measuredBy = measuredBy
        self.optimizedSampleRate = optimizedSampleRate
    }

    package init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        source = try container.decode(AutoEQSource.self, forKey: .source)
        preampDB = try container.decode(Float.self, forKey: .preampDB)
        filters = try container.decode([AutoEQFilter].self, forKey: .filters)
        measuredBy = try container.decodeIfPresent(String.self, forKey: .measuredBy)
        optimizedSampleRate = try container.decodeIfPresent(Double.self, forKey: .optimizedSampleRate) ?? 48000
    }
}

extension AutoEQProfile {
    /// Validates filters using the same rules as the text parser.
    package func validated() -> AutoEQProfile {
        let validFilters = filters.filter { f in
            f.frequency > 0 && f.q > 0 && abs(f.gainDB) <= 30
        }
        let clampedPreamp = max(-30, min(30, preampDB))
        return AutoEQProfile(
            id: id, name: name, source: source,
            preampDB: clampedPreamp,
            filters: Array(validFilters.prefix(Self.maxFilters)),
            measuredBy: measuredBy,
            optimizedSampleRate: optimizedSampleRate
        )
    }
}

/// Where a profile came from.
package enum AutoEQSource: String, Codable {
    case bundled, imported, fetched
}

/// Lightweight catalog entry for the AutoEQ search index (no filter data).
/// Populated from the AutoEQ GitHub INDEX.md.
package struct AutoEQCatalogEntry: Codable, Identifiable, Equatable {
    package let id: String           // Slugified name
    package let name: String         // "AKG K240 Studio"
    package let measuredBy: String   // "oratory1990"
    package let relativePath: String // "oratory1990/over-ear/AKG K240 Studio"
}

/// Per-device AutoEQ selection (stored in settings).
package struct AutoEQSelection: Codable, Equatable {
    package let profileID: String
    package var isEnabled: Bool
}
