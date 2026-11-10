// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
// FineTune/Utilities/URLHandler.swift
import Foundation
import os

/// Protocol for the AudioEngine surface that URLHandler depends on.
/// Extracted for testability (allows mock injection).
@MainActor
package protocol URLHandlerEngine {
    var apps: [AudioApp] { get }
    var settingsManager: SettingsManager { get }
    func setVolume(for app: AudioApp, to volume: Float)
    func getVolume(for app: AudioApp) -> Float
    func setBoost(for app: AudioApp, to boost: BoostLevel)
    func setMute(for app: AudioApp, to muted: Bool)
    func getMute(for app: AudioApp) -> Bool
    func setEQSettings(_ settings: EQSettings, for app: AudioApp)
    func setDevice(for app: AudioApp, deviceUID: String?)
    func setDeviceSelectionMode(for app: AudioApp, to mode: DeviceSelectionMode)
    func setSelectedDeviceUIDs(for app: AudioApp, to uids: Set<String>)
    func setAutoEQProfile(for deviceUID: String, profileID: String?)
    func setAutoEQEnabled(for deviceUID: String, enabled: Bool)
    func setLoudnessCompensationEnabled(_ enabled: Bool)
    func setLoudnessEqualizationEnabled(_ enabled: Bool)
    func setVolumeForInactive(identifier: String, to volume: Float)
    func setBoostForInactive(identifier: String, to boost: BoostLevel)
    func setMuteForInactive(identifier: String, to muted: Bool)
    func getMuteForInactive(identifier: String) -> Bool
    func setEQSettingsForInactive(_ settings: EQSettings, identifier: String)
    func setDeviceRoutingForInactive(identifier: String, deviceUID: String?)
    func setDeviceSelectionModeForInactive(identifier: String, to mode: DeviceSelectionMode)
    func setSelectedDeviceUIDsForInactive(identifier: String, to uids: Set<String>)
    func pinApp(identifier: String, displayName: String?, bundleID: String?)
    func unpinApp(_ identifier: String)
    func ignoreApp(identifier: String, displayName: String?, bundleID: String?)
    func unignoreApp(_ identifier: String)
}

/// Handles URL scheme actions for FineTune (finetune://...)
@MainActor
package final class URLHandler {
    private let audioEngine: any URLHandlerEngine
    private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "GraftAudio", category: "URLHandler")

    package init(audioEngine: any URLHandlerEngine) {
        self.audioEngine = audioEngine
    }
    
    package func handleURL(_ url: URL) {
        logger.debug("Received audio command")
        
        guard Self.isValidCommand(url) else {
            logger.warning("Unknown URL scheme: \(url.scheme ?? "nil")")
            return
        }
        
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let host = url.pathComponents.dropFirst().first
        let queryItems = components?.queryItems ?? []
      
        switch host {
        // Volume actions
        case "set-volumes":
            handleSetVolumes(queryItems: queryItems)
        case "step-volume":
            handleStepVolume(queryItems: queryItems)
        case "set-boost":
            handleSetBoost(queryItems: queryItems)
        case "set-eq":
            handleSetEQ(queryItems: queryItems)
        // Mute actions
        case "set-mute":
            handleSetMute(queryItems: queryItems)
        case "toggle-mute":
            handleToggleMute(queryItems: queryItems)
        // Other actions
        case "set-device":
            handleSetDevice(queryItems: queryItems)
        case "set-device-mode":
            handleSetDeviceMode(queryItems: queryItems)
        case "set-autoeq":
            handleSetAutoEQ(queryItems: queryItems)
        case "set-loudness":
            handleSetLoudness(queryItems: queryItems)
        case "pin-app":
            handlePinApp(queryItems: queryItems)
        case "unpin-app":
            handleUnpinApp(queryItems: queryItems)
        case "ignore-app":
            handleIgnoreApp(queryItems: queryItems)
        case "unignore-app":
            handleUnignoreApp(queryItems: queryItems)
        case "reset":
            handleReset(queryItems: queryItems)
        default:
            logger.warning("Unknown URL action: \(host ?? "nil")")
        }
    }
    
    // MARK: - Volume Actions

    /// Set volumes for one or more apps
    /// URL format: finetune://set-volumes?app=com.a&volume=100&app=com.b&volume=50
    /// Volume is percentage: 0-400, where 100 is unity and 400 is 4x boost.
    private func handleSetVolumes(queryItems: [URLQueryItem]) {
        var pairs: [(identifier: String, volumePercent: Int, gain: Float)] = []
        var currentApp: String?

        // Parse app/volume pairs in order
        for item in queryItems {
            switch item.name.lowercased() {
            case "app":
                currentApp = item.value
            case "volume":
                guard let app = currentApp else {
                    logger.warning("set-volumes: volume parameter without preceding app")
                    continue
                }
                guard let volumeStr = item.value,
                      let volume = Int(volumeStr),
                      let gain = VolumeMapping.urlPercentToGain(volume) else {
                    logger.warning("set-volumes: invalid volume '\(item.value ?? "nil")' for app \(app) (valid range: 0-400)")
                    currentApp = nil
                    continue
                }
                pairs.append((app, volume, gain))
                currentApp = nil
            default:
                continue
            }
        }

        // Warn about trailing app without volume
        if let trailing = currentApp {
            logger.warning("set-volumes: trailing app '\(trailing)' without volume parameter")
        }

        guard !pairs.isEmpty else {
            logger.error("set-volumes: No valid app/volume pairs found")
            return
        }

        for (identifier, volumePercent, gain) in pairs {
            let boost = BoostLevel.allCases.first { $0.rawValue >= gain } ?? .x4
            let base = gain / boost.rawValue
            if let app = findApp(by: identifier) {
                audioEngine.setBoost(for: app, to: boost)
                audioEngine.setVolume(for: app, to: base)
                logger.info("Set volume for \(app.name) to \(volumePercent)%")
            } else {
                // App not active - persist for when it launches
                audioEngine.setBoostForInactive(identifier: identifier, to: boost)
                audioEngine.setVolumeForInactive(identifier: identifier, to: base)
                logger.info("Set volume for inactive app \(identifier) to \(volumePercent)%")
            }
        }
    }

    /// Step volume up or down for an app
    /// URL format: finetune://step-volume?app=com.a&direction=up (or down)
    /// Steps by 5% slider position
    private func handleStepVolume(queryItems: [URLQueryItem]) {
        guard let appIdentifier = queryItems.first(where: { $0.name == "app" })?.value else {
            logger.error("step-volume: missing app parameter")
            return
        }

        guard let direction = queryItems.first(where: { $0.name == "direction" })?.value else {
            logger.error("step-volume: missing direction parameter (use 'up' or 'down')")
            return
        }

        guard let app = findApp(by: appIdentifier) else {
            logger.warning("step-volume: app not found '\(appIdentifier)'")
            return
        }

        let currentGain = audioEngine.getVolume(for: app)
        let stepAmount: Double = 0.05 // 5% slider position
        var sliderPosition = VolumeMapping.gainToSlider(currentGain)

        switch direction.lowercased() {
        case "up", "+":
            sliderPosition = min(1.0, sliderPosition + stepAmount)
        case "down", "-":
            sliderPosition = max(0.0, sliderPosition - stepAmount)
        default:
            logger.error("step-volume: invalid direction '\(direction)'. Use 'up' or 'down'")
            return
        }

        let newGain = VolumeMapping.sliderToGain(sliderPosition)
        audioEngine.setVolume(for: app, to: newGain)
        let newPercent = Int(round(newGain * 100))
        logger.info("Stepped volume \(direction) for \(app.name) to \(newPercent)%")
    }

    private func handleSetBoost(queryItems: [URLQueryItem]) {
        guard let appIdentifier = value("app", in: queryItems) else {
            logger.error("set-boost: missing app parameter")
            return
        }
        guard let boostValue = value("boost", in: queryItems),
              let boost = parseBoost(boostValue) else {
            logger.error("set-boost: invalid boost parameter")
            return
        }

        if let app = findApp(by: appIdentifier) {
            audioEngine.setBoost(for: app, to: boost)
        } else {
            audioEngine.setBoostForInactive(identifier: appIdentifier, to: boost)
        }
    }

    private func handleSetEQ(queryItems: [URLQueryItem]) {
        guard let appIdentifier = value("app", in: queryItems) else {
            logger.error("set-eq: missing app parameter")
            return
        }

        var settings: EQSettings
        if let presetValue = value("preset", in: queryItems),
           let preset = parseEQPreset(presetValue) {
            settings = preset.settings
        } else if let gainsValue = value("gains", in: queryItems) {
            let gains = gainsValue
                .split(separator: ",")
                .compactMap { Float($0.trimmingCharacters(in: .whitespaces)) }
            guard gains.count == EQSettings.bandCount else {
                logger.error("set-eq: gains must include \(EQSettings.bandCount) comma-separated values")
                return
            }
            settings = EQSettings(bandGains: gains)
        } else {
            logger.error("set-eq: missing preset or gains parameter")
            return
        }

        if let enabledValue = value("enabled", in: queryItems),
           let enabled = parseBool(enabledValue) {
            settings.isEnabled = enabled
        }

        if let app = findApp(by: appIdentifier) {
            audioEngine.setEQSettings(settings, for: app)
        } else {
            audioEngine.setEQSettingsForInactive(settings, identifier: appIdentifier)
        }
    }

    // MARK: - Mute Actions

    /// Set mute state for one or more apps
    /// URL format: finetune://set-mute?app=com.a&muted=true&app=com.b&muted=false
    private func handleSetMute(queryItems: [URLQueryItem]) {
        var pairs: [(identifier: String, muted: Bool)] = []
        var currentApp: String?

        for item in queryItems {
            switch item.name.lowercased() {
            case "app":
                currentApp = item.value
            case "muted":
                guard let app = currentApp else {
                    logger.warning("set-mute: muted parameter without preceding app")
                    continue
                }
                guard let mutedStr = item.value,
                      let muted = parseBool(mutedStr) else {
                    logger.warning("set-mute: invalid muted value '\(item.value ?? "nil")' for app \(app)")
                    currentApp = nil
                    continue
                }
                pairs.append((app, muted))
                currentApp = nil
            default:
                continue
            }
        }

        // Warn about trailing app without muted value
        if let trailing = currentApp {
            logger.warning("set-mute: trailing app '\(trailing)' without muted parameter")
        }

        guard !pairs.isEmpty else {
            logger.error("set-mute: No valid app/muted pairs found")
            return
        }

        for (identifier, muted) in pairs {
            if let app = findApp(by: identifier) {
                audioEngine.setMute(for: app, to: muted)
                logger.info("Set mute for \(app.name) to \(muted)")
            } else {
                audioEngine.setMuteForInactive(identifier: identifier, to: muted)
                logger.info("Set mute for inactive app \(identifier) to \(muted)")
            }
        }
    }

    /// Toggle mute state for apps
    /// URL format: finetune://toggle-mute?app=com.a&app=com.b
    private func handleToggleMute(queryItems: [URLQueryItem]) {
        let identifiers = queryItems
            .filter { $0.name.lowercased() == "app" }
            .compactMap { $0.value }

        guard !identifiers.isEmpty else {
            logger.error("toggle-mute: No app identifiers provided")
            return
        }

        for identifier in identifiers {
            if let app = findApp(by: identifier) {
                let current = audioEngine.getMute(for: app)
                audioEngine.setMute(for: app, to: !current)
                logger.info("Toggled mute for \(app.name) to \(!current)")
            } else {
                let current = audioEngine.getMuteForInactive(identifier: identifier)
                audioEngine.setMuteForInactive(identifier: identifier, to: !current)
                logger.info("Toggled mute for inactive app \(identifier) to \(!current)")
            }
        }
    }

    // MARK: - Other Actions

    /// Set output device for an app
    /// URL format: finetune://set-device?app=com.a&device=<deviceUID>
    private func handleSetDevice(queryItems: [URLQueryItem]) {
        guard let appIdentifier = queryItems.first(where: { $0.name == "app" })?.value else {
            logger.error("set-device: missing app parameter")
            return
        }

        guard let deviceUID = queryItems.first(where: { $0.name == "device" })?.value else {
            logger.error("set-device: missing device parameter")
            return
        }

        guard let app = findApp(by: appIdentifier) else {
            logger.warning("set-device: app not found '\(appIdentifier)'")
            return
        }

        audioEngine.setDevice(for: app, deviceUID: deviceUID)
        logger.info("Routed \(app.name) to device \(deviceUID)")
    }

    private func handleSetDeviceMode(queryItems: [URLQueryItem]) {
        guard let appIdentifier = value("app", in: queryItems) else {
            logger.error("set-device-mode: missing app parameter")
            return
        }
        guard let modeValue = value("mode", in: queryItems),
              let mode = DeviceSelectionMode(rawValue: modeValue.lowercased()) else {
            logger.error("set-device-mode: invalid mode parameter")
            return
        }

        let deviceUIDs = queryItems
            .filter { $0.name.lowercased() == "device" }
            .compactMap(\.value)
            .flatMap { $0.split(separator: ",").map { String($0) } }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        if let app = findApp(by: appIdentifier) {
            audioEngine.setDeviceSelectionMode(for: app, to: mode)
            if mode == .multi {
                audioEngine.setSelectedDeviceUIDs(for: app, to: Set(deviceUIDs))
            } else {
                audioEngine.setDevice(for: app, deviceUID: deviceUIDs.first)
            }
        } else {
            audioEngine.setDeviceSelectionModeForInactive(identifier: appIdentifier, to: mode)
            if mode == .multi {
                audioEngine.setSelectedDeviceUIDsForInactive(identifier: appIdentifier, to: Set(deviceUIDs))
            } else {
                audioEngine.setDeviceRoutingForInactive(identifier: appIdentifier, deviceUID: deviceUIDs.first)
            }
        }
    }

    private func handleSetAutoEQ(queryItems: [URLQueryItem]) {
        guard let deviceUID = value("device", in: queryItems) else {
            logger.error("set-autoeq: missing device parameter")
            return
        }

        if let profileID = value("profile", in: queryItems) {
            audioEngine.setAutoEQProfile(for: deviceUID, profileID: profileID == "none" ? nil : profileID)
        }
        if let enabledValue = value("enabled", in: queryItems),
           let enabled = parseBool(enabledValue) {
            audioEngine.setAutoEQEnabled(for: deviceUID, enabled: enabled)
        }
    }

    private func handleSetLoudness(queryItems: [URLQueryItem]) {
        guard let enabledValue = value("enabled", in: queryItems),
              let enabled = parseBool(enabledValue) else {
            logger.error("set-loudness: missing enabled parameter")
            return
        }
        audioEngine.setLoudnessCompensationEnabled(enabled)
        audioEngine.setLoudnessEqualizationEnabled(enabled)
        var appSettings = audioEngine.settingsManager.appSettings
        appSettings.setUnifiedLoudnessEnabled(enabled)
        audioEngine.settingsManager.updateAppSettings(appSettings)
    }

    private func handlePinApp(queryItems: [URLQueryItem]) {
        guard let identifier = value("app", in: queryItems) else {
            logger.error("pin-app: missing app parameter")
            return
        }
        audioEngine.pinApp(identifier: identifier, displayName: value("name", in: queryItems), bundleID: value("bundle", in: queryItems))
    }

    private func handleUnpinApp(queryItems: [URLQueryItem]) {
        guard let identifier = value("app", in: queryItems) else {
            logger.error("unpin-app: missing app parameter")
            return
        }
        audioEngine.unpinApp(identifier)
    }

    private func handleIgnoreApp(queryItems: [URLQueryItem]) {
        guard let identifier = value("app", in: queryItems) else {
            logger.error("ignore-app: missing app parameter")
            return
        }
        audioEngine.ignoreApp(identifier: identifier, displayName: value("name", in: queryItems), bundleID: value("bundle", in: queryItems))
    }

    private func handleUnignoreApp(queryItems: [URLQueryItem]) {
        guard let identifier = value("app", in: queryItems) else {
            logger.error("unignore-app: missing app parameter")
            return
        }
        audioEngine.unignoreApp(identifier)
    }

    /// Reset apps to 100% volume and unmute
    /// URL format: finetune://reset?app=com.a&app=com.b or finetune://reset (all apps)
    private func handleReset(queryItems: [URLQueryItem]) {
        let identifiers = queryItems
            .filter { $0.name.lowercased() == "app" }
            .compactMap { $0.value }

        if identifiers.isEmpty {
            // Reset all active apps to 100% and unmute
            let apps = audioEngine.apps
            for app in apps {
                audioEngine.setVolume(for: app, to: 1.0)
                audioEngine.setMute(for: app, to: false)
            }
            logger.info("Reset all \(apps.count) apps to 100% (unmuted)")
        } else {
            for identifier in identifiers {
                if let app = findApp(by: identifier) {
                    audioEngine.setVolume(for: app, to: 1.0)
                    audioEngine.setMute(for: app, to: false)
                    logger.info("Reset \(app.name) to 100% (unmuted)")
                } else {
                    audioEngine.setVolumeForInactive(identifier: identifier, to: 1.0)
                    audioEngine.setMuteForInactive(identifier: identifier, to: false)
                    logger.info("Reset inactive app \(identifier) to 100% (unmuted)")
                }
            }
        }
    }

    // MARK: - Helpers

    /// Find an app by bundle ID or persistence identifier
    private func findApp(by identifier: String) -> AudioApp? {
        audioEngine.apps.first { $0.persistenceIdentifier == identifier }
    }

    /// Parse boolean from string (supports true/false, 1/0, yes/no)
    private func parseBool(_ value: String) -> Bool? {
        switch value.lowercased() {
        case "true", "1", "yes": return true
        case "false", "0", "no": return false
        default: return nil
        }
    }

    private func value(_ name: String, in queryItems: [URLQueryItem]) -> String? {
        queryItems.first { $0.name.lowercased() == name.lowercased() }?.value
    }

    private func parseBoost(_ value: String) -> BoostLevel? {
        let normalized = value
            .lowercased()
            .replacingOccurrences(of: "x", with: "")
        guard let raw = Float(normalized) else { return nil }
        return BoostLevel(rawValue: raw)
    }

    private func parseEQPreset(_ value: String) -> EQPreset? {
        let normalized = value
            .lowercased()
            .filter { $0.isLetter || $0.isNumber }
        return EQPreset.allCases.first {
            $0.rawValue.lowercased().filter { $0.isLetter || $0.isNumber } == normalized ||
            $0.name.lowercased().filter { $0.isLetter || $0.isNumber } == normalized
        }
    }
}

extension URLHandler {
    /// Validate the whole command before any side effects, including every batch pair.
    package static func isValidCommand(_ url: URL) -> Bool {
        guard url.scheme == "graft", url.host == "audio", url.pathComponents.count == 2,
              url.user == nil, url.password == nil, url.port == nil, url.fragment == nil,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return false }
        let action = url.pathComponents[1]
        let items = components.queryItems ?? []
        func value(_ name: String) -> String? { items.first { $0.name.lowercased() == name }?.value }
        func nonempty(_ name: String) -> Bool { !(value(name)?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) }
        func boolean(_ name: String) -> Bool { ["true", "false", "1", "0", "yes", "no", "on", "off"].contains(value(name)?.lowercased() ?? "") }
        func batch(_ key: String, valid: (String) -> Bool) -> Bool {
            guard !items.isEmpty, items.count.isMultiple(of: 2) else { return false }
            for index in stride(from: 0, to: items.count, by: 2) {
                guard items[index].name.lowercased() == "app", !(items[index].value?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true),
                      items[index + 1].name.lowercased() == key, let argument = items[index + 1].value, valid(argument) else { return false }
            }
            return true
        }
        switch action {
        case "set-volumes": return batch("volume") { Int($0).map { (0...400).contains($0) } ?? false }
        case "set-mute": return batch("muted") { ["true", "false", "1", "0", "yes", "no", "on", "off"].contains($0.lowercased()) }
        case "step-volume": return nonempty("app") && ["up", "down"].contains(value("direction")?.lowercased() ?? "")
        case "set-boost": return nonempty("app") && ["1", "2", "3", "4", "1x", "2x", "3x", "4x"].contains(value("boost")?.lowercased() ?? "")
        case "set-eq":
            guard nonempty("app"), value("enabled") == nil || boolean("enabled") else { return false }
            if let preset = value("preset") {
                let normalize: (String) -> String = { $0.lowercased().filter { $0.isLetter || $0.isNumber } }
                return EQPreset.allCases.contains { normalize($0.rawValue) == normalize(preset) || normalize($0.name) == normalize(preset) }
            }
            let gains = value("gains")?.split(separator: ",", omittingEmptySubsequences: false).compactMap { Float($0.trimmingCharacters(in: .whitespaces)) } ?? []
            return gains.count == 10 && gains.allSatisfy { $0.isFinite && (-12...12).contains($0) }
        case "set-device": return nonempty("app") && nonempty("device")
        case "set-device-mode": return nonempty("app") && ["single", "multi"].contains(value("mode") ?? "") && (value("mode") != "multi" || nonempty("device"))
        case "set-autoeq": return nonempty("device") && (nonempty("profile") || boolean("enabled")) && (value("enabled") == nil || boolean("enabled"))
        case "set-loudness": return boolean("enabled")
        case "pin-app", "unpin-app", "ignore-app", "unignore-app": return nonempty("app")
        case "toggle-mute": return !items.isEmpty && items.allSatisfy { $0.name == "app" && !($0.value?.isEmpty ?? true) }
        case "reset": return items.isEmpty
        default: return false
        }
    }
}
