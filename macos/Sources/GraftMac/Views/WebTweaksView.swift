import GraftCore
import SwiftUI

struct WebTweaksView: View {
    @State private var query = ""

    private var matches: [BrowserTweakDefinition] {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return BrowserTweakCatalog.tweaks }
        return BrowserTweakCatalog.tweaks.filter { $0.matches(trimmed) }
    }

    var body: some View {
        GraftSettingsPage(intro: "Control how Graft tweaks behave across your browser.") {
            ForEach(BrowserTweakCatalog.categories, id: \.self) { category in
                let tweaks = matches.filter { $0.category == category }
                if !tweaks.isEmpty {
                    GraftSettingsGroup(category) {
                        ForEach(tweaks) { tweak in
                            TweakRow(tweak: tweak, alwaysExpanded: !query.isEmpty)
                        }
                    }
                }
            }
        }
        .searchable(text: $query, placement: .toolbar, prompt: "Search tweaks")
        .overlay {
            if matches.isEmpty {
                ContentUnavailableView.search(text: query)
            }
        }
    }
}

private struct TweakRow: View {
    @Environment(GraftStore.self) private var store
    let tweak: BrowserTweakDefinition
    /// While searching, sub-options stay open so a match is never hidden behind a chevron.
    let alwaysExpanded: Bool

    @State private var isExpanded = false
    @State private var isHovering = false

    private var subControls: [TweakControlDefinition] {
        Array(tweak.controls.dropFirst())
    }

    private var notificationControls: [TweakControlDefinition] {
        guard tweak.id == "roblox-player-watcher" else { return [] }
        return subControls.filter { Self.notificationControlIDs.contains($0.id) }
    }

    private var remainingSubControls: [TweakControlDefinition] {
        guard tweak.id == "roblox-player-watcher" else { return subControls }
        return subControls.filter { !Self.notificationControlIDs.contains($0.id) }
    }

    private var showsSubControls: Bool {
        (!subControls.isEmpty || tweak.id == "roblox-player-watcher") && (isExpanded || alwaysExpanded)
    }

    private static let notificationControlIDs: Set<String> = [
        "robloxPlayerWatcherNotifyOnline",
        "robloxPlayerWatcherNotifyOffline",
        "robloxPlayerWatcherNotifyJoinGame",
        "robloxPlayerWatcherAntiSpamEnabled",
        "robloxPlayerWatcherShowExactGame",
    ]

    private var isEnabled: Bool {
        store.bool(for: tweak.primaryKey)
    }

    var body: some View {
        VStack(spacing: 0) {
            GraftRow {
                GraftRowLabel(
                    title: tweak.name,
                    detail: tweak.summary,
                    symbol: tweak.icon,
                    tint: tweak.iconColor
                )

                if !subControls.isEmpty {
                    GraftDisclosureChevron(isExpanded: showsSubControls)
                        .opacity(alwaysExpanded ? 0.35 : 1)
                }

                Toggle("", isOn: Binding(
                    get: { isEnabled },
                    set: { store.setBrowserValue(.bool($0), for: tweak.primaryKey) }
                ))
                .labelsHidden()
                .toggleStyle(.switch)
                .controlSize(.small)
                .accessibilityLabel(tweak.name)
            }
            .background(isHovering && !subControls.isEmpty ? Color.primary.opacity(0.04) : .clear)
            .onHover { isHovering = $0 }
            .onTapGesture {
                guard !subControls.isEmpty, !alwaysExpanded else { return }
                isExpanded.toggle()
            }

            if showsSubControls {
                Divider().padding(.leading, GraftMetrics.labelInset)
                VStack(spacing: 10) {
                    if tweak.id == "roblox-player-watcher" {
                        RobloxWatcherLogsLink()
                    }
                    if !notificationControls.isEmpty {
                        RobloxNotificationSubgroup(controls: notificationControls)
                    }
                    ForEach(remainingSubControls) { control in
                        ControlRow(control: control)
                    }
                    if tweak.id == "roblox-player-watcher" {
                        RobloxPlayerWhitelistEditor()
                    }
                }
                .padding(.leading, GraftMetrics.labelInset)
                .padding(.trailing, GraftMetrics.rowHorizontalPadding)
                .padding(.vertical, 12)
                .disabled(!isEnabled)
                .opacity(isEnabled ? 1 : 0.45)
            }
        }
        .animation(.snappy(duration: 0.2), value: showsSubControls)
    }
}

private struct RobloxNotificationSubgroup: View {
    @Environment(GraftStore.self) private var store
    let controls: [TweakControlDefinition]
    @State private var isExpanded = false

    var body: some View {
        GraftDisclosureSubGroup(
            "Notifications",
            isExpanded: $isExpanded,
            footer: "Time Sensitive alerts and notification sounds apply only when Graft for Mac delivers the alert. Chrome fallback notifications keep the browser's notification behavior."
        ) {
            ForEach(controls) { control in
                GraftToggleRow(
                    title: control.label,
                    detail: control.id == "robloxPlayerWatcherAntiSpamEnabled"
                        ? "Skip extra join-game alerts when a player hops experiences"
                        : nil,
                    isOn: Binding(
                        get: { store.value(for: control).boolValue ?? false },
                        set: { store.setBrowserValue(.bool($0), for: control.id) }
                    )
                )
            }
            GraftToggleRow(
                title: "Time Sensitive alerts",
                detail: "Allow current player activity to break through Focus when macOS permits it",
                isOn: store.macToggle(\.robloxWatcherTimeSensitive)
            )
            GraftToggleRow(
                title: "Play notification sounds",
                detail: "Turn this off to receive silent Roblox Player Watcher alerts",
                isOn: store.macToggle(\.robloxWatcherNotificationSoundEnabled)
            )
        }
    }
}

private struct RobloxWatcherLogsLink: View {
    var body: some View {
        NavigationLink {
            RobloxPlayerWatcherLogsView()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "list.bullet.rectangle.portrait.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.cyan)
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Logs")
                        .font(.callout.weight(.medium))
                    Text("View online, offline, and join activity")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.primary.opacity(0.045), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(.primary.opacity(0.08))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct RobloxPlayerWhitelistEditor: View {
    @Environment(GraftStore.self) private var store
    @State private var entry = ""
    @State private var addError: String?
    @State private var isAdding = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider()
            Text("Watched players")
                .font(.callout.weight(.medium))
            Text("Add usernames, user IDs, or profile URLs. Changes sync with the extension.")
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                TextField("Username or user ID", text: $entry)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { Task { await add() } }
                Button(isAdding ? "Adding…" : "Add") { Task { await add() } }
                    .disabled(isAdding || entry.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            if let addError {
                Text(addError).font(.caption).foregroundStyle(.red)
            }
            ForEach(store.robloxPlayerWatcherWhitelist, id: \.self) { player in
                HStack {
                    Text(player).font(.callout)
                    Spacer()
                    Button("Remove", systemImage: "xmark") {
                        store.removeRobloxPlayer(player)
                    }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.borderless)
                    .help("Remove \(player)")
                }
            }
        }
    }

    private func add() async {
        guard !isAdding else { return }
        isAdding = true
        addError = nil
        do {
            try await store.addRobloxPlayer(entry)
            entry = ""
        } catch {
            addError = error.localizedDescription
        }
        isAdding = false
    }
}

/// One nested sub-option beneath its parent tweak.
private struct ControlRow: View {
    @Environment(GraftStore.self) private var store
    let control: TweakControlDefinition

    var body: some View {
        HStack(spacing: 12) {
            Text(control.label)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 12)

            switch control.kind {
            case .toggle:
                Toggle("", isOn: Binding(
                    get: { store.value(for: control).boolValue ?? false },
                    set: { store.setBrowserValue(.bool($0), for: control.id) }
                ))
                .labelsHidden()
                .toggleStyle(.switch)
                .controlSize(.small)

            case .slider(let range, let step, let suffix):
                let value = store.value(for: control).numberValue ?? range.lowerBound
                Slider(value: Binding(
                    get: { value },
                    set: { store.setBrowserValue(.number($0), for: control.id) }
                ), in: range, step: step)
                .controlSize(.small)
                .frame(width: 170)
                Text("\(value.formatted(.number.precision(.fractionLength(0...2))))\(suffix)")
                    .font(.callout)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                    .frame(width: 42, alignment: .trailing)

            case .picker(let options):
                Picker("", selection: Binding(
                    get: { store.value(for: control).stringValue ?? options[0].value },
                    set: { store.setBrowserValue(.string($0), for: control.id) }
                )) {
                    ForEach(options, id: \.value) { option in
                        Text(option.label).tag(option.value)
                    }
                }
                .labelsHidden()
                .controlSize(.small)
                .frame(width: 170)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(control.label)
    }
}

private extension BrowserTweakDefinition {
    func matches(_ query: String) -> Bool {
        var haystack = [name, summary, category] + controls.map(\.label)
        if id == "roblox-player-watcher" {
            haystack += ["Notifications", "Time Sensitive", "notification sounds"]
        }
        return haystack.contains { $0.localizedCaseInsensitiveContains(query) }
    }

    /// Per-tweak rather than per-category: the category header already names the
    /// group, so sharing one chip across its rows just makes them look identical.
    var icon: String {
        switch id {
        case "force-dark-mode": "moon.fill"
        case "theme-syncer": "circle.lefthalf.filled"
        case "graft-ai-rewriter": "wand.and.sparkles"
        case "asset-finder": "photo.on.rectangle.angled"
        case "sound-booster": "speaker.wave.3.fill"
        case "element-selector": "cursorarrow.rays"
        case "scroll-to-top": "arrow.up.to.line"
        case "roblox-player-watcher": "person.2.wave.2.fill"
        case "wikipedia-enhancements": "book.closed.fill"
        case "x-quiet-feed": "bubble.left.and.bubble.right.fill"
        case "youtube-auto-translate": "captions.bubble.fill"
        default: "puzzlepiece.extension.fill"
        }
    }

    var iconColor: Color {
        switch id {
        case "force-dark-mode": .indigo
        case "theme-syncer": .teal
        case "graft-ai-rewriter": .purple
        case "asset-finder": .pink
        case "sound-booster": .orange
        case "element-selector": .blue
        case "scroll-to-top": .mint
        case "roblox-player-watcher": .cyan
        case "wikipedia-enhancements": .brown
        // X's chip stays neutral-dark in both appearances; `.primary` would put a
        // white glyph on a white chip in dark mode.
        case "x-quiet-feed": Color(white: 0.22)
        case "youtube-auto-translate": .red
        default: .blue
        }
    }
}
