import SwiftUI

struct ActivityView: View {
    @Environment(GraftStore.self) private var store
    @State private var search = ""
    @State private var category = "All"
    @State private var failuresOnly = false

    private var filtered: [GraftActivityEntry] {
        store.activity.entries.filter {
            (category == "All" || $0.category.rawValue == category)
                && (!failuresOnly || $0.level == .failure || $0.level == .warning)
                && (search.isEmpty || "\($0.title) \($0.detail) \($0.category.rawValue)".localizedCaseInsensitiveContains(search))
        }
    }

    var body: some View {
        GraftSettingsPage(intro: "Recent installs, checks, and repairs. History stays on this Mac; the latest 200 events are kept.") {
            GraftSettingsGroup("Troubleshooting") {
                GraftRow {
                    GraftRowLabel(title: "Browser settings", detail: store.isExtensionConnected ? "Extension connected · \(store.state.pendingBrowserChanges.count) changes awaiting acknowledgement" : "Extension offline · queued changes are kept", symbol: "arrow.triangle.2.circlepath", tint: .blue)
                    Button("Retry Sync") { store.retrySettingsSync() }.controlSize(.small)
                        .accessibilityLabel("Retry Browser Settings Sync")
                }
                GraftRow {
                    GraftRowLabel(title: "Roblox Player Watcher", detail: store.bool(for: "robloxPlayerWatcherEnabled") ? "Check watched players now" : "Enable Player Watcher in Web Extension first", symbol: "person.2.wave.2.fill", tint: .green)
                    Button("Check Now") { Task { await store.robloxWatcher.checkNow() } }
                        .controlSize(.small).disabled(!store.bool(for: "robloxPlayerWatcherEnabled"))
                        .accessibilityLabel("Check Roblox Now")
                }
                GraftRow {
                    GraftRowLabel(title: "Spotify Friend Watcher", detail: store.spotifyIntegrationStatus.title, symbol: "music.note.list", tint: .green)
                    Button("Check Now") { store.checkSpotifyNow() }.controlSize(.small)
                        .accessibilityLabel("Check Spotify Now")
                    Button("Repair") { Task { await store.installOrRepairSpotifyBridge() } }
                        .controlSize(.small).disabled(store.spotifyIntegration.isBusy)
                }
                if let error = store.activity.persistenceError {
                    GraftRow {
                        Text(error).font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Button("Retry Saving") { store.activity.retrySaving() }
                    }
                }
            }

            GraftSettingsGroup("History") {
                GraftRow { GraftHistorySearchField(text: $search, prompt: "Search activity") }
                GraftPickerRow(title: "Category", selection: $category) {
                    Text("All").tag("All")
                    ForEach(ActivityCategory.allCases, id: \.self) { Text($0.rawValue).tag($0.rawValue) }
                }
                GraftToggleRow(title: "Only problems", isOn: $failuresOnly)
                if filtered.isEmpty {
                    GraftRow { Text(store.activity.entries.isEmpty ? "No activity yet. Checks and installs will appear here." : "No matching activity.").font(.callout).foregroundStyle(.secondary) }
                }
                ForEach(filtered) { entry in
                    GraftRow {
                        GraftIconChip(symbol: symbol(for: entry.level), tint: tint(for: entry.level))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(entry.title).font(.callout.weight(.medium))
                            Text(entry.detail).font(.caption).foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true).textSelection(.enabled)
                            Text("\(entry.category.rawValue) · \(entry.date.formatted(date: .abbreviated, time: .shortened))\(entry.occurrences > 1 ? " · \(entry.occurrences) checks" : "")")
                                .font(.caption2).foregroundStyle(.tertiary)
                        }
                        Spacer(minLength: 6)
                        if let retry = entry.retry {
                            Button(retry.title) { Task { await store.retryActivity(entry) } }
                                .controlSize(.small).disabled(!store.activity.retryingIDs.isEmpty || store.spotifyIntegration.isBusy || store.dmgInstaller.isInstalling)
                                .accessibilityLabel("\(retry.title): \(entry.title)")
                                .accessibilityIdentifier("activity-retry-\(entry.id.uuidString)")
                        }
                    }
                }
            }
        }
    }

    private func symbol(for level: ActivityLevel) -> String {
        switch level {
        case .info: "info.circle"
        case .success: "checkmark.circle.fill"
        case .warning: "exclamationmark.triangle.fill"
        case .failure: "xmark.circle.fill"
        }
    }

    private func tint(for level: ActivityLevel) -> Color {
        switch level {
        case .info: .blue
        case .success: .green
        case .warning: .orange
        case .failure: .red
        }
    }
}
