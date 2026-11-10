import AppKit
import Foundation
import GraftCore
import Observation

nonisolated enum SpotifyIntegrationStatus: Equatable, Sendable {
    case spotifyNotInstalled
    case spotifyClosed
    case spicetifyMissing
    case setupRequired
    case waitingForBridge
    case connected
    case repairRequired(String)
    case unsupported(String)

    var title: String {
        switch self {
        case .spotifyNotInstalled: "Spotify not installed"
        case .spotifyClosed: "Open Spotify"
        case .spicetifyMissing: "Spicetify required"
        case .setupRequired: "Setup required"
        case .waitingForBridge: "Waiting for Spotify"
        case .connected: "Connected"
        case .repairRequired: "Repair required"
        case .unsupported: "Unsupported"
        }
    }

    var detail: String {
        switch self {
        case .repairRequired(let reason), .unsupported(let reason): reason
        default: title
        }
    }
}

nonisolated struct SpotifyCommandResult: Equatable, Sendable {
    let status: Int32
    let output: String
}

nonisolated enum SpotifyAutoRepairAction: Equatable, Sendable {
    case repair
    case maintenance
}

nonisolated enum SpotifyIntegrationError: LocalizedError {
    case spotifyMissing
    case spicetifyMissing
    case bridgeResourceMissing
    case commandFailed(String)
    case tokenStorage(String)

    var errorDescription: String? {
        switch self {
        case .spotifyMissing: "Install the Spotify macOS app before setting up Friend Watcher."
        case .spicetifyMissing: "Spicetify is required to read the friend activity already shown in Spotify."
        case .bridgeResourceMissing: "Graft's Spotify bridge is missing from this app build."
        case .commandFailed(let output): output.isEmpty ? "Spicetify could not apply the bridge." : output
        case .tokenStorage(let detail): "Graft could not save its Spotify bridge key: \(detail)"
        }
    }
}

@MainActor
@Observable
final class SpotifyIntegrationService {
    nonisolated static let bridgeFilename = "graft-spotify-bridge.js"
    nonisolated static let bridgeVersion = "3"

    private(set) var isSpotifyInstalled = false
    private(set) var isSpotifyRunning = false
    private(set) var spicetifyURL: URL?
    private(set) var bridgeFileInstalled = false
    private(set) var bridgeConfigured = false
    private(set) var isBusy = false
    private(set) var actionMessage: String?

    var autoRepairEnabled: Bool {
        didSet { UserDefaults.standard.set(autoRepairEnabled, forKey: "spotifyAutoRepairEnabled") }
    }
    private(set) var autoRepairMessage: String?
    @ObservationIgnored private var repairPolicy = SpotifyAutoRepairPolicy()
    @ObservationIgnored private var cachedInterfaceHealth = false
    @ObservationIgnored private var lastInterfaceHealthCheckAt: Date?

    let bridgeToken: String

    @ObservationIgnored private let fileManager: FileManager
    @ObservationIgnored private let homeDirectory: URL
    @ObservationIgnored private let resourceURL: URL?
    @ObservationIgnored private let activity: GraftActivityStore?

    init(
        fileManager: FileManager = .default,
        homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser,
        resourceURL: URL? = Bundle.main.url(
            forResource: "graft-spotify-bridge",
            withExtension: "js"
        ),
        bridgeToken: String? = nil,
        activity: GraftActivityStore? = nil
    ) {
        self.autoRepairEnabled = UserDefaults.standard.bool(forKey: "spotifyAutoRepairEnabled")
        self.fileManager = fileManager
        self.homeDirectory = homeDirectory
        self.resourceURL = resourceURL
        self.activity = activity
        self.bridgeToken = bridgeToken ?? (
            try? Self.loadOrCreateBridgeToken(
                fileManager: fileManager,
                fileURL: GraftStateFile.directoryURL.appendingPathComponent("spotify-bridge-token")
            )
        ) ?? UUID().uuidString
        refresh()
    }

    var bridgeFileURL: URL {
        homeDirectory
            .appendingPathComponent(".spicetify", isDirectory: true)
            .appendingPathComponent("Extensions", isDirectory: true)
            .appendingPathComponent(Self.bridgeFilename)
    }

    var configFileURL: URL {
        homeDirectory
            .appendingPathComponent(".config", isDirectory: true)
            .appendingPathComponent("spicetify", isDirectory: true)
            .appendingPathComponent("config-xpui.ini")
    }

    func status(bridgeServer: SpotifyBridgeServer) -> SpotifyIntegrationStatus {
        guard isSpotifyInstalled else { return .spotifyNotInstalled }
        guard isSpotifyRunning else { return .spotifyClosed }
        guard spicetifyURL != nil else { return .spicetifyMissing }
        guard bridgeFileInstalled, bridgeConfigured else { return .setupRequired }
        if let receivedVersion = bridgeServer.bridgeVersion,
           receivedVersion != Self.bridgeVersion {
            return .repairRequired("Graft's Spotify bridge is out of date.")
        }
        if let error = bridgeServer.lastError {
            return bridgeServer.lastHeartbeatAt == nil ? .repairRequired(error) : .unsupported(error)
        }
        guard let heartbeat = bridgeServer.lastHeartbeatAt,
              Date().timeIntervalSince(heartbeat) < SpotifyFriendPresenceLogic.bridgeFreshness else {
            return .waitingForBridge
        }
        return .connected
    }

    func refresh() {
        isSpotifyInstalled = NSWorkspace.shared.urlForApplication(
            withBundleIdentifier: "com.spotify.client"
        ) != nil
        isSpotifyRunning = !NSRunningApplication.runningApplications(
            withBundleIdentifier: "com.spotify.client"
        ).isEmpty
        spicetifyURL = Self.findSpicetify(homeDirectory: homeDirectory, fileManager: fileManager)
        bridgeFileInstalled = fileManager.fileExists(atPath: bridgeFileURL.path)
        bridgeConfigured = Self.configContainsBridge(
            (try? String(contentsOf: configFileURL, encoding: .utf8)) ?? ""
        )
    }

    func checkAutoRepair(watcherEnabled: Bool, bridgeServer: SpotifyBridgeServer) {
        let now = Date()
        guard let action = repairPolicy.nextAction(
            enabled: autoRepairEnabled && watcherEnabled,
            eligible: isSpotifyRunning && bridgeConfigured && bridgeFileInstalled && spicetifyURL != nil,
            status: status(bridgeServer: bridgeServer),
            interfaceHealthy: spotifyInterfaceAssetsHealthy(at: now),
            busy: isBusy,
            now: now
        ) else { return }
        Task {
            switch action {
            case .repair:
                await installOrRepair(automatically: true)
            case .maintenance:
                await performAutomaticMaintenance()
            }
        }
    }

    func installOrRepair(automatically: Bool = false) async {
        guard !isBusy else { return }
        isBusy = true
        activity?.record(.spotify, .info, "Spotify repair started", automatically ? "Automatic repair is applying the Spotify bridge." : "Applying the Spotify bridge.")
        repairPolicy.recordAttempt(at: Date())
        if automatically { autoRepairMessage = "Repairing Spotify connection…" }
        defer {
            isBusy = false
            refresh()
        }
        do {
            guard isSpotifyInstalled else { throw SpotifyIntegrationError.spotifyMissing }
            guard let spicetifyURL else { throw SpotifyIntegrationError.spicetifyMissing }
            var updateWarning: String?
            if automatically {
                autoRepairMessage = "Updating Spicetify and repairing Spotify controls…"
                let updateResult = await Self.run(spicetifyURL, arguments: ["upgrade"])
                if updateResult.status != 0 { updateWarning = updateResult.output }
            }
            try await applyBridge(using: spicetifyURL)
            if automatically {
                autoRepairMessage = updateWarning == nil
                    ? "Repair applied. Waiting for Spotify to reconnect."
                    : "Repair applied. The Spicetify update check will retry later."
            } else {
                actionMessage = "Spotify Friend Watcher is installed. Keep Spotify open while watching friends."
            }
            try await reopenSpotifyAfterApply()
            activity?.record(.spotify, .success, "Spotify repair applied", "Waiting for a fresh Spotify heartbeat to confirm reconnection.", retry: .checkSpotify)
        } catch {
            activity?.record(.spotify, .failure, "Spotify repair failed", error.localizedDescription, retry: .repairSpotify)
            if automatically {
                autoRepairMessage = "Automatic repair failed: \(error.localizedDescription)"
            } else {
                actionMessage = error.localizedDescription
            }
        }
    }

    private func performAutomaticMaintenance() async {
        guard !isBusy else { return }
        isBusy = true
        activity?.record(.spotify, .info, "Spotify maintenance started", "Checking Spicetify and Spotify controls.")
        autoRepairMessage = "Checking Spicetify and Spotify controls…"
        defer {
            isBusy = false
            refresh()
        }
        do {
            guard isSpotifyInstalled else { throw SpotifyIntegrationError.spotifyMissing }
            guard let spicetifyURL else { throw SpotifyIntegrationError.spicetifyMissing }
            let versionBefore = await Self.installedSpicetifyVersion(at: spicetifyURL)
            let updateResult = await Self.run(spicetifyURL, arguments: ["upgrade"])
            guard updateResult.status == 0 else {
                throw SpotifyIntegrationError.commandFailed(updateResult.output)
            }
            let versionAfter = await Self.installedSpicetifyVersion(at: spicetifyURL)
            let updated = versionBefore != nil && versionAfter != nil && versionBefore != versionAfter
            let interfaceHealthy = spotifyInterfaceAssetsHealthy(at: Date(), force: true)
            guard updated || !interfaceHealthy else {
                autoRepairMessage = nil
                activity?.record(.spotify, .success, "Spotify maintenance finished", "Spicetify and Spotify controls are up to date.")
                return
            }
            autoRepairMessage = updated
                ? "Spicetify updated. Refreshing Spotify controls…"
                : "Refreshing Spotify icons and controls…"
            try await applyBridge(using: spicetifyURL)
            try await reopenSpotifyAfterApply()
            autoRepairMessage = "Spotify controls refreshed. Waiting for the connection…"
            activity?.record(.spotify, .success, "Spotify maintenance applied", "Controls refreshed; waiting for reconnection.", retry: .checkSpotify)
        } catch {
            activity?.record(.spotify, .failure, "Spotify maintenance failed", error.localizedDescription, retry: .repairSpotify)
            repairPolicy.recordMaintenanceFailure(at: Date())
            autoRepairMessage = "Automatic maintenance failed: \(error.localizedDescription)"
        }
    }

    private func applyBridge(using spicetifyURL: URL) async throws {
        guard let resourceURL,
              let template = try? String(contentsOf: resourceURL, encoding: .utf8) else {
            throw SpotifyIntegrationError.bridgeResourceMissing
        }
        let rendered = Self.renderBridge(
            template,
            token: bridgeToken,
            port: SpotifyBridgeServer.port
        )
        try fileManager.createDirectory(
            at: bridgeFileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try rendered.write(to: bridgeFileURL, atomically: true, encoding: .utf8)

        if !bridgeConfigured {
            let configurationResult = await Self.run(spicetifyURL, arguments: [
                "config", "extensions", Self.bridgeFilename,
            ])
            guard configurationResult.status == 0 else {
                throw SpotifyIntegrationError.commandFailed(configurationResult.output)
            }
        }
        var result = await Self.run(spicetifyURL, arguments: ["apply"])
        if result.status != 0, Self.requiresBackupRefresh(result.output) {
            result = await Self.run(spicetifyURL, arguments: ["backup", "apply"])
        }
        guard result.status == 0 else { throw SpotifyIntegrationError.commandFailed(result.output) }
        _ = spotifyInterfaceAssetsHealthy(at: Date(), force: true)
    }

    private func reopenSpotifyAfterApply() async throws {
        // Spicetify can return before Spotify has finished quitting.
        try await Task.sleep(for: .seconds(2))
        guard let url = NSWorkspace.shared.urlForApplication(
            withBundleIdentifier: "com.spotify.client"
        ) else { throw SpotifyIntegrationError.spotifyMissing }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = false
        _ = try await NSWorkspace.shared.openApplication(at: url, configuration: configuration)
    }

    private func spotifyInterfaceAssetsHealthy(at now: Date, force: Bool = false) -> Bool {
        if !force,
           let lastInterfaceHealthCheckAt,
           now.timeIntervalSince(lastInterfaceHealthCheckAt) < 60 {
            return cachedInterfaceHealth
        }
        lastInterfaceHealthCheckAt = now
        guard let spotifyURL = NSWorkspace.shared.urlForApplication(
            withBundleIdentifier: "com.spotify.client"
        ) else {
            cachedInterfaceHealth = false
            return false
        }
        let xpuiURL = spotifyURL
            .appendingPathComponent("Contents/Resources/Apps/xpui", isDirectory: true)
        let indexHTML = (try? String(
            contentsOf: xpuiURL.appendingPathComponent("index.html"),
            encoding: .utf8
        )) ?? ""
        let wrapperScript = (try? String(
            contentsOf: xpuiURL.appendingPathComponent("helper/spicetifyWrapper.js"),
            encoding: .utf8
        )) ?? ""
        let info = NSDictionary(
            contentsOf: spotifyURL.appendingPathComponent("Contents/Info.plist")
        )
        let spotifyVersion = info?["CFBundleShortVersionString"] as? String
        let config = (try? String(contentsOf: configFileURL, encoding: .utf8)) ?? ""
        cachedInterfaceHealth = Self.interfaceAssetsHealthy(
            indexHTML: indexHTML,
            wrapperScript: wrapperScript,
            config: config,
            spotifyVersion: spotifyVersion
        )
        return cachedInterfaceHealth
    }

    func removeBridge() async {
        guard !isBusy else { return }
        isBusy = true
        defer {
            isBusy = false
            refresh()
        }
        do {
            guard let spicetifyURL else { throw SpotifyIntegrationError.spicetifyMissing }
            var result = await Self.run(spicetifyURL, arguments: [
                "config", "extensions", "\(Self.bridgeFilename)-",
            ])
            guard result.status == 0 else { throw SpotifyIntegrationError.commandFailed(result.output) }
            if fileManager.fileExists(atPath: bridgeFileURL.path) {
                try fileManager.removeItem(at: bridgeFileURL)
            }
            result = await Self.run(spicetifyURL, arguments: ["apply"])
            guard result.status == 0 else { throw SpotifyIntegrationError.commandFailed(result.output) }
            actionMessage = "Graft's Spotify bridge was removed. Other Spicetify customizations were kept."
        } catch {
            actionMessage = error.localizedDescription
        }
    }

    func clearActionMessage() { actionMessage = nil }

    nonisolated static func configContainsBridge(_ config: String) -> Bool {
        for rawLine in config.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            guard !line.hasPrefix(";") && !line.hasPrefix("#"),
                  let equals = line.firstIndex(of: "=") else { continue }
            let key = line[..<equals].trimmingCharacters(in: .whitespaces).lowercased()
            guard key == "extensions" else { continue }
            let values = line[line.index(after: equals)...]
                .split(whereSeparator: { $0 == "|" || $0 == "," || $0.isWhitespace })
                .map(String.init)
            if values.contains(Self.bridgeFilename) { return true }
        }
        return false
    }

    nonisolated static func renderBridge(_ template: String, token: String, port: UInt16) -> String {
        template
            .replacingOccurrences(of: "__GRAFT_BRIDGE_TOKEN__", with: token)
            .replacingOccurrences(of: "__GRAFT_BRIDGE_PORT__", with: String(port))
    }

    nonisolated static func requiresBackupRefresh(_ output: String) -> Bool {
        let value = output.lowercased()
        return (value.contains("backup") || value.contains("backed up")) && (
            value.contains("version")
                || value.contains("outdated")
                || value.contains("spotify is not backed up")
        )
    }

    nonisolated static func interfaceAssetsHealthy(
        indexHTML: String,
        wrapperScript: String,
        config: String,
        spotifyVersion: String?
    ) -> Bool {
        guard indexHTML.contains("helper/spicetifyWrapper.js"),
              indexHTML.contains(bridgeFilename),
              wrapperScript.contains("Spicetify.SVGIcons"),
              wrapperScript.contains("main-globalNav-buddyFeed") else { return false }
        if let spotifyVersion {
            guard let configuredVersion = configValue(named: "version", in: config),
                  configuredVersion.hasPrefix(spotifyVersion) else { return false }
        }
        return true
    }

    nonisolated static func configValue(named requestedKey: String, in config: String) -> String? {
        for rawLine in config.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            guard !line.hasPrefix(";") && !line.hasPrefix("#"),
                  let equals = line.firstIndex(of: "=") else { continue }
            let key = line[..<equals].trimmingCharacters(in: .whitespaces).lowercased()
            guard key == requestedKey.lowercased() else { continue }
            return line[line.index(after: equals)...]
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return nil
    }

    nonisolated static func installedSpicetifyVersion(at executable: URL) async -> String? {
        let result = await run(executable, arguments: ["-v"])
        guard result.status == 0 else { return nil }
        return result.output
            .split(whereSeparator: { $0.isWhitespace })
            .map(String.init)
            .first { value in
                let pieces = value.split(separator: ".")
                return pieces.count >= 3 && pieces.allSatisfy { piece in
                    !piece.isEmpty && piece.allSatisfy(\.isNumber)
                }
            }
    }

    nonisolated static func findSpicetify(homeDirectory: URL, fileManager: FileManager) -> URL? {
        let candidates = [
            homeDirectory.appendingPathComponent(".spicetify/spicetify"),
            URL(fileURLWithPath: "/opt/homebrew/bin/spicetify"),
            URL(fileURLWithPath: "/usr/local/bin/spicetify"),
        ]
        return candidates.first { fileManager.isExecutableFile(atPath: $0.path) }
    }

    nonisolated static func run(_ executable: URL, arguments: [String]) async -> SpotifyCommandResult {
        await Task.detached(priority: .userInitiated) {
            let process = Process()
            let outputURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            FileManager.default.createFile(atPath: outputURL.path, contents: nil)
            defer { try? FileManager.default.removeItem(at: outputURL) }
            process.executableURL = executable
            process.arguments = arguments
            do {
                let outputHandle = try FileHandle(forWritingTo: outputURL)
                defer { try? outputHandle.close() }
                process.standardOutput = outputHandle
                process.standardError = outputHandle
                try process.run()
                let deadline = Date().addingTimeInterval(120)
                while process.isRunning && Date() < deadline {
                    try await Task.sleep(for: .milliseconds(100))
                }
                if process.isRunning {
                    process.terminate()
                    return SpotifyCommandResult(status: -1, output: "Spotify repair timed out. Try Repair again.")
                }
                process.waitUntilExit()
                let output = (try? String(contentsOf: outputURL, encoding: .utf8)) ?? ""
                return SpotifyCommandResult(
                    status: process.terminationStatus,
                    output: output.trimmingCharacters(in: .whitespacesAndNewlines)
                )
            } catch {
                return SpotifyCommandResult(status: -1, output: error.localizedDescription)
            }
        }.value
    }

    nonisolated static func loadOrCreateBridgeToken(
        fileManager: FileManager,
        fileURL: URL
    ) throws -> String {
        if let data = try? Data(contentsOf: fileURL),
           let decoded = String(data: data, encoding: .utf8) {
            let token = decoded.trimmingCharacters(in: .whitespacesAndNewlines)
            if !token.isEmpty { return token }
        }
        let token = UUID().uuidString.replacingOccurrences(of: "-", with: "")
            + UUID().uuidString.replacingOccurrences(of: "-", with: "")
        do {
            try fileManager.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try Data(token.utf8).write(to: fileURL, options: .atomic)
            try fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: fileURL.path)
            return token
        } catch {
            throw SpotifyIntegrationError.tokenStorage(error.localizedDescription)
        }
    }
}

// A fresh connection resets the grace period, but never bypasses the retry cooldown.
nonisolated struct SpotifyAutoRepairPolicy {
    var disconnectedSince: Date?
    var lastAttemptAt: Date?
    var lastMaintenanceCheckAt: Date?

    private let gracePeriod: TimeInterval = 90
    private let repairCooldown: TimeInterval = 30 * 60
    private let maintenanceInterval: TimeInterval = 24 * 60 * 60
    private let maintenanceFailureRetry: TimeInterval = 6 * 60 * 60

    mutating func recordAttempt(at now: Date) {
        lastAttemptAt = now
        disconnectedSince = nil
    }

    mutating func recordMaintenanceFailure(at now: Date) {
        lastMaintenanceCheckAt = now.addingTimeInterval(-(maintenanceInterval - maintenanceFailureRetry))
    }

    mutating func nextAction(
        enabled: Bool,
        eligible: Bool,
        status: SpotifyIntegrationStatus,
        interfaceHealthy: Bool,
        busy: Bool,
        now: Date
    ) -> SpotifyAutoRepairAction? {
        guard enabled, eligible else { disconnectedSince = nil; return nil }
        guard !busy else { return nil }
        let connectionNeedsRepair: Bool
        switch status {
        case .waitingForBridge, .repairRequired: connectionNeedsRepair = true
        default: connectionNeedsRepair = false
        }
        if connectionNeedsRepair || !interfaceHealthy {
            guard let since = disconnectedSince else {
                disconnectedSince = now
                return nil
            }
            guard now.timeIntervalSince(since) >= gracePeriod,
                  lastAttemptAt.map({ now.timeIntervalSince($0) >= repairCooldown }) ?? true else {
                return nil
            }
            recordAttempt(at: now)
            return .repair
        }
        disconnectedSince = nil
        guard status == .connected,
              lastMaintenanceCheckAt.map({ now.timeIntervalSince($0) >= maintenanceInterval }) ?? true else {
            return nil
        }
        lastMaintenanceCheckAt = now
        return .maintenance
    }
}
