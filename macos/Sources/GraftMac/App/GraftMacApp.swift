import AppKit
import Combine
import SwiftUI
import GraftAudio
import Sparkle

final class GraftAppDelegate: NSObject, NSApplicationDelegate {
    let updater: SPUStandardUpdaterController? = Bundle.main.object(forInfoDictionaryKey: "SUFeedURL") != nil
        ? SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: nil, userDriverDelegate: nil)
        : nil
    var audio: GraftAudioService?
    var keepAwake: KeepAwakeService?
    var closedLid: ClosedLidSessionService?
    var stayAwakeCommands: StayAwakeCommandServer?
    var dockAIUsage: DockAIUsageService?
    private var terminationSource: DispatchSourceSignal?
    func applicationWillTerminate(_ notification: Notification) {
        stayAwakeCommands?.stop()
        dockAIUsage?.stop()
        closedLid?.stop()
        keepAwake?.shutdown()
        audio?.shutdown()
    }
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
        updater?.startUpdater()
        NSApp.setActivationPolicy(.regular)
        NSApp.activate()
    }
}

@main
struct GraftMacApp: App {
    @NSApplicationDelegateAdaptor(GraftAppDelegate.self) private var appDelegate
    @State private var store: GraftStore

    init() {
        StayAwakeCommand.runIfRequested()
        let store = GraftStore()
        _store = State(initialValue: store)
        _appDelegate.wrappedValue.audio = store.audio
        _appDelegate.wrappedValue.keepAwake = store.keepAwake
        _appDelegate.wrappedValue.closedLid = store.closedLid
        _appDelegate.wrappedValue.dockAIUsage = store.dockAIUsage
        _appDelegate.wrappedValue.stayAwakeCommands = StayAwakeCommandServer(handler: { [weak store] command in
            store?.handleStayAwakeCommand(command) ?? .init(success: false, message: "Graft is closing.")
        })
    }

    var body: some Scene {
        // A single settings-style window, so `Window` rather than `WindowGroup`:
        // openWindow(id:) then reveals the existing window instead of making a second one.
        Window("Graft", id: "main") {
            ContentView()
                .environment(store)
                .modifier(BlissStudioNotice())
                // Installed once at the window root; it walks the window's view tree
                // to clear AppKit's focus ring from every text field and the toolbar
                // search field.
                .background(GraftTextFieldFocusRingConfigurator())
        }
        .defaultSize(width: 900, height: 650)
        .windowToolbarStyle(.unified)
        .commands {
            CommandGroup(after: .appInfo) {
                if let updater = appDelegate.updater {
                    GraftUpdateMenu(updater: updater)
                }
            }
            CommandGroup(replacing: .sidebar) {}
            CommandGroup(after: .help) {
                Link("Download Bliss Studio", destination: BlissStudioNotice.repository)
            }
        }

        MenuBarExtra("Graft", systemImage: "leaf.fill") {
            MenuBarView().environment(store)
        }.menuBarExtraStyle(.window)
    }
}

private struct GraftUpdateMenu: View {
    let updater: SPUStandardUpdaterController
    @State private var canCheck = false
    @State private var automaticallyInstall = false

    var body: some View {
        Button("Check for Updates…") { updater.checkForUpdates(nil) }
            .disabled(!canCheck)
            .onReceive(updater.updater.publisher(for: \.canCheckForUpdates)) { canCheck = $0 }
        Toggle("Install Updates Automatically", isOn: Binding(
            get: { automaticallyInstall },
            set: { updater.updater.automaticallyDownloadsUpdates = $0 }
        ))
        .onReceive(updater.updater.publisher(for: \.automaticallyDownloadsUpdates)) {
            automaticallyInstall = $0
        }
    }
}
