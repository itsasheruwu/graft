import Darwin
import Foundation

/// The sidecar lock stays at a stable inode while atomic state-file replacement
/// prevents readers from observing half-written JSON. Never lock the JSON inode.
public struct GraftStateRepository: Sendable {
    public let fileURL: URL
    private static let threadLock = NSLock()

    public init(fileURL: URL) { self.fileURL = fileURL }

    public func read() throws -> GraftSharedState {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(GraftSharedState.self, from: Data(contentsOf: fileURL))
        } catch CocoaError.fileReadNoSuchFile { return GraftSharedState() }
    }

    @discardableResult
    public func update(_ mutation: (inout GraftSharedState) throws -> Void) throws -> GraftSharedState {
        Self.threadLock.lock()
        defer { Self.threadLock.unlock() }
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let descriptor = open(fileURL.path + ".lock", O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
        defer { close(descriptor) }
        while flock(descriptor, LOCK_EX) != 0 {
            guard errno == EINTR else { throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO) }
        }
        defer { flock(descriptor, LOCK_UN) }
        var state = try read()
        let before = state
        try mutation(&state)
        guard state != before || !FileManager.default.fileExists(atPath: fileURL.path) else { return state }
        state.revision = before.revision + 1
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(state).write(to: fileURL, options: .atomic)
        return state
    }
}

public extension GraftSharedState {
    mutating func mergeMacSettings(_ proposed: MacSettings, baseline: MacSettings) throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let previous = try decoder.decode([String: JSONValue].self, from: encoder.encode(baseline))
        let changed = try decoder.decode([String: JSONValue].self, from: encoder.encode(proposed))
        var latest = try decoder.decode([String: JSONValue].self, from: encoder.encode(macSettings))
        for key in Set(previous.keys).union(changed.keys) where previous[key] != changed[key] {
            latest[key] = changed[key]
        }
        macSettings = try decoder.decode(MacSettings.self, from: encoder.encode(latest))
    }

    mutating func setBrowserValue(_ value: JSONValue, for key: String) {
        browserSettings[key] = value
        pendingBrowserChanges[key] = value
        browserChangeTokens[key] = UUID().uuidString
        browserSettingVersions[key] = revision + 1
    }

    mutating func receiveBrowserSnapshot(
        _ settings: [String: JSONValue],
        acknowledgements: [String: String] = [:],
        baseRevision: Int? = nil,
        at date: Date = Date()
    ) {
        for (key, value) in settings {
            if let pending = pendingBrowserChanges[key] {
                // Value equality alone cannot acknowledge true → false → true.
                // Legacy hosts without tokens can finish their pre-upgrade queue.
                let acknowledged = browserChangeTokens[key].map { acknowledgements[key] == $0 } ?? true
                if value == pending && acknowledged {
                    pendingBrowserChanges.removeValue(forKey: key)
                }
                continue
            }
            if let baseRevision, baseRevision < (browserSettingVersions[key] ?? 0) { continue }
            browserSettings[key] = value
        }
        extensionSeenAt = date
    }
}
