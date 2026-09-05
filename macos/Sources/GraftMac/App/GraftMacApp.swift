import AppKit
import SwiftUI

final class GraftAppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate()
    }
}

@main
struct GraftMacApp: App {
    @NSApplicationDelegateAdaptor(GraftAppDelegate.self) private var appDelegate
    @State private var store = GraftStore()

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
        }
    }
}
