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
}

nonisolated struct SpotifyCommandResult: Equatable, Sendable {
    let status: Int32
    let output: String
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

    let bridgeToken: String

    @ObservationIgnored private let fileManager: FileManager
    @ObservationIgnored private let homeDirectory: URL
    @ObservationIgnored private let resourceURL: URL?

    init(
        fileManager: FileManager = .default,
        homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser,
        resourceURL: URL? = Bundle.main.url(
            forResource: "graft-spotify-bridge",
            withExtension: "js"
        ),
        bridgeToken: String? = nil
    ) {
        self.fileManager = fileManager
        self.homeDirectory = homeDirectory
        self.resourceURL = resourceURL
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

    func installOrRepair() async {
        guard !isBusy else { return }
        isBusy = true
        defer {
            isBusy = false
            refresh()
        }
        do {
            guard isSpotifyInstalled else { throw SpotifyIntegrationError.spotifyMissing }
            guard let spicetifyURL else { throw SpotifyIntegrationError.spicetifyMissing }
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
            actionMessage = "Spotify Friend Watcher is installed. Keep Spotify open while watching friends."
        } catch {
            actionMessage = error.localizedDescription
        }
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
            let pipe = Pipe()
            process.executableURL = executable
            process.arguments = arguments
            process.standardOutput = pipe
            process.standardError = pipe
            do {
                try process.run()
                process.waitUntilExit()
                let output = String(
                    data: pipe.fileHandleForReading.readDataToEndOfFile(),
                    encoding: .utf8
                ) ?? ""
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
