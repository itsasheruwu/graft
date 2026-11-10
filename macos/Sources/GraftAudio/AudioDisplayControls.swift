import Foundation

extension AudioEngine {
    package func volume(_ app: DisplayableApp) -> Float {
        if case .active(let active) = app { return getVolume(for: active) }
        return getVolumeForInactive(identifier: app.id)
    }
    package func setVolume(_ app: DisplayableApp, _ value: Float) {
        guard value.isFinite else { return }
        let value = min(1, max(0, value))
        if case .active(let active) = app { setVolume(for: active, to: value) }
        else { setVolumeForInactive(identifier: app.id, to: value) }
    }
    package func muted(_ app: DisplayableApp) -> Bool {
        if case .active(let active) = app { return getMute(for: active) }
        return getMuteForInactive(identifier: app.id)
    }
    package func setMuted(_ app: DisplayableApp, _ value: Bool) {
        if case .active(let active) = app { setMute(for: active, to: value) }
        else { setMuteForInactive(identifier: app.id, to: value) }
    }
    package func boost(_ app: DisplayableApp) -> BoostLevel {
        if case .active(let active) = app { return getBoost(for: active) }
        return getBoostForInactive(identifier: app.id)
    }
    package func setBoost(_ app: DisplayableApp, _ value: BoostLevel) {
        if case .active(let active) = app { setBoost(for: active, to: value) }
        else { setBoostForInactive(identifier: app.id, to: value) }
    }
    package func eq(_ app: DisplayableApp) -> EQSettings {
        if case .active(let active) = app { return getEQSettings(for: active) }
        return getEQSettingsForInactive(identifier: app.id)
    }
    package func setEQ(_ app: DisplayableApp, _ value: EQSettings) {
        if case .active(let active) = app { setEQSettings(value, for: active) }
        else { setEQSettingsForInactive(value, identifier: app.id) }
    }
    package func route(_ app: DisplayableApp) -> String {
        settingsManager.getDeviceRouting(for: app.id) ?? ""
    }
    package func setRoute(_ app: DisplayableApp, _ uid: String) {
        if case .active(let active) = app { setDevice(for: active, deviceUID: uid.isEmpty ? nil : uid) }
        else { setDeviceRoutingForInactive(identifier: app.id, deviceUID: uid.isEmpty ? nil : uid) }
    }
    package func multi(_ app: DisplayableApp) -> Bool { settingsManager.getDeviceSelectionMode(for: app.id) == .multi }
    package func setMulti(_ app: DisplayableApp, _ enabled: Bool) {
        if enabled && selectedDevices(app).isEmpty, let uid = deviceVolumeMonitor.defaultDeviceUID { setSelectedDevices(app, [uid]) }
        if case .active(let active) = app { setDeviceSelectionMode(for: active, to: enabled ? .multi : .single) }
        else { setDeviceSelectionModeForInactive(identifier: app.id, to: enabled ? .multi : .single) }
    }
    package func selectedDevices(_ app: DisplayableApp) -> Set<String> { settingsManager.getSelectedDeviceUIDs(for: app.id) ?? [] }
    package func setSelectedDevices(_ app: DisplayableApp, _ uids: Set<String>) {
        if case .active(let active) = app { setSelectedDeviceUIDs(for: active, to: uids) }
        else { setSelectedDeviceUIDsForInactive(identifier: app.id, to: uids) }
    }
}
