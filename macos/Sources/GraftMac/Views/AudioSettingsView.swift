import AppKit
import GraftAudio
import SwiftUI
import UniformTypeIdentifiers

struct AudioSettingsView: View {
    let audio: GraftAudioService
    @State private var reset = false
    @State private var pendingImport: URL?
    private func preference(_ key: WritableKeyPath<AppSettings, Bool>) -> Binding<Bool> {
        Binding(get: { audio.settings.appSettings[keyPath: key] }, set: { value in audio.updateSettings { $0[keyPath: key] = value } })
    }

    var body: some View {
        GraftSettingsGroup("Audio Settings") {
            GraftRow {
                GraftRowLabel(title: "New app volume", symbol: "speaker.wave.2")
                Slider(value: Binding(get: { Double(audio.settings.appSettings.defaultNewAppVolume) }, set: { value in audio.updateSettings { $0.defaultNewAppVolume = Float(value) } }), in: 0...1).frame(width: 150).accessibilityLabel("New app volume")
                Text("\(Int(audio.settings.appSettings.defaultNewAppVolume * 100))%").monospacedDigit()
            }
            GraftToggleRow(title: "Loudness compensation", detail: "Restore bass and treble at low listening volumes.", symbol: "waveform", isOn: preference(\.loudnessCompensationEnabled))
            GraftToggleRow(title: "Loudness equalization", detail: "Smooth differences in perceived loudness in real time.", symbol: "waveform.path", isOn: preference(\.loudnessEqualizationEnabled))
            GraftToggleRow(title: "Software output volume", detail: "Enable volume control for outputs without hardware or DDC controls.", symbol: "speaker.badge.exclamationmark", isOn: preference(\.softwareDeviceVolumeEnabled))
            GraftToggleRow(title: "Lock input device", detail: "Keep the selected microphone when other devices connect.", symbol: "mic.badge.plus", isOn: preference(\.lockInputDevice))
            GraftToggleRow(title: "Device disconnect alerts", detail: "Notify when an audio output disconnects.", symbol: "bell.badge", isOn: preference(\.showDeviceDisconnectAlerts))
            if let engine = audio.engine {
                GraftToggleRow(title: "Correction preamp", detail: "Use each headphone profile’s preamp to preserve headroom.", symbol: "headphones", isOn: Binding(get: { engine.autoEQPreampEnabled }, set: { engine.setAutoEQPreampEnabled($0) }))
                GraftRow {
                    GraftRowLabel(title: "Alert volume", symbol: "bell")
                    Slider(value: Binding(get: { Double(engine.deviceVolumeMonitor.alertVolume) }, set: { engine.deviceVolumeMonitor.setAlertVolume(Float($0)) }), in: 0...1).frame(width: 180).accessibilityLabel("Alert volume")
                }
                GraftPickerRow(
                    title: "Alert output",
                    symbol: "bell.badge",
                    selection: Binding(
                        get: { engine.deviceVolumeMonitor.isSystemFollowingDefault ? "" : (engine.deviceVolumeMonitor.systemDeviceUID ?? "") },
                        set: { uid in
                            if uid.isEmpty { engine.deviceVolumeMonitor.setSystemFollowDefault() }
                            else if let device = engine.outputDevices.first(where: { $0.uid == uid }) {
                                engine.deviceVolumeMonitor.setSystemDeviceExplicit(device.id)
                            }
                        }
                    )
                ) {
                    Text("System Default").tag("")
                    ForEach(engine.outputDevices) { Text($0.name).tag($0.uid) }
                }
                GraftRow {
                    GraftRowLabel(title: "Headphone catalog", detail: "Fetched files can be refreshed without deleting your imported profiles or favorites.", symbol: "internaldrive")
                    Menu("Manage Cache") {
                        Button("Clear Downloaded Profiles") { engine.autoEQProfileManager.clearFetchedProfileCache() }
                        Button("Refresh Catalog") { Task { await engine.autoEQProfileManager.refreshCatalog() } }
                    }
                }
                ForEach(engine.autoEQProfileManager.importedProfiles) { profile in
                    GraftRow {
                        GraftRowLabel(title: profile.name, detail: "Imported headphone profile", symbol: "headphones")
                        Button("Delete", role: .destructive) {
                            for device in engine.outputDevices where engine.getAutoEQProfile(for: device.uid)?.id == profile.id { engine.setAutoEQProfile(for: device.uid, profileID: nil) }
                            engine.autoEQProfileManager.deleteImportedProfile(id: profile.id)
                        }
                    }
                }
            }
            GraftRow {
                Menu("Audio Data") {
                    Button("Export Settings…") { exportSettings() }
                    Button("Import Settings…") { chooseImport() }
                    Button("Export Diagnostics…") { exportDiagnostics() }.disabled(audio.engine == nil)
                    Button("Reset Audio Settings…", role: .destructive) { reset = true }
                }
                Spacer()
                Text("Stored locally on this Mac").font(.caption).foregroundStyle(.secondary)
            }
        }
        .alert("Reset audio settings?", isPresented: $reset) {
            Button("Cancel", role: .cancel) {}
            Button("Reset", role: .destructive) {
                do {
                    try audio.settings.replaceAudioSettings(SettingsManager.Settings())
                    let enabled = audio.isEnabled; audio.setEnabled(false); if enabled { audio.setEnabled(true) }
                } catch { audio.message = error.localizedDescription }
            }
        } message: { Text("Reset volumes, routing, EQ, and audio profiles. A backup is saved first. Other Graft settings are unaffected.") }
        .alert("Replace audio settings?", isPresented: Binding(get: { pendingImport != nil }, set: { if !$0 { pendingImport = nil } })) {
            Button("Cancel", role: .cancel) { pendingImport = nil }
            Button("Import") {
                if let url = pendingImport { do { try audio.importAudio(from: url) } catch { audio.message = error.localizedDescription } }
                pendingImport = nil
            }
        } message: { Text("Graft will validate this file and back up your current audio settings before replacing them.") }
    }

    private func exportSettings() {
        let panel = NSSavePanel(); panel.nameFieldStringValue = "Graft Audio Settings.json"; panel.allowedContentTypes = [.json]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do { try audio.settings.exportSettings(to: url); audio.message = "Audio settings exported." } catch { audio.message = error.localizedDescription }
    }
    private func chooseImport() {
        let panel = NSOpenPanel(); panel.allowsOtherFileTypes = true
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do { _ = try SettingsManager.readImport(at: url); pendingImport = url } catch { audio.message = error.localizedDescription }
    }
    private func exportDiagnostics() {
        let panel = NSSavePanel(); panel.nameFieldStringValue = "Graft Audio Diagnostics.json"; panel.allowedContentTypes = [.json]
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do { try audio.engine?.exportDiagnostics(to: url); audio.message = "Audio diagnostics exported." } catch { audio.message = error.localizedDescription }
    }
}

struct AudioProfilesView: View {
    let engine: AudioEngine
    @State private var name = ""
    @State private var renamed: AudioProfile?
    @State private var renameText = ""
    var body: some View {
        GraftSettingsGroup("Profiles") {
            GraftRow {
                TextField("Profile name", text: $name)
                Button("Save Current Setup") { _ = engine.saveCurrentAudioProfile(named: name); name = "" }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            ForEach(engine.audioProfiles) { profile in
                GraftRow {
                    GraftRowLabel(title: profile.name, detail: "\(profile.appRules.count) app rules", symbol: "slider.horizontal.3")
                    Button("Apply") { engine.applyAudioProfile(profile) }
                    Menu {
                        Button("Rename") { renamed = profile; renameText = profile.name }
                        Button("Duplicate") { engine.duplicateAudioProfile(id: profile.id) }
                        Button("Delete", role: .destructive) { engine.deleteAudioProfile(id: profile.id) }
                    } label: { Image(systemName: "ellipsis") }.accessibilityLabel("\(profile.name) options")
                }
            }
        }
        .alert("Rename Profile", isPresented: Binding(get: { renamed != nil }, set: { if !$0 { renamed = nil } })) {
            TextField("Name", text: $renameText)
            Button("Cancel", role: .cancel) { renamed = nil }
            Button("Save") { if let profile = renamed { engine.renameAudioProfile(id: profile.id, name: renameText) }; renamed = nil }
        }
    }
}
