import AppKit
import GraftAudio
import SwiftUI
import UniformTypeIdentifiers

struct AudioView: View {
    @Environment(GraftStore.self) private var store
    @State private var search = ""
    @State private var importPreview: String?
    @State private var showingImport = false
    private var audio: GraftAudioService { store.audio }

    var body: some View {
        GraftSettingsPage {
            GraftSettingsGroup(footer: "Graft needs system audio access when you enable audio management. Audio is processed on this Mac and is not saved or uploaded.") {
                GraftToggleRow(title: "Manage audio", detail: "Control app volume, output routing, and sound processing on this Mac.", symbol: "waveform", isOn: Binding(get: { audio.isEnabled }, set: { audio.setEnabled($0) }))
                GraftRow {
                    GraftRowLabel(title: audio.status, symbol: audio.conflict ? "pause.circle" : "speaker.wave.2")
                    if audio.isEnabled && !audio.conflict && audio.engine?.permission.status != .authorized {
                        Button("Permissions") { audio.openPermissionSettings() }
                        Button("Retry") { audio.retryCapture() }
                    }
                }
                if audio.hasFineTuneImport {
                    GraftRow {
                        GraftRowLabel(title: "Bring your FineTune setup", detail: "Preview your settings before copying them into Graft.", symbol: "square.and.arrow.down")
                        Button("Review Import…") {
                            do { importPreview = try audio.previewFineTuneImport(); showingImport = true }
                            catch { audio.message = error.localizedDescription }
                        }
                    }
                }
                if let message = audio.message {
                    GraftRow { Text(message).font(.callout); Spacer(); Button("Dismiss") { audio.message = nil } }
                }
            }
            if let engine = audio.engine {
                applications(engine)
                GraftSettingsGroup("Outputs") {
                    if engine.outputDevices.isEmpty { GraftRow { Text("No output devices connected.").foregroundStyle(.secondary) } }
                    ForEach(engine.prioritySortedOutputDevices) { device in AudioDeviceControls(engine: engine, device: device) }
                    AudioBluetoothControls(engine: engine)
                }
                GraftSettingsGroup("Inputs") {
                    if engine.inputDevices.isEmpty { GraftRow { Text("No input devices connected.").foregroundStyle(.secondary) } }
                    ForEach(engine.prioritySortedInputDevices) { device in AudioDeviceControls(engine: engine, device: device, input: true) }
                }
                AudioProfilesView(engine: engine)
            }
            AudioSettingsView(audio: audio)
        }
        .searchable(text: $search, prompt: "Search applications")
        .alert("Import FineTune audio settings?", isPresented: $showingImport) {
            Button("Cancel", role: .cancel) {}
            Button("Import") { do { try audio.importFineTune() } catch { audio.message = error.localizedDescription } }
        } message: { Text(importPreview ?? "") }
    }

    private func applications(_ engine: AudioEngine) -> some View {
        GraftSettingsGroup("Applications", footer: "Browser Sound Booster and native boost multiply when both are enabled.") {
            let apps = engine.displayableApps.filter { search.isEmpty || $0.displayName.localizedCaseInsensitiveContains(search) }
            if apps.isEmpty { GraftRow { Text(search.isEmpty ? "Play audio in an app, or pin an application to configure it in advance." : "No matching applications.").foregroundStyle(.secondary) } }
            ForEach(apps) { app in AudioAppControls(engine: engine, app: app) }
            GraftRow {
                Button("Pin Application…") {
                    let panel = NSOpenPanel()
                    panel.allowedContentTypes = [.applicationBundle]
                    panel.directoryURL = URL(fileURLWithPath: "/Applications")
                    guard panel.runModal() == .OK, let url = panel.url, let bundle = Bundle(url: url), let id = bundle.bundleIdentifier else { return }
                    engine.pinApp(identifier: id, displayName: url.deletingPathExtension().lastPathComponent, bundleID: id)
                }
                Spacer()
                Menu("Ignored Apps") {
                    ForEach(engine.settingsManager.getIgnoredAppInfo(), id: \.persistenceIdentifier) { info in
                        Button("Restore \(info.displayName)") { engine.unignoreApp(info.persistenceIdentifier) }
                    }
                }.disabled(engine.settingsManager.getIgnoredAppInfo().isEmpty)
            }
        }
    }
}

struct AudioAppControls: View {
    let engine: AudioEngine
    let app: DisplayableApp
    var compact = false
    @State private var expanded = false

    var body: some View {
        VStack(spacing: 0) {
            GraftRow {
                if !compact {
                    Button { expanded.toggle() } label: { GraftDisclosureChevron(isExpanded: expanded) }
                        .buttonStyle(.plain).accessibilityLabel("\(app.displayName) audio options")
                }
                Image(nsImage: app.icon).resizable().frame(width: 24, height: 24).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(app.displayName).lineLimit(1)
                    if app.isPinnedInactive { Text("Not playing").font(.caption).foregroundStyle(.secondary) }
                    if case .active(let active) = app {
                        TimelineView(.periodic(from: .now, by: 0.1)) { _ in
                            ProgressView(value: Double(min(1, max(0, engine.getAudioLevel(for: active)))))
                                .progressViewStyle(.linear).frame(maxWidth: 100).accessibilityLabel("\(app.displayName) audio level")
                        }
                    }
                }.frame(minWidth: 70, maxWidth: .infinity, alignment: .leading)
                Slider(value: Binding(get: { Double(engine.volume(app)) }, set: { engine.setVolume(app, Float($0)) }), in: 0...1)
                    .frame(width: compact ? 95 : 135).accessibilityLabel("\(app.displayName) volume")
                Text("\(Int(engine.volume(app) * 100))%").monospacedDigit().font(.caption).frame(width: 36)
                Button { engine.setMuted(app, !engine.muted(app)) } label: {
                    Image(systemName: engine.muted(app) ? "speaker.slash.fill" : "speaker.wave.2.fill")
                }.accessibilityLabel("\(engine.muted(app) ? "Unmute" : "Mute") \(app.displayName)")
            }
            if expanded && !compact {
                GraftSettingsSubGroup("App options") {
                    GraftRow {
                        Text("Boost"); Spacer()
                        Picker("Boost", selection: Binding(get: { engine.boost(app) }, set: { engine.setBoost(app, $0) })) {
                            ForEach(BoostLevel.allCases, id: \.self) { Text($0.label).tag($0) }
                        }
                        .graftTrailingPicker()
                    }
                    GraftToggleRow(title: "Multiple outputs", isOn: Binding(get: { engine.multi(app) }, set: { engine.setMulti(app, $0) }))
                    if engine.multi(app) {
                        ForEach(engine.outputDevices) { device in
                            GraftToggleRow(title: device.name, isOn: Binding(get: { engine.selectedDevices(app).contains(device.uid) }, set: { selected in
                                var uids = engine.selectedDevices(app)
                                if selected { uids.insert(device.uid) } else { uids.remove(device.uid) }
                                engine.setSelectedDevices(app, uids)
                            }))
                        }
                        let missing = engine.selectedDevices(app).subtracting(Set(engine.outputDevices.map(\.uid)))
                        ForEach(Array(missing).sorted(), id: \.self) { uid in GraftRow { Text("Unavailable output: \(uid)").font(.caption).foregroundStyle(.secondary) } }
                    } else {
                        GraftRow {
                            Text("Output"); Spacer()
                            Picker("Output", selection: Binding(get: { engine.route(app) }, set: { engine.setRoute(app, $0) })) {
                                Text("System Default").tag("")
                                ForEach(engine.outputDevices) { Text($0.name).tag($0.uid) }
                                if !engine.route(app).isEmpty && !engine.outputDevices.contains(where: { $0.uid == engine.route(app) }) {
                                    Text("Unavailable · using fallback").tag(engine.route(app))
                                }
                            }
                            .graftTrailingPicker()
                        }
                    }
                    GraftRow {
                        NavigationLink("Equalizer") { AudioEQView(engine: engine, app: app) }
                        Spacer()
                        Button(engine.isPinned(identifier: app.id) ? "Unpin" : "Pin") {
                            if engine.isPinned(identifier: app.id) { engine.unpinApp(app.id) }
                            else { engine.pinApp(identifier: app.id, displayName: app.displayName, bundleID: app.id) }
                        }
                        Button("Ignore") { engine.ignoreApp(identifier: app.id, displayName: app.displayName, bundleID: app.id) }
                    }
                }.padding(.leading, GraftMetrics.labelInset).padding(.trailing, GraftMetrics.rowHorizontalPadding).padding(.bottom, 12)
            }
        }
    }
}
