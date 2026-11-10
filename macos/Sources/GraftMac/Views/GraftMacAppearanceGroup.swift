import GraftBend
import SwiftUI
import ServiceManagement

struct GraftStartupRow: View {
    @Environment(GraftStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        let service = store.macTweaks.appearance
        VStack(alignment: .leading, spacing: 8) {
            GraftToggleRow(
                title: "Open on startup", detail: "Open Graft automatically when you log in to your Mac",
                symbol: "power", tint: .green,
                isOn: Binding(get: { service.opensAtLogin }, set: { service.setOpenAtLogin($0) })
            )
            if service.loginStatus == .requiresApproval {
                Button("Allow Graft in Login Items…") { service.openLoginSettings() }
                    .padding(.leading, GraftMetrics.labelInset).padding(.bottom, 10)
            }
            if let error = service.loginError {
                Text(error).font(.caption).foregroundStyle(.red)
                    .padding(.leading, GraftMetrics.labelInset).padding(.bottom, 10)
            }
        }
        .onAppear { service.refreshLoginStatus() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { service.refreshLoginStatus() }
        }
    }
}

struct GraftMacAppearanceGroup: View {
    @Environment(GraftStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @State private var expanded = false
    @State private var progress = 0.65

    var body: some View {
        @Bindable var appearance = store.macTweaks.appearance
        @Bindable var bend = store.macTweaks.bend
        GraftSettingsGroup("Appearance") {
            GraftPickerRow(
                title: "Graft appearance",
                detail: "Choose how Graft’s windows and menus look",
                symbol: "circle.lefthalf.filled",
                tint: .indigo,
                selection: $appearance.appearance
            ) {
                ForEach(GraftAppearanceService.Appearance.allCases, id: \.self) { choice in
                    Text(choice.title).tag(choice)
                }
            }
            VStack(alignment: .leading, spacing: 0) {
                GraftToggleRow(
                    title: "MacBook closing and open animation",
                    detail: "Fold the desktop as you move your MacBook lid",
                    symbol: "macbook", tint: .purple, isOn: $bend.enabled
                )
                DisclosureGroup("Animation options", isExpanded: $expanded) {
                    GraftSettingsSubGroup("Lid animation", footer: "Powered by Bendable. Only the built-in display animates. Desktop stills stay in memory and are discarded after the animation.") {
                        GraftRow {
                            Text("Style")
                            Spacer()
                            Picker("Style", selection: $bend.style) {
                                Text("Fold").tag("fold")
                                Text("Crease").tag("crease")
                                Text("Fade").tag("fade")
                                Text("Aperture").tag("aperture")
                                Text("Shutter").tag("shutter")
                            }
                            .graftTrailingPicker()
                        }
                        GraftToggleRow(title: "Animate opening", detail: "Unfold when you raise the lid", symbol: "arrow.up", tint: .blue, isOn: $bend.animateOpening)
                        GraftToggleRow(title: "Animate closing", detail: "Fold when you lower the lid", symbol: "arrow.down", tint: .purple, isOn: $bend.animateClosing)
                        GraftRow {
                            Text("Start angle · \(Int(bend.startAngle))°")
                            Spacer()
                            Slider(value: $bend.startAngle, in: 20...120, step: 1)
                                .frame(width: 150).accessibilityLabel("Animation start angle")
                        }
                        VStack(alignment: .leading, spacing: 10) {
                            Text(bend.status).font(.callout.weight(.medium))
                            if bend.enabled { Text(bend.statusDetail).font(.caption).foregroundStyle(.secondary) }
                            bend.previewView(progress: progress)
                                .frame(height: 150).clipShape(RoundedRectangle(cornerRadius: 10))
                            Slider(value: $progress, in: 0...1)
                                .accessibilityLabel("Fold preview, closed to open")
                            HStack {
                                Button("Preview on display") { bend.preview() }
                                Button("Reset lid calibration") { bend.resetCalibration() }
                            }
                            if bend.needsScreenPermission {
                                Text("Fold and Crease need Screen Recording to redraw your desktop. Until allowed, the display uses a fade. Restart Graft after granting permission if needed.")
                                    .font(.caption).foregroundStyle(.secondary)
                                Button("Allow Screen Recording…") { bend.requestPermission() }
                            }
                            if bend.reducedMotion {
                                Text("Reduce Motion is on. Display animations use a gentle fade.")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Link("About Bendable", destination: URL(string: "https://github.com/opensourcevillain/Bendable")!)
                                .font(.caption)
                        }.padding(12)
                    }
                    .disabled(!bend.enabled)
                }
                .padding(.leading, GraftMetrics.labelInset)
                .padding(.trailing, GraftMetrics.rowHorizontalPadding)
                .padding(.bottom, 12)
            }
        }
        .onAppear { bend.refreshPermission() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { bend.refreshPermission() }
        }
    }
}
