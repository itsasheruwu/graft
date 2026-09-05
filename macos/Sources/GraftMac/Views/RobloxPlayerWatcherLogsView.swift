import SwiftUI

struct RobloxPlayerWatcherLogsView: View {
    @Environment(GraftStore.self) private var store
    @State private var searchText = ""
    @State private var filter = RobloxPresenceLogFilter.all

    private var filteredEntries: [RobloxPresenceLogEntry] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return store.robloxPresenceLogs.entries.filter { entry in
            (filter.kind == nil || entry.kind == filter.kind)
                && (query.isEmpty || [entry.username, entry.location, String(entry.userID)]
                    .contains { $0.localizedStandardContains(query) })
        }
    }

    var body: some View {
        GraftSettingsPage(intro: "A history of player status changes detected by Graft for Mac.") {
            RobloxLogSummary(entries: store.robloxPresenceLogs.entries)

            GraftHistorySearchField(text: $searchText, prompt: "Search players or games")

            Picker("Activity", selection: $filter) {
                ForEach(RobloxPresenceLogFilter.allCases) { option in
                    Text(option.title).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()

            if filteredEntries.isEmpty {
                GraftSettingsGroup {
                    ContentUnavailableView(
                        searchText.isEmpty ? "No \(filter.emptyStateName) yet" : "No matching activity",
                        systemImage: filter.symbol,
                        description: Text(searchText.isEmpty ? "New player activity will appear here automatically." : "Try another search or activity filter.")
                    )
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 26)
                }
            } else {
                GraftSettingsGroup("Recent activity", dividerInset: GraftMetrics.labelInset) {
                    ForEach(filteredEntries) { entry in
                        RobloxLogRow(entry: entry)
                    }
                }
            }
        }
        .navigationTitle("Watcher Logs")
    }
}

private enum RobloxPresenceLogFilter: String, CaseIterable, Identifiable {
    case all
    case online
    case offline
    case joinGame

    var id: String { rawValue }
    var kind: RobloxPresenceLogKind? {
        switch self {
        case .all: nil
        case .online: .online
        case .offline: .offline
        case .joinGame: .joinGame
        }
    }
    var title: String {
        switch self {
        case .all: "All"
        case .online: "Online"
        case .offline: "Offline"
        case .joinGame: "Joined"
        }
    }
    var emptyStateName: String {
        self == .all ? "activity" : "\(title.lowercased()) logs"
    }
    var symbol: String {
        switch self {
        case .all: "clock.arrow.circlepath"
        case .online: "circle.fill"
        case .offline: "circle"
        case .joinGame: "gamecontroller.fill"
        }
    }
}

private struct RobloxLogSummary: View {
    let entries: [RobloxPresenceLogEntry]

    var body: some View {
        HStack(spacing: 10) {
            SummaryItem(title: "Online", count: count(.online), symbol: "circle.fill", color: .green)
            SummaryItem(title: "Offline", count: count(.offline), symbol: "circle", color: .secondary)
            SummaryItem(title: "Joined", count: count(.joinGame), symbol: "gamecontroller.fill", color: .blue)
        }
    }

    private func count(_ kind: RobloxPresenceLogKind) -> Int {
        entries.lazy.filter { $0.kind == kind }.count
    }
}

private struct SummaryItem: View {
    let title: String
    let count: Int
    let symbol: String
    let color: Color

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: symbol)
                .foregroundStyle(color)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 0) {
                Text(count.formatted())
                    .font(.title3.weight(.semibold))
                    .monospacedDigit()
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity)
        .background(Color.primary.opacity(0.045), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(.primary.opacity(0.08))
        }
    }
}

private struct RobloxLogRow: View {
    let entry: RobloxPresenceLogEntry

    var body: some View {
        GraftRow {
            GraftIconChip(symbol: symbol, tint: color)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body.weight(.medium))
                if (entry.kind == .joinGame && entry.location.isEmpty) || (entry.kind == .online && !entry.location.isEmpty) {
                    Text(entry.kind == .joinGame ? "Game details unavailable from Roblox" : entry.location)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 12)
            Text(entry.recordedAt, format: .relative(presentation: .named))
                .font(.caption)
                .foregroundStyle(.secondary)
                .monospacedDigit()
                .help(entry.recordedAt.formatted(date: .abbreviated, time: .standard))
        }
    }

    private var title: String {
        switch entry.kind {
        case .online: "\(entry.username) came online"
        case .offline: "\(entry.username) went offline"
        case .joinGame: entry.location.isEmpty ? "\(entry.username) joined a game" : "\(entry.username) joined \(entry.location)"
        }
    }

    private var symbol: String {
        switch entry.kind {
        case .online: "person.crop.circle.badge.checkmark"
        case .offline: "person.crop.circle.badge.minus"
        case .joinGame: "gamecontroller.fill"
        }
    }

    private var color: Color {
        switch entry.kind {
        case .online: .green
        case .offline: .secondary
        case .joinGame: .blue
        }
    }
}
