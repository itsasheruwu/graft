import AppKit
import GraftAudio
import SwiftUI

struct MenuBarView: View {
    @Environment(GraftStore.self) private var store
    @Environment(\.openWindow) private var openWindow
    @State private var tweaksExpanded = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    GraftAppIcon(size: 24)
                    Text("Graft").font(.headline)
                    Spacer()
                    Button("Open Graft") { reveal() }
                }.padding(.horizontal, 14)
                GraftSettingsGroup("Audio") {
                    if let engine = store.audio.engine {
                        GraftRow {
                            Text("Output"); Spacer()
                            Picker("Output", selection: Binding(get: { engine.deviceVolumeMonitor.defaultDeviceUID ?? "" }, set: { uid in
                                if let device = engine.outputDevices.first(where: { $0.uid == uid }) { _ = engine.setDefaultOutputDevice(device.id) }
                            })) {
                                ForEach(engine.outputDevices) { Text($0.name).tag($0.uid) }
                            }
                            .graftTrailingPicker()
                        }
                        ForEach(Array(engine.displayableApps.prefix(6))) { app in AudioAppControls(engine: engine, app: app, compact: true) }
                        if engine.displayableApps.isEmpty { GraftRow { Text(store.audio.status).font(.caption).foregroundStyle(.secondary) } }
                    } else {
                        GraftRow { Text(store.audio.status).font(.callout).foregroundStyle(.secondary) }
                    }
                    GraftRow {
                        Button("Open Audio Settings") { store.requestedDestination = .audio; reveal() }
                        Spacer()
                        if store.audio.isEnabled { Button("Turn Off") { store.audio.setEnabled(false) } }
                    }
                }
                DisclosureGroup("Web & Mac Tweaks", isExpanded: $tweaksExpanded) {
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(BrowserTweakCatalog.categories, id: \.self) { category in
                            GraftSettingsGroup(category) {
                                ForEach(BrowserTweakCatalog.tweaks.filter { $0.category == category }) { tweak in
                                    GraftToggleRow(title: tweak.name, isOn: Binding(get: { store.bool(for: tweak.primaryKey) }, set: { store.setBrowserValue(.bool($0), for: tweak.primaryKey) }))
                                }
                            }
                        }
                        GraftSettingsGroup("Mac") {
                            GraftToggleRow(title: "Auto-install DMGs", isOn: store.macToggle(\.dmgAutoInstallEnabled))
                            GraftToggleRow(title: "Auto-use Codex resets", isOn: store.macToggle(\.codexAutoUseResetsEnabled))
                            GraftToggleRow(title: "Keep Mac Awake", isOn: Binding(get: { store.state.macSettings.keepAwake }, set: { value in
                                var settings = store.state.macSettings; settings.keepAwake = value; store.setMacSettings(settings)
                            }))
                        }
                    }.padding(.top, 10)
                }.padding(.horizontal, 10)
                HStack {
                    Button("Activity") { store.requestedDestination = .activity; reveal() }
                    Spacer()
                    Button("Quit Graft") { NSApplication.shared.terminate(nil) }.keyboardShortcut("q")
                }.padding(.horizontal, 14)
            }.padding(12)
        }.frame(width: 460).frame(maxHeight: 620)
    }
    private func reveal() { openWindow(id: "main"); NSApp.activate() }
}
