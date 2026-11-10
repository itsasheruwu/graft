import AppKit
import SwiftUI
import GraftAudio

final class GraftAppDelegate: NSObject, NSApplicationDelegate {
    var audio: GraftAudioService?
    var keepAwake: KeepAwakeService?
    private var terminationSource: DispatchSourceSignal?
    func applicationWillTerminate(_ notification: Notification) { keepAwake?.shutdown(); audio?.shutdown() }
    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls { audio?.handleURL(url) }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // The project launcher uses SIGTERM. Convert it into orderly AppKit shutdown
        // so aggregate teardown completes before the process exits.
        signal(SIGTERM, SIG_IGN)
        let source = DispatchSource.makeSignalSource(signal: SIGTERM, queue: .main)
        source.setEventHandler { NSApplication.shared.terminate(nil) }
        source.resume()
        terminationSource = source
        NSApp.setActivationPolicy(.regular)
        NSApp.activate()
    }
}

@main
struct GraftMacApp: App {
    @NSApplicationDelegateAdaptor(GraftAppDelegate.self) private var appDelegate
    @State private var store: GraftStore

    init() {
        let store = GraftStore()
        _store = State(initialValue: store)
        _appDelegate.wrappedValue.audio = store.audio
        _appDelegate.wrappedValue.keepAwake = store.keepAwake
    }

    var body: some Scene {
        // A single settings-style window, so `Window` rather than `WindowGroup`:
        // openWindow(id:) then reveals the existing window instead of making a second one.
        Window("Graft", id: "main") {
            ContentView()
                .environment(store)
                // Installed once at the window root; it walks the window's view tree
                // to clear AppKit's focus ring from every text field and the toolbar
                // search field.
                .background(GraftTextFieldFocusRingConfigurator())
        }
        .defaultSize(width: 900, height: 650)
        .windowToolbarStyle(.unified)
        .commands {
            CommandGroup(replacing: .sidebar) {}
        }

        MenuBarExtra("Graft", systemImage: "leaf.fill") {
            MenuBarView().environment(store)
        }.menuBarExtraStyle(.window)
    }
}
