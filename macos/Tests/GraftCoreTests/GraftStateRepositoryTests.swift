import Foundation
import Testing
@testable import GraftCore

struct GraftStateRepositoryTests {
    private func repository() throws -> GraftStateRepository {
        let directory = URL.temporaryDirectory.appendingPathComponent("graft-sync-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return .init(fileURL: directory.appendingPathComponent("companion-state.json"))
    }

    @Test func staleMacEditsMergeOnlyChangedFieldsAndPreserveBrowserState() throws {
        let repo = try repository()
        defer { try? FileManager.default.removeItem(at: repo.fileURL.deletingLastPathComponent()) }
        let stale = MacSettings()
        try repo.update { $0.macSettings.spotifyWatcherEnabled = true; $0.browserSettings["browser"] = .bool(true) }
        var changed = stale
        changed.keepAwake = true
        let result = try repo.update { try $0.mergeMacSettings(changed, baseline: stale) }
        #expect(result.macSettings.keepAwake)
        #expect(result.macSettings.spotifyWatcherEnabled)
        #expect(result.browserSettings["browser"] == .bool(true))
    }

    @Test func acknowledgementsCannotClearNewerSameValueChanges() throws {
        var state = GraftSharedState()
        state.setBrowserValue(.bool(true), for: "toggle")
        let first = try #require(state.browserChangeTokens["toggle"])
        state.revision += 1
        state.setBrowserValue(.bool(false), for: "toggle")
        state.revision += 1
        state.setBrowserValue(.bool(true), for: "toggle")
        let latest = try #require(state.browserChangeTokens["toggle"])
        state.receiveBrowserSnapshot(["toggle": .bool(true)], acknowledgements: ["toggle": first], baseRevision: 1)
        #expect(state.pendingBrowserChanges["toggle"] == .bool(true))
        state.receiveBrowserSnapshot(["toggle": .bool(false)], baseRevision: 0)
        #expect(state.browserSettings["toggle"] == .bool(true))
        state.receiveBrowserSnapshot(["toggle": .bool(true)], acknowledgements: ["toggle": latest], baseRevision: 3)
        #expect(state.pendingBrowserChanges.isEmpty)
        state.receiveBrowserSnapshot(["toggle": .bool(false)], baseRevision: 1)
        #expect(state.browserSettings["toggle"] == .bool(true))
        state.receiveBrowserSnapshot(["toggle": .bool(false)], baseRevision: 3)
        #expect(state.browserSettings["toggle"] == .bool(false))
    }

    @Test func malformedFileAndFailedMutationNeverOverwriteSavedSettings() throws {
        let repo = try repository()
        defer { try? FileManager.default.removeItem(at: repo.fileURL.deletingLastPathComponent()) }
        try Data("broken JSON".utf8).write(to: repo.fileURL)
        #expect(throws: DecodingError.self) { try repo.update { $0.macSettings.keepAwake = true } }
        #expect(try String(contentsOf: repo.fileURL, encoding: .utf8) == "broken JSON")
        try FileManager.default.removeItem(at: repo.fileURL)
        try repo.update { $0.macSettings.floatGraftWindow = true }
        let before = try Data(contentsOf: repo.fileURL)
        #expect(throws: CocoaError.self) {
            try repo.update { $0.macSettings.floatGraftWindow = false; throw CocoaError(.fileWriteNoPermission) }
        }
        #expect(try Data(contentsOf: repo.fileURL) == before)
    }

    @Test func concurrentTransactionsPreserveEveryIndependentChange() async throws {
        let repo = try repository()
        defer { try? FileManager.default.removeItem(at: repo.fileURL.deletingLastPathComponent()) }
        try await withThrowingTaskGroup(of: Void.self) { group in
            for writer in 0..<8 {
                group.addTask {
                    for count in 0..<30 {
                        try repo.update { $0.browserSettings["writer-\(writer)"] = .number(Double(count)) }
                    }
                }
            }
            try await group.waitForAll()
        }
        let result = try repo.read()
        #expect(result.revision == 240)
        #expect(result.browserSettings.count == 8)
        for writer in 0..<8 { #expect(result.browserSettings["writer-\(writer)"] == .number(29)) }
    }

    @Test func nativeHostProcessAndAppTransactionsDoNotClobberEachOther() throws {
        let repo = try repository()
        let directory = repo.fileURL.deletingLastPathComponent()
        defer { try? FileManager.default.removeItem(at: directory) }
        let package = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let candidates = [".build/out/Products/Debug/GraftNativeHost", ".build/debug/GraftNativeHost", ".build/arm64-apple-macosx/debug/GraftNativeHost"]
        let executable = try #require(candidates.map { package.appendingPathComponent($0) }.first { FileManager.default.isExecutableFile(atPath: $0.path) })
        try repo.update { $0.setBrowserValue(.bool(true), for: "nativeToggle") }
        let process = Process()
        let input = Pipe()
        let outputURL = directory.appendingPathComponent("host-output")
        FileManager.default.createFile(atPath: outputURL.path, contents: nil)
        let output = try FileHandle(forWritingTo: outputURL)
        defer { try? output.close() }
        process.executableURL = executable
        var environment = ProcessInfo.processInfo.environment
        environment["GRAFT_TEST_STATE_DIRECTORY"] = directory.path
        process.environment = environment
        process.standardInput = input
        process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        try process.run()
        defer { if process.isRunning { process.terminate() } }
        for count in 0..<100 {
            let body = try JSONSerialization.data(withJSONObject: ["type": "snapshot", "settings": ["browserCounter": count, "nativeToggle": false]])
            let frame = withUnsafeBytes(of: UInt32(body.count).littleEndian) { Data($0) } + body
            try input.fileHandleForWriting.write(contentsOf: frame)
            try repo.update { $0.macSettings.floatGraftWindow = true; $0.browserSettings["appCounter"] = .number(Double(count)) }
        }
        try input.fileHandleForWriting.close()
        process.waitUntilExit()
        #expect(process.terminationStatus == 0)
        let result = try repo.read()
        #expect(result.macSettings.floatGraftWindow)
        #expect(result.browserSettings["appCounter"] == .number(99))
        #expect(result.browserSettings["browserCounter"] == .number(99))
        #expect(result.browserSettings["nativeToggle"] == .bool(true))
        #expect(result.pendingBrowserChanges["nativeToggle"] == .bool(true))
    }
}
