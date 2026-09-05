import AppKit
import SwiftUI

struct ConnectionView: View {
    @Environment(GraftStore.self) private var store

    private var isConnected: Bool { store.isExtensionConnected }

    var body: some View {
        @Bindable var store = store
        return GraftSettingsPage(intro: "Connect the Graft app to the extension installed in Chrome.") {
            GraftSettingsGroup("Status") {
                GraftRow {
                    GraftRowLabel(
                        title: isConnected ? "Extension connected" : "Extension not connected",
                        detail: isConnected
                            ? "Browser controls are syncing with this Mac."
                            : "Install the bridge, then reload Graft in Chrome.",
                        symbol: isConnected ? "checkmark" : "cable.connector.slash",
                        tint: isConnected ? GraftTheme.green : .secondary
                    )
                    GraftStatusPill(isOn: isConnected, on: "Live", off: "Offline")
                }

                GraftRow {
                    GraftRowLabel(
                        title: store.canDeliverNativeNotifications
                            ? "Mac notifications ready"
                            : "Mac notifications unavailable",
                        detail: store.nativeNotificationStatusDetail,
                        symbol: store.canDeliverNativeNotifications ? "bell.badge.fill" : "bell.slash.fill",
                        tint: store.canDeliverNativeNotifications ? GraftTheme.green : .orange
                    )
                    if store.canDeliverNativeNotifications {
                        GraftStatusPill(isOn: true, on: "Native", off: "")
                    } else {
                        Button("Open Settings") { store.openNotificationSettings() }
                            .graftSecondaryButtonStyle()
                    }
                }
            }

            GraftSettingsGroup(
                "Extension Bridge",
                footer: "The bridge only exchanges Graft setting keys. It does not read browsing history or page content.",
                footerSymbol: "lock.shield",
                dividerInset: GraftMetrics.rowHorizontalPadding
            ) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Extension ID")
                        .font(.callout.weight(.medium))
                    TextField("32-character extension ID", text: $store.extensionID)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(.body, design: .monospaced))
                    Text("Open chrome://extensions, turn on Developer mode, then copy Graft's ID.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(GraftMetrics.rowHorizontalPadding)

                HStack(spacing: 10) {
                    Button("Install Extension Bridge") { store.installNativeHost() }
                        .graftPrimaryButtonStyle()
                        .tint(GraftTheme.green)
                        .disabled(store.extensionID.trimmingCharacters(in: .whitespaces).isEmpty)
                    Button("Open Chrome Extensions") {
                        store.openChromeExtensions()
                    }
                    .graftSecondaryButtonStyle()
                    Spacer(minLength: 0)
                }
                .controlSize(.regular)
                .padding(GraftMetrics.rowHorizontalPadding)

                if let message = store.connectionMessage {
                    Label(message, systemImage: "info.circle")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(GraftMetrics.rowHorizontalPadding)
                }
            }
        }
    }
}

/// Compact capsule that reads state at a glance without expanding anything.
struct GraftStatusPill: View {
    let isOn: Bool
    var on: String
    var off: String

    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(isOn ? GraftTheme.green : Color.secondary.opacity(0.45))
                .frame(width: 6, height: 6)
            Text(isOn ? on : off)
                .font(.caption.weight(.medium))
                .foregroundStyle(isOn ? .primary : .secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Color.primary.opacity(0.06), in: Capsule())
        .fixedSize()
    }
}
