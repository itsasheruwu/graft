// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
import AudioToolbox

package enum VolumeControlTier: Equatable {
    case hardware
    case ddc
    case software
}

@MainActor
package protocol DeviceVolumeProviding: AnyObject {
    var defaultDeviceUID: String? { get }
    var defaultDeviceID: AudioDeviceID { get }
    var defaultInputDeviceUID: String? { get }
    var defaultInputDeviceID: AudioDeviceID { get }
    var systemDeviceUID: String? { get }
    var isSystemFollowingDefault: Bool { get }
    var alertVolume: Float { get }
    var volumes: [AudioDeviceID: Float] { get }
    var muteStates: [AudioDeviceID: Bool] { get }
    var inputVolumes: [AudioDeviceID: Float] { get }
    var inputMuteStates: [AudioDeviceID: Bool] { get }

    var onVolumeChanged: ((AudioDeviceID, Float) -> Void)? { get set }
    var onMuteChanged: ((AudioDeviceID, Bool) -> Void)? { get set }
    var onDefaultDeviceChanged: ((String) -> Void)? { get set }
    var onDefaultInputDeviceChanged: ((String) -> Void)? { get set }

    @discardableResult
    func setDefaultDevice(_ deviceID: AudioDeviceID) -> Bool
    @discardableResult
    func setDefaultInputDevice(_ deviceID: AudioDeviceID) -> Bool

    func setVolume(for deviceID: AudioDeviceID, to volume: Float)
    func setMute(for deviceID: AudioDeviceID, to muted: Bool)
    func setInputVolume(for deviceID: AudioDeviceID, to volume: Float)
    func setInputMute(for deviceID: AudioDeviceID, to muted: Bool)
    func outputVolumeBackend(for deviceID: AudioDeviceID) -> VolumeControlTier
    func outputProcessingGain(for deviceID: AudioDeviceID) -> Float
    func refreshOutputDeviceStates()
    func setSystemFollowDefault()
    func setSystemDeviceExplicit(_ deviceID: AudioDeviceID)
    func refreshAlertVolume()
    func setAlertVolume(_ volume: Float)

    func start()
    func stop()

    /// Called after DDC probe completes to refresh volume/mute states.
    /// Default implementation is a no-op (only relevant for DDC-capable monitors).
    func refreshAfterDDCProbe()
}

extension DeviceVolumeProviding {
    package var defaultDeviceID: AudioDeviceID { .unknown }
    package var defaultInputDeviceID: AudioDeviceID { .unknown }
    package var systemDeviceUID: String? { nil }
    package var isSystemFollowingDefault: Bool { true }
    package var alertVolume: Float { 1.0 }
    package var inputVolumes: [AudioDeviceID: Float] { [:] }
    package var inputMuteStates: [AudioDeviceID: Bool] { [:] }

    package func outputProcessingGain(for deviceID: AudioDeviceID) -> Float {
        1.0
    }

    package func refreshOutputDeviceStates() {}

    package func refreshAfterDDCProbe() {}

    package func setVolume(for deviceID: AudioDeviceID, to volume: Float) {}
    package func setMute(for deviceID: AudioDeviceID, to muted: Bool) {}
    package func setInputVolume(for deviceID: AudioDeviceID, to volume: Float) {}
    package func setInputMute(for deviceID: AudioDeviceID, to muted: Bool) {}
    package func setSystemFollowDefault() {}
    package func setSystemDeviceExplicit(_ deviceID: AudioDeviceID) {}
    package func refreshAlertVolume() {}
    package func setAlertVolume(_ volume: Float) {}
}
