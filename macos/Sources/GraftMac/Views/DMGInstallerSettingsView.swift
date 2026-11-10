import SwiftUI

struct DMGInstallerSettingsRow: View {
    @Environment(GraftStore.self) private var store
    @State private var isExpanded = false

    var body: some View {
        VStack(spacing: 0) {
            GraftRow {
                GraftRowLabel(
                    title: "Auto-install DMGs",
                    detail: "Open a DMG to copy its apps into Applications",
                    symbol: "externaldrive.badge.plus", tint: .blue
                )
                Circle().fill(store.dmgInstaller.isEnabled ? Color.green : Color.secondary.opacity(0.4))
                    .frame(width: 6, height: 6)
                    .accessibilityLabel(store.dmgInstaller.isEnabled ? "On" : "Off")
                Text(store.dmgInstaller.status).font(.caption).foregroundStyle(.secondary)
                Button {
                    withAnimation(.snappy(duration: 0.2)) { isExpanded.toggle() }
                } label: {
                    GraftDisclosureChevron(isExpanded: isExpanded)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("DMG installation options")
                .accessibilityValue(isExpanded ? "Expanded" : "Collapsed")
                Toggle("Auto-install DMGs", isOn: store.macToggle(\.dmgAutoInstallEnabled))
                    .labelsHidden().toggleStyle(.switch).controlSize(.small)
            }
            if isExpanded {
                GraftSettingsSubGroup(
                    "Installation",
                    footer: "Graft must be running before you open the DMG. Supports drag-to-install apps; existing apps and package installers need manual installation. Images eject after success. macOS security checks still apply. Turning this off lets an install already in progress finish."
                ) {
                    GraftToggleRow(
                        title: "Delete DMG after installation",
                        detail: "Move the DMG to Trash after all apps install and the image ejects",
                        isOn: store.macToggle(\.dmgAutoInstallTrashAfterSuccess)
                    )
                    GraftRow {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(store.dmgInstaller.status).font(.callout.weight(.medium))
                            Text(store.dmgInstaller.detail).font(.caption).foregroundStyle(.secondary)
                                .textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer()
                        if store.dmgInstaller.isInstalling { ProgressView().controlSize(.small) }
                    }
                }
                .disabled(!store.dmgInstaller.isEnabled)
                .padding(.leading, GraftMetrics.labelInset)
                .padding(.trailing, GraftMetrics.rowHorizontalPadding)
                .padding(.bottom, GraftMetrics.rowVerticalPadding)
            }
        }
    }
}
