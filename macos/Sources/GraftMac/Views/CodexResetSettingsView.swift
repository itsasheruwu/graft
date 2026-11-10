import GraftCore
import SwiftUI

struct CodexResetSettingsRow: View {
    @Environment(GraftStore.self) private var store
    @State private var isExpanded = false

    private var service: CodexResetService { store.codexResets }

    var body: some View {
        VStack(spacing: 0) {
            GraftRow {
                GraftRowLabel(
                    title: "Auto-use Codex resets",
                    detail: "Use banked rate limit resets before they expire",
                    symbol: "arrow.clockwise.circle.fill",
                    tint: .green
                )
                Circle().fill(service.isEnabled ? Color.green : Color.secondary.opacity(0.4))
                    .frame(width: 6, height: 6)
                    .accessibilityLabel(service.isEnabled ? "On" : "Off")
                Text(service.status).font(.caption).foregroundStyle(.secondary)
                GraftDisclosureChevron(isExpanded: isExpanded)
                Toggle("Auto-use Codex resets", isOn: store.macToggle(\.codexAutoUseResetsEnabled))
                    .labelsHidden().toggleStyle(.switch).controlSize(.small)
            }
            .onTapGesture { withAnimation(.snappy(duration: 0.2)) { isExpanded.toggle() } }

            if isExpanded {
                GraftSettingsSubGroup(
                    "Reset inventory",
                    footer: "Uses your existing Codex sign-in. Graft must be running and your Mac awake to redeem about five minutes before expiry."
                ) {
                    GraftRow {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(service.detail).font(.callout).foregroundStyle(.secondary)
                            if let checked = service.lastCheckedAt {
                                Text("Checked \(checked.formatted(date: .omitted, time: .shortened))")
                                    .font(.caption).foregroundStyle(.tertiary)
                            }
                        }
                        Spacer()
                        if service.isChecking {
                            ProgressView().controlSize(.small)
                        } else {
                            Button("Check Now") { Task { await service.checkNow() } }
                                .controlSize(.small)
                        }
                    }
                    if let scheduled = service.nextRedemptionAt {
                        GraftRow {
                            Text("Next auto-use").font(.callout)
                            Spacer()
                            Text(scheduled, format: .dateTime.month().day().hour().minute())
                                .font(.callout).foregroundStyle(.secondary)
                        }
                    }
                    ForEach(service.credits) { credit in
                        GraftRow {
                            Text(credit.title ?? "Banked reset").font(.callout)
                            Spacer()
                            if let expiry = credit.expiresAt {
                                Text("Expires \(expiry.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.caption).foregroundStyle(.secondary)
                            } else {
                                Text("No expiry").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    if let redeemed = service.lastRedeemedAt {
                        GraftRow {
                            Text("Last reset used").font(.callout)
                            Spacer()
                            Text(redeemed, format: .dateTime.month().day().hour().minute())
                                .font(.callout).foregroundStyle(.secondary)
                        }
                    }
                }
                .disabled(!service.isEnabled)
                .padding(.leading, GraftMetrics.labelInset)
                .padding(.trailing, GraftMetrics.rowHorizontalPadding)
                .padding(.bottom, GraftMetrics.rowVerticalPadding)
            }
        }
    }
}
