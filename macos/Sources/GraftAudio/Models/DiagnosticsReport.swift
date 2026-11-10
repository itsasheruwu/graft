// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
import Foundation

package struct DiagnosticsReport: Codable, Equatable {
    package var generatedAt: Date
    package var appVersion: String
    package var macOSVersion: String
    package var permissionStatus: String
    package var settings: SettingsDiagnosticsSnapshot
    package var outputDevices: [DiagnosticsDevice]
    package var inputDevices: [DiagnosticsDevice]
    package var apps: [DiagnosticsApp]
    package var autoEQ: AutoEQCacheStatus
    package var ddcBackedDeviceIDs: [UInt32]
}

package struct SettingsDiagnosticsSnapshot: Codable, Equatable {
    package var settingsVersion: Int
    package var appVolumeCount: Int
    package var mutedAppCount: Int
    package var boostedAppCount: Int
    package var routedAppCount: Int
    package var eqAppCount: Int
    package var pinnedAppCount: Int
    package var ignoredAppCount: Int
    package var profileCount: Int
    package var favoriteAutoEQProfileCount: Int
    package var deviceAutoEQCount: Int
    package var outputPriorityCount: Int
    package var inputPriorityCount: Int
}

package struct DiagnosticsDevice: Codable, Equatable {
    package var uid: String
    package var name: String
    package var isDefault: Bool
    package var transportType: String
    package var supportsAutoEQ: Bool
}

package struct DiagnosticsApp: Codable, Equatable {
    package var persistenceIdentifier: String
    package var displayName: String
    package var bundleID: String?
    package var volume: Float
    package var boost: String
    package var muted: Bool
    package var deviceSelectionMode: String
    package var deviceUID: String?
    package var selectedDeviceUIDs: [String]
    package var eqEnabled: Bool
}

package struct AutoEQCacheStatus: Codable, Equatable {
    package var catalogEntryCount: Int
    package var catalogState: String
    package var lastCatalogRefresh: Date?
    package var cachedFetchedProfileCount: Int
    package var importedProfileCount: Int
}
