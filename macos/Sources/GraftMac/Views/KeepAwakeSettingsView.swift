import AppKit
import GraftCore
import SwiftUI

struct KeepAwakeSettingsRow: View {
    @Environment(GraftStore.self) private var store
    @State private var expanded = false
    @State private var runningApps: [NSRunningApplication] = []

    var body: some View {
        VStack(spacing: 0) {
            GraftRow {
                GraftRowLabel(title: "Keep Mac awake", detail: store.keepAwake.detail, symbol: "cup.and.saucer.fill", tint: .green)
                Circle().fill(store.keepAwake.isActive ? Color.green : Color.secondary.opacity(0.4))
                    .frame(width: 6, height: 6)
                    .accessibilityLabel(store.keepAwake.isActive ? "On" : "Off")
                Button { withAnimation(.snappy(duration: 0.2)) { expanded.toggle() }; refreshApps() } label: {
                    GraftDisclosureChevron(isExpanded: expanded)
                }.buttonStyle(.plain).accessibilityLabel("Keep Awake options")
                Toggle("Keep Mac awake", isOn: store.macToggle(\.keepAwake))
                    .labelsHidden().toggleStyle(.switch).controlSize(.small)
            }
            if expanded {
                GraftSettingsSubGroup("Session", footer: "Prevents idle display and system sleep. Every session stops when Graft exits. Timed sessions keep their original end time across a restart.") {
                    GraftPickerRow(title: "Keep awake for", selection: Binding(get: { store.state.macSettings.keepAwakeMode }, set: { mode in
                        var settings = store.state.macSettings
                        settings.keepAwakeMode = mode
                        store.setMacSettings(settings)
                        refreshApps()
                    })) {
                        ForEach(KeepAwakeMode.allCases, id: \.self) { Text($0.title).tag($0) }
                    }
                    if store.state.macSettings.keepAwakeMode == .untilAppQuits {
                        GraftPickerRow(title: "Application", selection: Binding(get: { store.state.macSettings.keepAwakeAppBundleID }, set: { id in
                            var settings = store.state.macSettings
                            settings.keepAwakeAppBundleID = id
                            store.setMacSettings(settings)
                        })) {
                            Text("Choose a running app").tag("")
                            ForEach(runningApps, id: \.processIdentifier) { app in
                                Text(app.localizedName ?? app.bundleIdentifier ?? "Application").tag(app.bundleIdentifier ?? "")
                            }
                            let selected = store.state.macSettings.keepAwakeAppBundleID
                            if !selected.isEmpty && !runningApps.contains(where: { $0.bundleIdentifier == selected }) {
                                Text("\(selected) (not running)").tag(selected)
                            }
                        }
                        GraftRow { Button("Refresh Applications") { refreshApps() }; Spacer() }
                    }
                    if store.keepAwake.isActive, let deadline = store.state.macSettings.keepAwakeDeadline {
                        GraftRow { Text("Time remaining"); Spacer(); Text(deadline, style: .timer).monospacedDigit().foregroundStyle(.secondary) }
                    }
                }
                .padding(.leading, GraftMetrics.labelInset)
                .padding(.trailing, GraftMetrics.rowHorizontalPadding)
                .padding(.bottom, GraftMetrics.rowVerticalPadding)
            }
        }
    }

    private func refreshApps() {
        var seen = Set<String>()
        runningApps = NSWorkspace.shared.runningApplications.filter {
            guard $0.activationPolicy == .regular, $0.processIdentifier != getpid(), let id = $0.bundleIdentifier else { return false }
            return seen.insert(id).inserted
        }.sorted { ($0.localizedName ?? "") < ($1.localizedName ?? "") }
    }
}
