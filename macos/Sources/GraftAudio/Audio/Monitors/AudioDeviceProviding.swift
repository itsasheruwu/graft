// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
import AudioToolbox

@MainActor
package protocol AudioDeviceProviding: AnyObject {
    var outputDevices: [AudioDevice] { get }
    var inputDevices: [AudioDevice] { get }

    var onDeviceDisconnected: ((_ uid: String, _ name: String) -> Void)? { get set }
    var onDeviceConnected: ((_ uid: String, _ name: String) -> Void)? { get set }
    var onInputDeviceDisconnected: ((_ uid: String, _ name: String) -> Void)? { get set }
    var onInputDeviceConnected: ((_ uid: String, _ name: String) -> Void)? { get set }

    func device(for uid: String) -> AudioDevice?
    func inputDevice(for uid: String) -> AudioDevice?

    func start()
    func stop()
}
