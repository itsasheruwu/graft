// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
// FineTune/Audio/Types/TransportType.swift
import AudioToolbox

/// Represents how an audio device connects to the system.
/// See kAudioDeviceTransportType* constants in AudioHardware.h
package enum TransportType: Sendable, Hashable, CustomStringConvertible {
    case builtIn
    case usb
    case bluetooth
    case bluetoothLE
    case airPlay
    case virtual
    case thunderbolt
    case hdmi
    case displayPort
    case aggregate
    case unknown

    package init(rawValue: UInt32) {
        switch rawValue {
        case kAudioDeviceTransportTypeBuiltIn:     self = .builtIn
        case kAudioDeviceTransportTypeUSB:         self = .usb
        case kAudioDeviceTransportTypeBluetooth:   self = .bluetooth
        case kAudioDeviceTransportTypeBluetoothLE: self = .bluetoothLE
        case kAudioDeviceTransportTypeAirPlay:     self = .airPlay
        case kAudioDeviceTransportTypeVirtual:     self = .virtual
        case kAudioDeviceTransportTypeThunderbolt: self = .thunderbolt
        case kAudioDeviceTransportTypeHDMI:        self = .hdmi
        case kAudioDeviceTransportTypeDisplayPort: self = .displayPort
        case kAudioDeviceTransportTypeAggregate:   self = .aggregate
        default:                                    self = .unknown
        }
    }

    package var description: String {
        switch self {
        case .builtIn:     return "builtIn"
        case .usb:         return "usb"
        case .bluetooth:   return "bluetooth"
        case .bluetoothLE: return "bluetoothLE"
        case .airPlay:     return "airPlay"
        case .virtual:     return "virtual"
        case .thunderbolt: return "thunderbolt"
        case .hdmi:        return "hdmi"
        case .displayPort: return "displayPort"
        case .aggregate:   return "aggregate"
        case .unknown:     return "unknown"
        }
    }

    /// Default SF Symbol for this transport type.
    /// Used as fallback when device-specific icon unavailable.
    package var defaultIconSymbol: String {
        switch self {
        case .builtIn:     return "hifispeaker"
        case .usb:         return "headphones"
        case .bluetooth:   return "headphones"
        case .bluetoothLE: return "headphones"
        case .airPlay:     return "airplayaudio"
        case .virtual:     return "waveform"
        case .thunderbolt: return "bolt.horizontal"
        case .hdmi:        return "tv"
        case .displayPort: return "tv"
        case .aggregate:   return "speaker.wave.2"
        case .unknown:     return "hifispeaker"
        }
    }
}
