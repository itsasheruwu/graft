import AppKit
import Observation
import ServiceManagement

@Observable
final class GraftAppearanceService {
    enum Appearance: String, CaseIterable {
        case system, light, dark
        var title: String { rawValue.capitalized }
    }

    var appearance: Appearance {
        didSet {
            UserDefaults.standard.set(appearance.rawValue, forKey: "graft.appearance")
            applyAppearance()
        }
    }
    private(set) var loginStatus = SMAppService.mainApp.status
    private(set) var loginError: String?
    var opensAtLogin: Bool { loginStatus == .enabled || loginStatus == .requiresApproval }

    init() {
        appearance = Appearance(rawValue: UserDefaults.standard.string(forKey: "graft.appearance") ?? "") ?? .system
    }

    func applyAppearance() {
        guard let app = NSApp else { return }
        switch appearance {
        case .system: app.appearance = nil
        case .light: app.appearance = NSAppearance(named: .aqua)
        case .dark: app.appearance = NSAppearance(named: .darkAqua)
        }
    }

    func refreshLoginStatus() { loginStatus = SMAppService.mainApp.status }

    func setOpenAtLogin(_ enabled: Bool) {
        loginError = nil
        do {
            if enabled { try SMAppService.mainApp.register() }
            else { try SMAppService.mainApp.unregister() }
        } catch {
            loginError = error.localizedDescription
        }
        refreshLoginStatus()
    }

    func openLoginSettings() { SMAppService.openSystemSettingsLoginItems() }
}
