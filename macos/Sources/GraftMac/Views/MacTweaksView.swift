import GraftCore
import SwiftUI

struct MacTweaksView: View {
    @Environment(GraftStore.self) private var store
    @State private var pendingFinderChange: FinderChange?

    private enum FinderChange: String, Identifiable {
        case hiddenFiles = "Finder hidden files"
        case desktopIcons = "desktop icons"
        var id: String { rawValue }
    }

    var body: some View {
        GraftSettingsPage(intro: "Small, reversible controls for how your Mac behaves.") {
            GraftSettingsGroup("System") {
                GraftToggleRow(
                    title: "Keep Mac awake",
                    detail: "Prevent display and idle sleep while Graft is running",
                    symbol: "cup.and.saucer.fill",
                    tint: .green,
                    isOn: store.macToggle(\.keepAwake)
                )
                GraftToggleRow(
                    title: "Keep Graft above other windows",
                    detail: "Float this app while you tune another app or site",
                    symbol: "macwindow.on.rectangle",
                    tint: .blue,
                    isOn: store.macToggle(\.floatGraftWindow)
                )
            }

            GraftSettingsGroup(
                "Finder",
                footer: "Finder restarts to apply these reversible changes. No files are moved or deleted."
            ) {
                GraftToggleRow(
                    title: "Show hidden files",
                    detail: "Reveal dotfiles and hidden items in Finder",
                    symbol: "eye.fill",
                    tint: .purple,
                    isOn: confirmationBinding(\.showHiddenFinderFiles, change: .hiddenFiles)
                )
                GraftToggleRow(
                    title: "Hide desktop icons",
                    detail: "Keep desktop files in Finder but hide them from the desktop",
                    symbol: "desktopcomputer",
                    tint: .indigo,
                    isOn: confirmationBinding(\.hideDesktopIcons, change: .desktopIcons)
                )
            }

            if store.spotifyIntegration.isSpotifyInstalled {
                GraftSettingsGroup(
                    "Applications",
                    footer: "Friend activity stays on this Mac. Graft does not upload or sync listening history."
                ) {
                    SpotifyWatcherSettingsRow()
                }
            }
        }
        .confirmationDialog(
            "Apply \(pendingFinderChange?.rawValue ?? "change")?",
            isPresented: Binding(
                get: { pendingFinderChange != nil },
                set: { if !$0 { pendingFinderChange = nil } }
            ),
            presenting: pendingFinderChange
        ) { change in
            Button("Apply and Restart Finder") { apply(change) }
            Button("Cancel", role: .cancel) {}
        } message: { _ in
            Text("Finder will briefly close and reopen. This does not delete or move any files.")
        }
    }

    private func confirmationBinding(
        _ path: WritableKeyPath<MacSettings, Bool>,
        change: FinderChange
    ) -> Binding<Bool> {
        Binding(
            get: { store.state.macSettings[keyPath: path] },
            set: { _ in pendingFinderChange = change }
        )
    }

    private func apply(_ change: FinderChange) {
        var settings = store.state.macSettings
        switch change {
        case .hiddenFiles: settings.showHiddenFinderFiles.toggle()
        case .desktopIcons: settings.hideDesktopIcons.toggle()
        }
        store.setMacSettings(settings)
        pendingFinderChange = nil
    }
}
