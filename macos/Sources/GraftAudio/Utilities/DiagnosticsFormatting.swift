// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
import Foundation

extension String {
    package var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}

extension Optional where Wrapped == String {
    package var nilIfEmpty: String? {
        guard let value = self, !value.isEmpty else { return nil }
        return value
    }
}

extension AudioCapturePermissionStatus {
    package var diagnosticsDescription: String {
        switch self {
        case .unknown: return "unknown"
        case .authorized: return "authorized"
        case .denied: return "denied"
        }
    }
}
