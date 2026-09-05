import AppKit
import SwiftUI

struct MenuBarView: View {
    @Environment(GraftStore.self) private var store
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button("Open Graft") {
            openWindow(id: "main")
            NSApp.activate()
        }
        .keyboardShortcut("o")

        Divider()

        // Grouped the same way the Web Extension pane groups them, so the menu and
        // the window stay recognisably the same list.
        ForEach(BrowserTweakCatalog.categories, id: \.self) { category in
            Section(category) {
                ForEach(BrowserTweakCatalog.tweaks.filter { $0.category == category }) { tweak in
                    Toggle(tweak.name, isOn: Binding(
                        get: { store.bool(for: tweak.primaryKey) },
                        set: { store.setBrowserValue(.bool($0), for: tweak.primaryKey) }
                    ))
                }
            }
        }

        Divider()

        Section("Mac") {
            Toggle("Keep Mac Awake", isOn: Binding(
                get: { store.state.macSettings.keepAwake },
                set: { value in
                    var settings = store.state.macSettings
                    settings.keepAwake = value
                    store.setMacSettings(settings)
                }
            ))
        }

        Divider()

        Button("Quit Graft") { NSApplication.shared.terminate(nil) }
            .keyboardShortcut("q")
    }
}
