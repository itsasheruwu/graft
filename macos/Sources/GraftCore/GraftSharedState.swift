import Foundation

public enum JSONValue: Codable, Equatable, Sendable {
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([JSONValue].self) { self = .array(value) }
        else { self = .object(try container.decode([String: JSONValue].self)) }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .bool(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    public var boolValue: Bool? { if case .bool(let value) = self { value } else { nil } }
    public var numberValue: Double? { if case .number(let value) = self { value } else { nil } }
    public var stringValue: String? { if case .string(let value) = self { value } else { nil } }
}

public enum KeepAwakeMode: String, Codable, CaseIterable, Sendable {
    case untilTurnedOff, thirtyMinutes, twoHours, untilAppQuits

    public var title: String {
        switch self {
        case .untilTurnedOff: "Until turned off"
        case .thirtyMinutes: "30 minutes"
        case .twoHours: "2 hours"
        case .untilAppQuits: "Until an app quits"
        }
    }

    public var duration: TimeInterval? {
        switch self {
        case .thirtyMinutes: 30 * 60
        case .twoHours: 2 * 60 * 60
        default: nil
        }
    }
}

public struct MacSettings: Codable, Equatable, Sendable {
    public var keepAwake = false
    public var keepAwakeMode: KeepAwakeMode = .untilTurnedOff
    public var keepAwakeDeadline: Date?
    public var keepAwakeAppBundleID = ""
    public var keepAwakeAppPID: Int32?
    public var keepAwakeAppLaunchDate: Date?
    public var floatGraftWindow = false
    public var showHiddenFinderFiles = false
    public var hideDesktopIcons = false
    public var robloxWatcherTimeSensitive = false
    public var robloxWatcherNotificationSoundEnabled = true
    public var codexAutoUseResetsEnabled = false
    public var dmgAutoInstallEnabled = false
    public var dmgAutoInstallTrashAfterSuccess = false
    public var spotifyWatcherEnabled = false
    public var spotifyWatcherNotifyStarted = true
    public var spotifyWatcherNotifyTrackChanges = true
    public var spotifyWatcherNotifyStopped = true
    public var spotifyWatcherTimeSensitive = false
    public var spotifyWatcherNotificationSoundEnabled = true
    public var spotifyWatcherWhitelist: [String] = []

    public init() {}

    private enum CodingKeys: String, CodingKey {
        case keepAwake
        case keepAwakeMode, keepAwakeDeadline, keepAwakeAppBundleID, keepAwakeAppPID, keepAwakeAppLaunchDate
        case floatGraftWindow
        case showHiddenFinderFiles
        case hideDesktopIcons
        case robloxWatcherTimeSensitive
        case robloxWatcherNotificationSoundEnabled
        case codexAutoUseResetsEnabled
        case dmgAutoInstallEnabled
        case dmgAutoInstallTrashAfterSuccess
        case spotifyWatcherEnabled
        case spotifyWatcherNotifyStarted
        case spotifyWatcherNotifyTrackChanges
        case spotifyWatcherNotifyStopped
        case spotifyWatcherTimeSensitive
        case spotifyWatcherNotificationSoundEnabled
        case spotifyWatcherWhitelist
    }

    public init(from decoder: Decoder) throws {
        self.init()
        let container = try decoder.container(keyedBy: CodingKeys.self)
        keepAwake = try container.decodeIfPresent(Bool.self, forKey: .keepAwake) ?? false
        keepAwakeMode = try container.decodeIfPresent(KeepAwakeMode.self, forKey: .keepAwakeMode) ?? .untilTurnedOff
        keepAwakeDeadline = try container.decodeIfPresent(Date.self, forKey: .keepAwakeDeadline)
        keepAwakeAppBundleID = try container.decodeIfPresent(String.self, forKey: .keepAwakeAppBundleID) ?? ""
        keepAwakeAppPID = try container.decodeIfPresent(Int32.self, forKey: .keepAwakeAppPID)
        keepAwakeAppLaunchDate = try container.decodeIfPresent(Date.self, forKey: .keepAwakeAppLaunchDate)
        floatGraftWindow = try container.decodeIfPresent(Bool.self, forKey: .floatGraftWindow) ?? false
        showHiddenFinderFiles = try container.decodeIfPresent(Bool.self, forKey: .showHiddenFinderFiles) ?? false
        hideDesktopIcons = try container.decodeIfPresent(Bool.self, forKey: .hideDesktopIcons) ?? false
        robloxWatcherTimeSensitive = try container.decodeIfPresent(
            Bool.self,
            forKey: .robloxWatcherTimeSensitive
        ) ?? false
        robloxWatcherNotificationSoundEnabled = try container.decodeIfPresent(
            Bool.self,
            forKey: .robloxWatcherNotificationSoundEnabled
        ) ?? true
        codexAutoUseResetsEnabled = try container.decodeIfPresent(Bool.self, forKey: .codexAutoUseResetsEnabled) ?? false
        dmgAutoInstallEnabled = try container.decodeIfPresent(Bool.self, forKey: .dmgAutoInstallEnabled) ?? false
        dmgAutoInstallTrashAfterSuccess = try container.decodeIfPresent(Bool.self, forKey: .dmgAutoInstallTrashAfterSuccess) ?? false
        spotifyWatcherEnabled = try container.decodeIfPresent(
            Bool.self,
            forKey: .spotifyWatcherEnabled
        ) ?? false
        spotifyWatcherNotifyStarted = try container.decodeIfPresent(
            Bool.self,
            forKey: .spotifyWatcherNotifyStarted
        ) ?? true
        spotifyWatcherNotifyTrackChanges = try container.decodeIfPresent(
            Bool.self,
            forKey: .spotifyWatcherNotifyTrackChanges
        ) ?? true
        spotifyWatcherNotifyStopped = try container.decodeIfPresent(
            Bool.self,
            forKey: .spotifyWatcherNotifyStopped
        ) ?? true
        spotifyWatcherTimeSensitive = try container.decodeIfPresent(
            Bool.self,
            forKey: .spotifyWatcherTimeSensitive
        ) ?? false
        spotifyWatcherNotificationSoundEnabled = try container.decodeIfPresent(
            Bool.self,
            forKey: .spotifyWatcherNotificationSoundEnabled
        ) ?? true
        spotifyWatcherWhitelist = try container.decodeIfPresent(
            [String].self,
            forKey: .spotifyWatcherWhitelist
        ) ?? []
    }
}

public struct GraftSharedState: Codable, Equatable, Sendable {
    public var revision = 0
    public var browserSettings: [String: JSONValue] = [:]
    public var pendingBrowserChanges: [String: JSONValue] = [:]
    public var browserChangeTokens: [String: String] = [:]
    public var browserSettingVersions: [String: Int] = [:]
    public var macSettings = MacSettings()
    public var extensionSeenAt: Date?

    public init() {}

    private enum CodingKeys: String, CodingKey {
        case revision, browserSettings, pendingBrowserChanges, macSettings, extensionSeenAt
        case browserChangeTokens, browserSettingVersions
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        revision = try c.decode(Int.self, forKey: .revision)
        browserSettings = try c.decode([String: JSONValue].self, forKey: .browserSettings)
        pendingBrowserChanges = try c.decode([String: JSONValue].self, forKey: .pendingBrowserChanges)
        macSettings = try c.decode(MacSettings.self, forKey: .macSettings)
        extensionSeenAt = try c.decodeIfPresent(Date.self, forKey: .extensionSeenAt)
        browserChangeTokens = try c.decodeIfPresent([String: String].self, forKey: .browserChangeTokens) ?? [:]
        browserSettingVersions = try c.decodeIfPresent([String: Int].self, forKey: .browserSettingVersions) ?? [:]
    }
}

public struct GraftCompanionPresence: Codable, Equatable, Sendable {
    public var processIdentifier: Int32
    public var updatedAt: Date
    public var canDeliverNotifications: Bool

    public init(processIdentifier: Int32, updatedAt: Date = Date(), canDeliverNotifications: Bool) {
        self.processIdentifier = processIdentifier
        self.updatedAt = updatedAt
        self.canDeliverNotifications = canDeliverNotifications
    }

    public func isFresh(at date: Date = Date(), timeout: TimeInterval = 8) -> Bool {
        date.timeIntervalSince(updatedAt) >= 0 && date.timeIntervalSince(updatedAt) < timeout
    }
}

public struct GraftNativeNotification: Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var message: String

    public init(id: String, title: String, message: String) {
        self.id = id
        self.title = title
        self.message = message
    }
}

public enum GraftStateFile {
    public static var directoryURL: URL {
        #if DEBUG
        // Isolate subprocess integration tests from the user's real settings.
        if let path = ProcessInfo.processInfo.environment["GRAFT_TEST_STATE_DIRECTORY"], path.hasPrefix("/") {
            return URL(fileURLWithPath: path, isDirectory: true)
        }
        #endif
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Graft", isDirectory: true)
    }

    public static var stateURL: URL { directoryURL.appendingPathComponent("companion-state.json") }
    public static var extensionPresenceURL: URL { directoryURL.appendingPathComponent("extension-presence.json") }
    public static var appPresenceURL: URL { directoryURL.appendingPathComponent("app-presence.json") }
    public static var notificationsDirectoryURL: URL { directoryURL.appendingPathComponent("notifications", isDirectory: true) }

    public static func load() -> GraftSharedState {
        guard let data = try? Data(contentsOf: stateURL),
              let state = try? decoder.decode(GraftSharedState.self, from: data) else {
            return GraftSharedState()
        }
        return state
    }

    /// Every writer must mutate the latest state under the same cross-process lock.
    @discardableResult
    public static func update(_ mutation: (inout GraftSharedState) throws -> Void) throws -> GraftSharedState {
        try GraftStateRepository(fileURL: stateURL).update(mutation)
    }

    public static func touchExtensionPresence(at date: Date = Date()) throws {
        try saveValue(date, to: extensionPresenceURL)
    }

    public static func extensionWasSeenRecently(at date: Date = Date(), timeout: TimeInterval = 15) -> Bool {
        guard let updatedAt: Date = loadValue(from: extensionPresenceURL) else { return false }
        let age = date.timeIntervalSince(updatedAt)
        return age >= 0 && age < timeout
    }

    public static func saveAppPresence(_ presence: GraftCompanionPresence) throws {
        try saveValue(presence, to: appPresenceURL)
    }

    public static func loadAppPresence() -> GraftCompanionPresence? {
        loadValue(from: appPresenceURL)
    }

    public static func enqueue(_ notification: GraftNativeNotification) throws {
        try FileManager.default.createDirectory(at: notificationsDirectoryURL, withIntermediateDirectories: true)
        let safeID = notification.id.replacingOccurrences(of: "/", with: "-")
        try saveValue(notification, to: notificationsDirectoryURL.appendingPathComponent("\(safeID)-\(UUID().uuidString).json"))
    }

    private static func saveValue<T: Encodable>(_ value: T, to url: URL) throws {
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        try encoder.encode(value).write(to: url, options: .atomic)
    }

    private static func loadValue<T: Decodable>(from url: URL) -> T? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? decoder.decode(T.self, from: data)
    }

    private static var encoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }

    private static var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
