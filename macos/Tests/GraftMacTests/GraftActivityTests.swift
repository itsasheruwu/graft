import Foundation
import Testing
@testable import GraftMac

@MainActor
struct GraftActivityTests {
    private func directory() throws -> URL {
        let url = URL.temporaryDirectory.appendingPathComponent("graft-activity-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    @Test func historyPersistsBoundsAndCoalescesChecks() throws {
        let root = try directory()
        defer { try? FileManager.default.removeItem(at: root) }
        let file = root.appendingPathComponent("activity.json")
        let store = GraftActivityStore(fileURL: file, limit: 3)
        for _ in 0..<5 { store.record(.watchers, .success, "Checked", "Current", coalesce: true) }
        #expect(store.entries.count == 1)
        #expect(store.entries[0].occurrences == 5)
        let retry = ActivityRetry.installDMG(root.appendingPathComponent("App.dmg"))
        store.record(.installs, .failure, "Install failed", "Disk full", retry: retry)
        store.record(.spotify, .info, "Repair started", "Working")
        store.record(.spotify, .success, "Repair applied", "Waiting for reconnection")
        let reopened = GraftActivityStore(fileURL: file, limit: 3)
        #expect(reopened.entries.count == 3)
        #expect(reopened.entries == store.entries)
        #expect(reopened.entries.last?.retry == retry)
    }

    @Test func retryDispatchesExactActionAndLogsErrorsWithoutGettingStuck() async throws {
        let root = try directory()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = GraftActivityStore(fileURL: root.appendingPathComponent("activity.json"))
        let action = ActivityRetry.cleanupDMG(file: root.appendingPathComponent("App.dmg"), volume: URL(fileURLWithPath: "/Volumes/App"), applications: [root.appendingPathComponent("App.app")], trash: true)
        store.record(.installs, .failure, "Cleanup failed", "Image busy", retry: action)
        let entry = try #require(store.entries.first)
        var called = 0
        await store.retry(entry) { received in
            #expect(received == action)
            called += 1
            throw CocoaError(.fileWriteNoPermission)
        }
        #expect(called == 1)
        #expect(store.retryingIDs.isEmpty)
        #expect(store.entries.first?.title == "Retry failed")
        #expect(store.entries.first?.retry == action)
        await store.retry(entry) { _ in called += 1 }
        #expect(called == 2)
    }

    @Test func concurrentRetryClicksRunOnlyOnce() async throws {
        let root = try directory()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = GraftActivityStore(fileURL: root.appendingPathComponent("activity.json"))
        store.record(.settings, .failure, "Sync failed", "Offline", retry: .syncSettings)
        let entry = try #require(store.entries.first)
        var continuation: CheckedContinuation<Void, Never>?
        var calls = 0
        let first = Task {
            await store.retry(entry) { _ in
                calls += 1
                await withCheckedContinuation { continuation = $0 }
            }
        }
        while continuation == nil { await Task.yield() }
        await store.retry(entry) { _ in calls += 1 }
        continuation?.resume()
        await first.value
        #expect(calls == 1)
        #expect(store.retryingIDs.isEmpty)
    }

    @Test func watcherSetupProblemsAndRepairFailuresHaveWorkingRetryTypes() async throws {
        let root = try directory()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = GraftActivityStore(fileURL: root.appendingPathComponent("activity.json"))
        let notifications = GraftNotificationService()
        let roblox = RobloxPresenceWatcher(notifications: notifications, presenceLogs: RobloxPresenceLogStore(fileURL: root.appendingPathComponent("roblox.json")), activity: store)
        await roblox.checkNow()
        #expect(store.entries.first?.retry == .checkRoblox)
        let spotify = SpotifyFriendWatcher(notifications: notifications, history: SpotifyListeningHistoryStore(fileURL: root.appendingPathComponent("spotify.json")), activity: store)
        spotify.checkNow()
        #expect(store.entries.first?.retry == .checkSpotify)
        let integration = SpotifyIntegrationService(homeDirectory: root, resourceURL: nil, bridgeToken: "test-only", activity: store)
        await integration.installOrRepair()
        #expect(store.entries.first?.title == "Spotify repair failed")
        #expect(store.entries.first?.retry == .repairSpotify)
    }
}
