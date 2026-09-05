import SwiftUI

struct ContentView: View {
    @Environment(GraftStore.self) private var store
    @SceneStorage("graft.selection") private var selection = AppDestination.web

    var body: some View {
        NavigationSplitView {
            GraftSidebar(selection: $selection)
                .navigationSplitViewColumnWidth(min: 200, ideal: 216, max: 280)
        } detail: {
            NavigationStack {
                Group {
                    switch selection {
                    case .web: WebTweaksView()
                    case .mac: MacTweaksView()
                    case .connection: ConnectionView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .navigationTitle(selection.rawValue)
            }
            // A section owns its detail navigation. Switching sections must
            // discard pushed history pages along with the previous root.
            .id(selection)
        }
        .frame(minWidth: 720, minHeight: 520)
        .onAppear { store.reapplyWindowSettings() }
    }
}

private struct GraftSidebar: View {
    @Environment(GraftStore.self) private var store
    @Binding var selection: AppDestination

    var body: some View {
        List(selection: $selection) {
            ForEach(AppDestination.allCases) { destination in
                SidebarRow(destination: destination)
                    .tag(destination)
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        // Pinned rather than scrolled with the list, so the identity and the
        // connection state are always readable.
        .safeAreaInset(edge: .top, spacing: 0) {
            GraftSidebarIdentity()
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            SidebarConnectionFooter(isConnected: store.isExtensionConnected) {
                selection = .connection
            }
        }
    }
}

private struct GraftSidebarIdentity: View {
    var body: some View {
        HStack(spacing: 9) {
            GraftAppIcon(size: 26)
            VStack(alignment: .leading, spacing: 0) {
                Text("Graft")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.primary)
                Text("Small fixes, grafted onto the web.")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.top, 2)
        .padding(.bottom, 10)
    }
}

private struct SidebarRow: View {
    let destination: AppDestination

    var body: some View {
        HStack(spacing: 9) {
            GraftIconChip(symbol: destination.icon, tint: destination.tint, size: 20)
            Text(destination.rawValue)
                .font(.system(size: 13))
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .frame(height: 26)
        .contentShape(Rectangle())
        .listRowSeparator(.hidden)
    }
}

/// Persistent connection readout, so the state is visible from every pane and
/// clicking it lands on the page that fixes it.
private struct SidebarConnectionFooter: View {
    let isConnected: Bool
    let action: () -> Void

    @State private var isHovering = false

    var body: some View {
        VStack(spacing: 0) {
            Divider()
            Button(action: action) {
                HStack(spacing: 7) {
                    Circle()
                        .fill(isConnected ? GraftTheme.green : Color.secondary.opacity(0.45))
                        .frame(width: 7, height: 7)
                    Text(isConnected ? "Extension connected" : "Extension offline")
                        .font(.caption)
                        .foregroundStyle(isConnected ? .primary : .secondary)
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .contentShape(Rectangle())
                .background(isHovering ? Color.primary.opacity(0.05) : .clear)
            }
            .buttonStyle(.plain)
            .onHover { isHovering = $0 }
            .help("Open extension connection settings")
        }
    }
}

private extension AppDestination {
    var tint: Color {
        switch self {
        case .web: .blue
        case .mac: .green
        case .connection: .orange
        }
    }
}
