import AppKit
import GraftAudio
import SwiftUI
import UniformTypeIdentifiers

struct AudioEQView: View {
    let engine: AudioEngine
    let app: DisplayableApp
    @State private var presetName = ""
    @State private var renamedPreset: UserEQPreset?
    @State private var renameText = ""
    var body: some View {
        GraftSettingsPage {
            GraftSettingsGroup {
                GraftToggleRow(title: "Equalizer", detail: app.displayName, symbol: "slider.vertical.3", isOn: Binding(get: { engine.eq(app).isEnabled }, set: { value in var eq = engine.eq(app); eq.isEnabled = value; engine.setEQ(app, eq) }))
                GraftRow {
                    Menu("Apply Preset") {
                        ForEach(EQPreset.Category.allCases) { category in
                            Section(category.rawValue) {
                                ForEach(EQPreset.presets(for: category)) { preset in Button(preset.name) { engine.setEQ(app, preset.settings) } }
                            }
                        }
                    }
                    Spacer()
                    Button("Reset to Flat") { engine.setEQ(app, .flat) }
                }
                ForEach(0..<EQSettings.bandCount, id: \.self) { band in
                    GraftRow {
                        Text(frequency(EQSettings.frequencies[band])).frame(width: 65, alignment: .leading)
                        Slider(value: Binding(get: { Double(engine.eq(app).clampedGains[band]) }, set: { value in
                            var eq = engine.eq(app); eq.bandGains[band] = Float(value); engine.setEQ(app, eq)
                        }), in: -12...12, step: 0.5).accessibilityLabel("\(frequency(EQSettings.frequencies[band])) gain")
                        Text(String(format: "%+.1f dB", engine.eq(app).clampedGains[band])).monospacedDigit().frame(width: 65)
                    }.disabled(!engine.eq(app).isEnabled)
                }
            }
            GraftSettingsGroup("Custom Presets") {
                GraftRow {
                    TextField("Preset name", text: $presetName)
                    Button("Save Current EQ") {
                        engine.settingsManager.createUserPreset(name: presetName, settings: engine.eq(app)); presetName = ""
                    }.disabled(presetName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                ForEach(engine.settingsManager.getUserPresets()) { preset in
                    GraftRow {
                        Text(preset.name); Spacer()
                        Button("Apply") { engine.setEQ(app, preset.settings) }
                        Button("Rename") { renamedPreset = preset; renameText = preset.name }
                        Button("Delete", role: .destructive) { engine.settingsManager.deleteUserPreset(id: preset.id) }
                    }
                }
            }
        }.navigationTitle("\(app.displayName) Equalizer")
            .alert("Rename Preset", isPresented: Binding(get: { renamedPreset != nil }, set: { if !$0 { renamedPreset = nil } })) {
                TextField("Name", text: $renameText)
                Button("Cancel", role: .cancel) { renamedPreset = nil }
                Button("Save") { if let preset = renamedPreset { engine.settingsManager.updateUserPreset(id: preset.id, name: renameText) }; renamedPreset = nil }
            }
    }
    private func frequency(_ hz: Double) -> String { hz >= 1000 ? String(format: "%.0f kHz", hz / 1000) : "\(Int(hz)) Hz" }
}

struct AudioCorrectionView: View {
    let engine: AudioEngine
    let device: AudioDevice
    @State private var search = ""
    @State private var favoritesOnly = false
    @State private var fetching: String?
    @State private var error: String?
    private var manager: AutoEQProfileManager { engine.autoEQProfileManager }

    var body: some View {
        GraftSettingsPage {
            GraftSettingsGroup {
                GraftToggleRow(title: "Headphone correction", detail: engine.getAutoEQProfile(for: device.uid)?.name ?? "Choose a headphone profile below.", symbol: "headphones", isOn: Binding(get: { engine.getAutoEQSelection(for: device.uid)?.isEnabled ?? false }, set: { engine.setAutoEQEnabled(for: device.uid, enabled: $0) }))
                GraftRow {
                    Button("Import ParametricEQ.txt…") { importProfile() }
                    Spacer()
                    Button("Refresh Catalog") { Task { await manager.refreshCatalog() } }
                }
                GraftToggleRow(title: "Favorites only", isOn: $favoritesOnly)
                if let error { GraftRow { Text(error).foregroundStyle(.red) } }
                if case .loading = manager.catalogState { GraftRow { ProgressView().controlSize(.small); Text("Loading headphone profiles…") } }
                if case .error(let message) = manager.catalogState { GraftRow { Text(message).foregroundStyle(.secondary) } }
            }
            GraftSettingsGroup("Headphone Profiles") {
                let entries = manager.search(query: search, limit: favoritesOnly ? 10000 : 100).entries.filter { !favoritesOnly || engine.settingsManager.isAutoEQFavorite(id: $0.id) }
                if entries.isEmpty { GraftRow { Text("No matching profiles. Cached and imported profiles remain available offline.").foregroundStyle(.secondary) } }
                ForEach(entries, id: \.id) { entry in
                    GraftRow {
                        VStack(alignment: .leading) { Text(entry.name); Text(entry.measuredBy).font(.caption).foregroundStyle(.secondary) }
                        Spacer()
                        Button {
                            if engine.settingsManager.isAutoEQFavorite(id: entry.id) { engine.settingsManager.unfavoriteAutoEQProfile(id: entry.id) }
                            else { engine.settingsManager.favoriteAutoEQProfile(id: entry.id) }
                        } label: { Image(systemName: engine.settingsManager.isAutoEQFavorite(id: entry.id) ? "star.fill" : "star") }.accessibilityLabel("Favorite \(entry.name)")
                        Button(fetching == entry.id ? "Loading…" : "Apply") {
                            fetching = entry.id; error = nil
                            Task {
                                if await manager.resolveProfile(for: entry) != nil {
                                    engine.setAutoEQProfile(for: device.uid, profileID: entry.id)
                                    engine.setAutoEQEnabled(for: device.uid, enabled: true)
                                } else { error = "Could not load this profile. Check your connection and try again." }
                                fetching = nil
                            }
                        }.disabled(fetching != nil)
                    }
                }
            }
        }.navigationTitle("\(device.name) Correction").searchable(text: $search, prompt: "Search headphones")
    }

    private func importProfile() {
        let panel = NSOpenPanel(); panel.allowedContentTypes = [.plainText]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        guard let profile = manager.importProfile(from: url, name: url.deletingPathExtension().lastPathComponent) else { error = "This file could not be read as a ParametricEQ profile."; return }
        engine.setAutoEQProfile(for: device.uid, profileID: profile.id)
        engine.setAutoEQEnabled(for: device.uid, enabled: true)
    }
}
