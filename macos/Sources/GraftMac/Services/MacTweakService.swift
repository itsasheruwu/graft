import AppKit
import Foundation
import GraftCore

final class MacTweakService {
    private var caffeinateProcess: Process?

    func restore(_ settings: MacSettings) { applyRuntimeSettings(settings) }

    func apply(_ settings: MacSettings, previous: MacSettings) {
        applyRuntimeSettings(settings)
        var restartedFinder = false
        if settings.showHiddenFinderFiles != previous.showHiddenFinderFiles {
            run("/usr/bin/defaults", ["write", "com.apple.finder", "AppleShowAllFiles", "-bool", settings.showHiddenFinderFiles ? "true" : "false"])
            restartedFinder = true
        }
        if settings.hideDesktopIcons != previous.hideDesktopIcons {
            run("/usr/bin/defaults", ["write", "com.apple.finder", "CreateDesktop", "-bool", settings.hideDesktopIcons ? "false" : "true"])
            restartedFinder = true
        }
        if restartedFinder {
            run("/usr/bin/killall", ["Finder"])
        }
    }

    private func applyRuntimeSettings(_ settings: MacSettings) {
        setKeepAwake(settings.keepAwake)
        // `NSApp` is still nil while the store is built during app initialization;
        // ContentView reapplies the window level once the window actually exists.
        guard let app = NSApp else { return }
        for window in app.windows where window.canBecomeKey {
            window.level = settings.floatGraftWindow ? .floating : .normal
        }
    }

    private func setKeepAwake(_ enabled: Bool) {
        if enabled, caffeinateProcess?.isRunning != true {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/caffeinate")
            process.arguments = ["-d", "-i"]
            try? process.run()
            caffeinateProcess = process
        } else if !enabled, let process = caffeinateProcess, process.isRunning {
            process.terminate()
            caffeinateProcess = nil
        }
    }

    private func run(_ executable: String, _ arguments: [String]) {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        try? process.run()
    }
}
