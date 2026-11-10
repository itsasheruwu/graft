import Foundation
import GraftCore
import Observation

nonisolated enum ActivityCategory: String, Codable, CaseIterable, Sendable {
    case installs = "Installs", watchers = "Watchers", spotify = "Spotify", settings = "Settings", keepAwake = "Keep Awake"
}

nonisolated enum ActivityLevel: String, Codable, Sendable {
    case info, success, warning, failure
}

nonisolated enum ActivityRetry: Codable, Equatable, Sendable {
    case installDMG(URL)
    case cleanupDMG(file: URL, volume: URL, applications: [URL], trash: Bool)
    case checkRoblox, checkSpotify, repairSpotify, syncSettings, keepAwake

    var title: String {
        switch self {
        case .installDMG: "Retry Install"
        case .cleanupDMG: "Retry Cleanup"
        case .checkRoblox, .checkSpotify: "Check Now"
        case .repairSpotify: "Retry Repair"
        case .syncSettings: "Retry Sync"
        case .keepAwake: "Retry Keep Awake"
        }
    }
}

nonisolated struct GraftActivityEntry: Codable, Identifiable, Equatable, Sendable {
    var id = UUID()
    var date = Date()
    var category: ActivityCategory
    var level: ActivityLevel
    var title: String
    var detail: String
    var retry: ActivityRetry?
    var occurrences = 1
}

@Observable
final class GraftActivityStore {
    private(set) var entries: [GraftActivityEntry] = []
    private(set) var retryingIDs: Set<UUID> = []
    private(set) var persistenceError: String?
    @ObservationIgnored private let fileURL: URL
    @ObservationIgnored private let limit: Int

    init(fileURL: URL = GraftStateFile.directoryURL.appendingPathComponent("activity.json"), limit: Int = 200) {
        self.fileURL = fileURL
        self.limit = max(1, limit)
        if FileManager.default.fileExists(atPath: fileURL.path) {
            do { entries = Array(try JSONDecoder().decode([GraftActivityEntry].self, from: Data(contentsOf: fileURL)).prefix(self.limit)) }
            catch { persistenceError = "Could not read activity history: \(error.localizedDescription)" }
        }
    }

    func record(_ category: ActivityCategory, _ level: ActivityLevel, _ title: String, _ detail: String, retry: ActivityRetry? = nil, coalesce: Bool = false) {
        var entry = GraftActivityEntry(category: category, level: level, title: title, detail: String(detail.prefix(4_000)), retry: retry)
        // Repeated checks update one row instead of filling the history every 30s.
        if coalesce, let index = entries.firstIndex(where: { $0.category == category && $0.title == title && $0.level == level && $0.detail == entry.detail }) {
            let previous = entries.remove(at: index)
            entry.id = previous.id
            entry.occurrences = previous.occurrences + 1
        }
        entries.insert(entry, at: 0)
        entries = Array(entries.prefix(limit))
        persist()
    }

    func retry(_ entry: GraftActivityEntry, perform: (ActivityRetry) async throws -> Void) async {
        guard let retry = entry.retry, retryingIDs.isEmpty else { return }
        retryingIDs.insert(entry.id)
        defer { retryingIDs.remove(entry.id) }
        record(entry.category, .info, retry.title, "Retry requested from Activity.")
        do { try await perform(retry) }
        catch { record(entry.category, .failure, "Retry failed", error.localizedDescription, retry: retry) }
    }

    func retrySaving() { persist() }

    private func persist() {
        do {
            try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONEncoder().encode(entries).write(to: fileURL, options: .atomic)
            persistenceError = nil
        } catch { persistenceError = "Could not save activity history: \(error.localizedDescription)" }
    }
}
