// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
@MainActor
package protocol AudioProcessMonitoring: AnyObject {
    var activeApps: [AudioApp] { get }
    var onAppsChanged: (([AudioApp]) -> Void)? { get set }

    func start()
    func stop()
}
