import AppKit
import GraftCore
import IOKit.pwr_mgt
import Observation

@Observable
final class KeepAwakeService: NSObject {
    private(set) var isActive = false
    private(set) var detail = "Off"
    var onStopped: ((String, Bool) -> Void)?
    private var settings = MacSettings()
    private var assertion: IOPMAssertionID?
    @ObservationIgnored private var monitor: Task<Void, Never>?
    @ObservationIgnored private let now: () -> Date
    @ObservationIgnored private let targetIsRunning: (MacSettings) -> Bool
    @ObservationIgnored private let createAssertion: () throws -> IOPMAssertionID
    @ObservationIgnored private let releaseAssertion: (IOPMAssertionID) -> Void

    init(
        now: @escaping () -> Date = Date.init,
        targetIsRunning: @escaping (MacSettings) -> Bool = { settings in
            guard let pid = settings.keepAwakeAppPID,
                  let app = NSRunningApplication(processIdentifier: pid), !app.isTerminated,
                  app.bundleIdentifier == settings.keepAwakeAppBundleID else { return false }
            // ISO-8601 persistence has whole-second precision.
            if let expected = settings.keepAwakeAppLaunchDate, let actual = app.launchDate {
                return abs(expected.timeIntervalSince(actual)) < 1
            }
            return true
        },
        createAssertion: @escaping () throws -> IOPMAssertionID = {
            var id: IOPMAssertionID = 0
            let result = IOPMAssertionCreateWithName(
                kIOPMAssertionTypePreventUserIdleDisplaySleep as CFString,
                IOPMAssertionLevel(kIOPMAssertionLevelOn), "Graft Keep Awake" as CFString, &id
            )
            guard result == kIOReturnSuccess else {
                throw NSError(domain: "Graft.KeepAwake", code: Int(result), userInfo: [NSLocalizedDescriptionKey: "macOS could not start Keep Awake (\(result))."])
            }
            return id
        },
        releaseAssertion: @escaping (IOPMAssertionID) -> Void = { _ = IOPMAssertionRelease($0) },
        automaticallyMonitor: Bool = true
    ) {
        self.now = now
        self.targetIsRunning = targetIsRunning
        self.createAssertion = createAssertion
        self.releaseAssertion = releaseAssertion
        super.init()
        if automaticallyMonitor {
            NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(appTerminated(_:)), name: NSWorkspace.didTerminateApplicationNotification, object: nil)
            monitor = Task { [weak self] in
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(1))
                    guard !Task.isCancelled else { return }
                    self?.checkNow()
                }
            }
        }
    }

    isolated deinit {
        monitor?.cancel()
        NSWorkspace.shared.notificationCenter.removeObserver(self)
        if let assertion { releaseAssertion(assertion) }
    }

    func apply(_ settings: MacSettings) {
        self.settings = settings
        guard settings.keepAwake else { release(); detail = "Off"; return }
        if let reason = stopReason() { stop(reason); return }
        if assertion == nil {
            do { assertion = try createAssertion(); isActive = true }
            catch { stop(error.localizedDescription, failed: true); return }
        }
        switch settings.keepAwakeMode {
        case .untilTurnedOff: detail = "Active until turned off or Graft exits"
        case .thirtyMinutes, .twoHours:
            detail = "Active until \(settings.keepAwakeDeadline?.formatted(date: .omitted, time: .shortened) ?? "timer ends")"
        case .untilAppQuits:
            let name = settings.keepAwakeAppPID.flatMap { NSRunningApplication(processIdentifier: $0)?.localizedName } ?? settings.keepAwakeAppBundleID
            detail = "Active until \(name) quits or Graft exits"
        }
    }

    func checkNow() {
        guard settings.keepAwake, let reason = stopReason() else { return }
        stop(reason)
    }

    func shutdown() {
        monitor?.cancel()
        release()
        settings.keepAwake = false
        detail = "Off"
    }

    @objc private func appTerminated(_ notification: Notification) { checkNow() }

    private func stopReason() -> String? {
        switch settings.keepAwakeMode {
        case .thirtyMinutes, .twoHours:
            guard let deadline = settings.keepAwakeDeadline else { return "Choose a duration and start Keep Awake again." }
            return now() >= deadline ? "Keep Awake timer finished." : nil
        case .untilAppQuits:
            return targetIsRunning(settings) ? nil : "The chosen app is no longer running."
        case .untilTurnedOff: return nil
        }
    }

    private func stop(_ message: String, failed: Bool = false) {
        release()
        settings.keepAwake = false
        detail = message
        onStopped?(message, failed)
    }

    private func release() {
        if let assertion { releaseAssertion(assertion); self.assertion = nil }
        isActive = false
    }
}
