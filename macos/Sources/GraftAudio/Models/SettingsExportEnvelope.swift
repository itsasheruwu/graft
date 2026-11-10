// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
import Foundation

package struct SettingsExportEnvelope: Codable, Equatable {
    package static let currentFormat = "com.graft.audio.settings"

    package var format: String
    package var exportedAt: Date
    package var appVersion: String
    package var settingsVersion: Int
    package var headphoneFiles: [String: String]? = nil
    package var settings: SettingsManager.Settings

    package init(
        format: String = Self.currentFormat,
        exportedAt: Date = Date(),
        appVersion: String,
        settingsVersion: Int,
        settings: SettingsManager.Settings
    ) {
        self.format = format
        self.exportedAt = exportedAt
        self.appVersion = appVersion
        self.settingsVersion = settingsVersion
        self.settings = settings
    }
}

package enum SettingsImportError: LocalizedError {
    case unsupportedFormat(String)

    package var errorDescription: String? {
        switch self {
        case .unsupportedFormat(let format):
            return "Unsupported FineTune settings format: \(format)"
        }
    }
}
