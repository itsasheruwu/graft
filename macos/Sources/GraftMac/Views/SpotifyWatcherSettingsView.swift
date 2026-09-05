import GraftCore
import SwiftUI

struct SpotifyWatcherSettingsRow: View {
    @Environment(GraftStore.self) private var store
    @State private var isExpanded = false
    @State private var notificationsExpanded = false
    @State private var confirmation: BridgeConfirmation?

    private enum BridgeConfirmation: String, Identifiable {
        case install
        case remove
        var id: String { rawValue }
    }

    private var status: SpotifyIntegrationStatus { store.spotifyIntegrationStatus }

    var body: some View {
        VStack(spacing: 0) {
            GraftRow {
                GraftRowLabel(
                    title: "Spotify Friend Watcher",
                    detail: "Notifications and a private log for whitelisted friends",
                    symbol: "music.note.list",
                    tint: Color(red: 0.12, green: 0.72, blue: 0.36)
                )
                SpotifyStatusBadge(status: status)
                GraftDisclosureChevron(isExpanded: isExpanded)
                Toggle("", isOn: store.macToggle(\.spotifyWatcherEnabled))
                    .labelsHidden()
                    .toggleStyle(.switch)
                    .controlSize(.small)
                    .accessibilityLabel("Spotify Friend Watcher")
            }
            .onTapGesture { withAnimation(.snappy(duration: 0.2)) { isExpanded.toggle() } }

            if isExpanded {
                Divider().padding(.leading, GraftMetrics.labelInset)
                VStack(alignment: .leading, spacing: 12) {
                    SpotifyBridgeSetupCard(status: status) { action in
                        confirmation = action == .remove ? .remove : .install
                    }

                    NavigationLink {
                        SpotifyListeningHistoryView()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "clock.arrow.circlepath")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(.green)
                                .frame(width: 24)
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Listening History").font(.callout.weight(.medium))
                                Text("See tracks, times, and current sessions")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(store.spotifyHistory.entries.count.formatted())
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                            Image(systemName: "chevron.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color.primary.opacity(0.045), in: RoundedRectangle(cornerRadius: 10))
                        .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(.primary.opacity(0.08)) }
                    }
                    .buttonStyle(.plain)

                    GraftDisclosureSubGroup(
                        "Notifications",
                        isExpanded: $notificationsExpanded,
                        footer: "Stop alerts are inferred after 15 minutes without newer activity. Graft never sends them while the Spotify bridge is offline."
                    ) {
                        GraftToggleRow(
                            title: "Started listening",
                            isOn: store.macToggle(\.spotifyWatcherNotifyStarted)
                        )
                        GraftToggleRow(
                            title: "Changed tracks",
                            isOn: store.macToggle(\.spotifyWatcherNotifyTrackChanges)
                        )
                        GraftToggleRow(
                            title: "Stopped listening",
                            isOn: store.macToggle(\.spotifyWatcherNotifyStopped)
                        )
                        GraftToggleRow(
                            title: "Time Sensitive alerts",
                            detail: "Allow current listening activity through Focus when macOS permits it",
                            isOn: store.macToggle(\.spotifyWatcherTimeSensitive)
                        )
                        GraftToggleRow(
                            title: "Play notification sounds",
                            isOn: store.macToggle(\.spotifyWatcherNotificationSoundEnabled)
                        )
                    }

                    SpotifyFriendWhitelistView()
                }
                .padding(.leading, GraftMetrics.labelInset)
                .padding(.trailing, GraftMetrics.rowHorizontalPadding)
                .padding(.vertical, 12)
                .disabled(!store.state.macSettings.spotifyWatcherEnabled)
                .opacity(store.state.macSettings.spotifyWatcherEnabled ? 1 : 0.45)
            }
        }
        .animation(.snappy(duration: 0.2), value: isExpanded)
        .confirmationDialog(
            confirmation == .remove ? "Remove Spotify bridge?" : "Set up Spotify Friend Watcher?",
            isPresented: Binding(
                get: { confirmation != nil },
                set: { if !$0 { confirmation = nil } }
            ),
            presenting: confirmation
        ) { choice in
            switch choice {
            case .install:
                Button("Install or Repair Bridge") {
                    Task { await store.installOrRepairSpotifyBridge() }
                }
            case .remove:
                Button("Remove Graft Bridge", role: .destructive) {
                    Task { await store.removeSpotifyBridge() }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: { choice in
            Text(choice == .remove
                ? "Only Graft's bridge file and Spicetify entry will be removed. Other Spotify customizations stay intact."
                : "Graft will add one local Spicetify extension and restart Spotify's customized interface. No Spotify cookie or password is read.")
        }
        .alert(
            "Spotify Friend Watcher",
            isPresented: Binding(
                get: { store.spotifyIntegration.actionMessage != nil },
                set: { if !$0 { store.spotifyIntegration.clearActionMessage() } }
            )
        ) {
            Button("OK") { store.spotifyIntegration.clearActionMessage() }
        } message: {
            Text(store.spotifyIntegration.actionMessage ?? "")
        }
    }
}

private enum SpotifyBridgeAction { case install, remove }

private struct SpotifyBridgeSetupCard: View {
    @Environment(GraftStore.self) private var store
    let status: SpotifyIntegrationStatus
    let action: (SpotifyBridgeAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: statusSymbol).foregroundStyle(statusColor)
                VStack(alignment: .leading, spacing: 1) {
                    Text(status.title).font(.callout.weight(.semibold))
                    Text(statusDetail).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if store.spotifyIntegration.isBusy {
                    ProgressView().controlSize(.small)
                } else if store.spotifyIntegration.bridgeConfigured {
                    Button("Repair") { action(.install) }.controlSize(.small)
                    Button("Remove") { action(.remove) }.controlSize(.small)
                } else {
                    Button("Set Up") { action(.install) }.controlSize(.small)
                }
            }
        }
        .padding(12)
        .background(statusColor.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(statusColor.opacity(0.18)) }
    }

    private var statusDetail: String {
        switch status {
        case .spotifyNotInstalled: "Install Spotify for macOS to use this feature."
        case .spotifyClosed: "Friend activity updates while Spotify and Graft are open."
        case .spicetifyMissing: "Install Spicetify, then return here to finish setup."
        case .setupRequired: "One reversible bridge lets Graft receive Spotify's friend list."
        case .waitingForBridge: "Open or restart Spotify after installing the bridge."
        case .connected: "Receiving friend activity from Spotify on this Mac."
        case .repairRequired(let detail), .unsupported(let detail): detail
        }
    }

    private var statusSymbol: String {
        switch status {
        case .connected: "checkmark.circle.fill"
        case .waitingForBridge, .spotifyClosed: "clock.fill"
        case .setupRequired: "wrench.and.screwdriver.fill"
        default: "exclamationmark.triangle.fill"
        }
    }

    private var statusColor: Color {
        switch status {
        case .connected: .green
        case .waitingForBridge, .spotifyClosed: .orange
        case .setupRequired: .blue
        default: .red
        }
    }
}

private struct SpotifyStatusBadge: View {
    let status: SpotifyIntegrationStatus
    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(status.title).lineLimit(1)
        }
        .font(.caption2.weight(.medium))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(Color.primary.opacity(0.045), in: Capsule())
    }

    private var color: Color {
        status == .connected ? .green : .orange
    }
}

private struct SpotifyFriendWhitelistView: View {
    @Environment(GraftStore.self) private var store

    var body: some View {
        GraftSettingsSubGroup(
            "Watched friends",
            footer: store.spotifyDetectedFriends.isEmpty
                ? "Friends appear here after Spotify sends its Listening activity list."
                : "Only selected friends create notifications and listening-history entries."
        ) {
            if store.spotifyDetectedFriends.isEmpty {
                GraftRow {
                    Image(systemName: "person.2.slash").foregroundStyle(.secondary)
                    Text("No friends detected yet").font(.callout).foregroundStyle(.secondary)
                    Spacer()
                }
            } else {
                ForEach(store.spotifyDetectedFriends) { friend in
                    GraftRow {
                        AsyncImage(url: friend.avatarURL) { image in
                            image.resizable().scaledToFill()
                        } placeholder: {
                            Image(systemName: "person.crop.circle.fill")
                                .resizable()
                                .foregroundStyle(.secondary)
                        }
                        .frame(width: 28, height: 28)
                        .clipShape(Circle())
                        VStack(alignment: .leading, spacing: 1) {
                            Text(friend.displayName).font(.callout.weight(.medium))
                            Text(friend.lastSeenAt, format: .relative(presentation: .named))
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Toggle("", isOn: Binding(
                            get: { store.isSpotifyFriendWhitelisted(friend.id) },
                            set: { store.setSpotifyFriend(friend.id, whitelisted: $0) }
                        ))
                        .labelsHidden().toggleStyle(.switch).controlSize(.small)
                    }
                }
            }
        }
    }
}

struct SpotifyListeningHistoryView: View {
    @Environment(GraftStore.self) private var store
    @State private var filter = SpotifyHistoryFilter.all
    @State private var friendURI = "all"
    @State private var confirmsClear = false
    @State private var searchText = ""

    private var filteredEntries: [SpotifyListeningLogEntry] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return store.spotifyHistory.entries.filter { entry in
            (friendURI == "all" || entry.friendURI == friendURI)
                && (filter == .all || (filter == .listening) == entry.isListening)
                && (query.isEmpty || [entry.trackName, entry.artistName, entry.friendName]
                    .contains { $0.localizedStandardContains(query) })
        }
    }

    private var groupedEntries: [(Date, [SpotifyListeningLogEntry])] {
        Dictionary(grouping: filteredEntries) { Calendar.current.startOfDay(for: $0.startedAt) }
            .sorted { $0.key > $1.key }
    }

    var body: some View {
        GraftSettingsPage(intro: "A private, on-device history of listening activity detected for watched friends.") {
            SpotifyHistorySummary(entries: store.spotifyHistory.entries)
            GraftHistorySearchField(text: $searchText, prompt: "Search tracks, artists, or friends")
            HStack(spacing: 10) {
                Picker("Activity", selection: $filter) {
                    ForEach(SpotifyHistoryFilter.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented).labelsHidden()
                Picker("Friend", selection: $friendURI) {
                    Text("All Friends").tag("all")
                    ForEach(store.spotifyHistory.knownFriends) { friend in
                        Text(friend.displayName).tag(friend.id)
                    }
                }
                .frame(width: 180)
            }

            if filteredEntries.isEmpty {
                GraftSettingsGroup {
                    ContentUnavailableView(
                        searchText.isEmpty ? "No listening history" : "No matching tracks",
                        systemImage: "music.note.list",
                        description: Text(searchText.isEmpty ? "Tracks from watched friends will appear here automatically." : "Try another search or adjust your filters.")
                    )
                    .frame(maxWidth: .infinity).padding(.vertical, 26)
                }
            } else {
                ForEach(groupedEntries, id: \.0) { date, entries in
                    GraftSettingsGroup(date.formatted(date: .complete, time: .omitted)) {
                        ForEach(entries) { SpotifyHistoryRow(entry: $0) }
                    }
                }
            }
        }
        .navigationTitle("Listening History")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Clear History", role: .destructive) { confirmsClear = true }
                    .disabled(store.spotifyHistory.entries.isEmpty)
            }
        }
        .confirmationDialog("Clear Spotify listening history?", isPresented: $confirmsClear) {
            Button("Clear History", role: .destructive) { store.spotifyHistory.clear() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently removes the local listening log. Your watched-friends list is kept.")
        }
    }
}

private enum SpotifyHistoryFilter: String, CaseIterable, Identifiable {
    case all, listening, ended
    var id: String { rawValue }
    var title: String { self == .all ? "All" : self == .listening ? "Listening" : "Ended" }
}

private struct SpotifyHistorySummary: View {
    let entries: [SpotifyListeningLogEntry]
    var body: some View {
        HStack(spacing: 10) {
            SpotifySummaryItem(title: "Sessions", value: entries.count, symbol: "music.note.list", color: .green)
            SpotifySummaryItem(title: "Listening", value: entries.lazy.filter(\.isListening).count, symbol: "waveform", color: .blue)
            SpotifySummaryItem(title: "Friends", value: Set(entries.map(\.friendURI)).count, symbol: "person.2.fill", color: .purple)
        }
    }
}

private struct SpotifySummaryItem: View {
    let title: String
    let value: Int
    let symbol: String
    let color: Color
    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: symbol).foregroundStyle(color).frame(width: 20)
            VStack(alignment: .leading, spacing: 0) {
                Text(value.formatted()).font(.title3.weight(.semibold)).monospacedDigit()
                Text(title).font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(12).frame(maxWidth: .infinity)
        .background(Color.primary.opacity(0.045), in: RoundedRectangle(cornerRadius: 12))
        .overlay { RoundedRectangle(cornerRadius: 12).strokeBorder(.primary.opacity(0.08)) }
    }
}

private struct SpotifyHistoryRow: View {
    let entry: SpotifyListeningLogEntry
    var body: some View {
        GraftRow {
            AsyncImage(url: entry.artworkURL) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                GraftIconChip(symbol: "music.note", tint: .green)
            }
            .frame(width: 36, height: 36).clipShape(RoundedRectangle(cornerRadius: 7))
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.trackName).font(.body.weight(.medium)).lineLimit(1)
                Text("\(entry.artistName) · \(entry.friendName)")
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 10)
            VStack(alignment: .trailing, spacing: 2) {
                Text(entry.isListening ? "Listening now" : entry.startedAt.formatted(date: .omitted, time: .shortened))
                    .font(.caption.weight(entry.isListening ? .semibold : .regular))
                    .foregroundStyle(entry.isListening ? .green : .secondary)
                if let endedAt = entry.endedAt {
                    Text("Ended \(endedAt.formatted(date: .omitted, time: .shortened))")
                        .font(.caption2).foregroundStyle(.tertiary)
                } else {
                    Text(entry.startedAt, format: .relative(presentation: .named))
                        .font(.caption2).foregroundStyle(.tertiary)
                }
            }
            .help(entry.startedAt.formatted(date: .abbreviated, time: .standard))
        }
    }
}
