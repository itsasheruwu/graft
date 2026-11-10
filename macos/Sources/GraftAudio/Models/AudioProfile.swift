// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
import Foundation

/// Saved scene of per-app audio settings plus app-wide audio context.
package struct AudioProfile: Codable, Equatable, Identifiable {
    package let id: UUID
    package var name: String
    package let createdAt: Date
    package var appRules: [AudioProfileRule]
    package var defaultOutputDeviceUID: String?
    package var systemSoundsMode: SystemSoundsMode
    package var loudnessCompensationEnabled: Bool
    package var loudnessEqualizationEnabled: Bool

    package init(
        id: UUID = UUID(),
        name: String,
        createdAt: Date = Date(),
        appRules: [AudioProfileRule],
        defaultOutputDeviceUID: String? = nil,
        systemSoundsMode: SystemSoundsMode = .followsDefault,
        loudnessCompensationEnabled: Bool = false,
        loudnessEqualizationEnabled: Bool = false
    ) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
        self.appRules = appRules
        self.defaultOutputDeviceUID = defaultOutputDeviceUID
        self.systemSoundsMode = systemSoundsMode
        self.loudnessCompensationEnabled = loudnessCompensationEnabled
        self.loudnessEqualizationEnabled = loudnessEqualizationEnabled
    }
}

/// Per-app slice of an audio profile, keyed by FineTune persistence identifier.
package struct AudioProfileRule: Codable, Equatable, Identifiable {
    package var id: String { persistenceIdentifier }

    package let persistenceIdentifier: String
    package var displayName: String
    package var bundleID: String?
    package var volume: Float
    package var boost: BoostLevel
    package var muted: Bool
    package var eqSettings: EQSettings
    package var deviceSelectionMode: DeviceSelectionMode
    package var deviceUID: String?
    package var selectedDeviceUIDs: [String]

    package init(
        persistenceIdentifier: String,
        displayName: String,
        bundleID: String? = nil,
        volume: Float,
        boost: BoostLevel,
        muted: Bool,
        eqSettings: EQSettings,
        deviceSelectionMode: DeviceSelectionMode,
        deviceUID: String? = nil,
        selectedDeviceUIDs: [String] = []
    ) {
        self.persistenceIdentifier = persistenceIdentifier
        self.displayName = displayName
        self.bundleID = bundleID
        self.volume = volume
        self.boost = boost
        self.muted = muted
        self.eqSettings = eqSettings
        self.deviceSelectionMode = deviceSelectionMode
        self.deviceUID = deviceUID
        self.selectedDeviceUIDs = selectedDeviceUIDs
    }
}

package enum SystemSoundsMode: Codable, Equatable {
    case followsDefault
    case explicit(deviceUID: String)

    private enum CodingKeys: String, CodingKey {
        case mode, deviceUID
    }

    private enum Mode: String, Codable {
        case followsDefault, explicit
    }

    package init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let mode = try container.decodeIfPresent(Mode.self, forKey: .mode) ?? .followsDefault
        switch mode {
        case .followsDefault:
            self = .followsDefault
        case .explicit:
            let deviceUID = try container.decode(String.self, forKey: .deviceUID)
            self = .explicit(deviceUID: deviceUID)
        }
    }

    package func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .followsDefault:
            try container.encode(Mode.followsDefault, forKey: .mode)
        case .explicit(let deviceUID):
            try container.encode(Mode.explicit, forKey: .mode)
            try container.encode(deviceUID, forKey: .deviceUID)
        }
    }
}
