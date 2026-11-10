// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
// FineTune/Audio/Types/AudioScope.swift
import AudioToolbox

/// Represents Core Audio property scopes for type-safe property access.
///
/// Future additions if needed:
/// - `playthrough` (kAudioDevicePropertyScopePlayThrough)
/// - `wildcard` (kAudioObjectPropertyScopeWildcard)
package enum AudioScope: Sendable {
    case global
    case input
    case output

    package var propertyScope: AudioObjectPropertyScope {
        switch self {
        case .global: return kAudioObjectPropertyScopeGlobal
        case .input:  return kAudioObjectPropertyScopeInput
        case .output: return kAudioObjectPropertyScopeOutput
        }
    }
}
