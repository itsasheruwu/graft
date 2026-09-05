import AppKit
import Foundation

enum NativeHostInstallerError: LocalizedError, Equatable {
    case invalidExtensionID
    case missingHost
    case chromeNotInstalled

    var errorDescription: String? {
        switch self {
        case .invalidExtensionID: "Enter the 32-character extension ID shown on chrome://extensions."
        case .missingHost: "The native bridge is missing from this Graft app build."
        case .chromeNotInstalled: "Google Chrome is not installed in Applications."
        }
    }
}

enum NativeHostInstaller {
    static let hostName = "com.itsasheruwu.graft"

    /// Chrome's native messaging host manifest.
    private struct HostManifest: Encodable {
        let name: String
        let description: String
        let path: String
        let type: String
        let allowedOrigins: [String]

        enum CodingKeys: String, CodingKey {
            case name, description, path, type
            case allowedOrigins = "allowed_origins"
        }
    }

    static func install(extensionID: String) throws {
        let id = extensionID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isValidExtensionID(id) else {
            throw NativeHostInstallerError.invalidExtensionID
        }

        let hostURL = Bundle.main.bundleURL
            .appendingPathComponent("Contents/Helpers/GraftNativeHost")
        let hostPath = hostURL.path(percentEncoded: false)
        guard FileManager.default.isExecutableFile(atPath: hostPath) else {
            throw NativeHostInstallerError.missingHost
        }

        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Google/Chrome/NativeMessagingHosts", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let manifest = HostManifest(
            name: hostName,
            description: "Connects the Graft extension to the Graft macOS app.",
            path: hostPath,
            type: "stdio",
            allowedOrigins: ["chrome-extension://\(id)/"]
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(manifest)
        try data.write(to: directory.appendingPathComponent("\(hostName).json"), options: .atomic)
    }

    static func openChromeExtensions() throws {
        guard let chromeURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.google.Chrome") else {
            throw NativeHostInstallerError.chromeNotInstalled
        }
        guard let extensionsURL = URL(string: "chrome://extensions") else { return }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = true
        NSWorkspace.shared.open([extensionsURL], withApplicationAt: chromeURL, configuration: configuration)
    }

    /// Chrome extension IDs are 32 characters drawn from `a`–`p`.
    static func isValidExtensionID(_ extensionID: String) -> Bool {
        extensionID.trimmingCharacters(in: .whitespacesAndNewlines)
            .wholeMatch(of: /[a-p]{32}/) != nil
    }
}
