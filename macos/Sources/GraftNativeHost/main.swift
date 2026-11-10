import Foundation
import GraftCore
import Synchronization

// Chrome's native messaging framing: a little-endian UInt32 byte count, then a JSON body.

/// Messages this host sends to the extension.
private struct ApplySettingsMessage: Encodable {
    let type = "applySettings"
    let changes: [String: JSONValue]
    let tokens: [String: String]
    let revision: Int
}

private struct ReadyMessage: Encodable {
    let type = "ready"
    let revision: Int
}

private struct NotificationResultMessage: Encodable {
    let type = "notificationResult"
    let requestID: String
    let handled: Bool
}

private struct RobloxWatcherOwnerResultMessage: Encodable {
    let type = "robloxWatcherOwnerResult"
    let requestID: String
    let active: Bool
}

/// Messages the extension sends to this host. `settings` is optional so unrecognized
/// message types decode rather than tearing down the connection.
private struct IncomingMessage: Decodable {
    let type: String
    let settings: [String: JSONValue]?
    let requestID: String?
    let notification: GraftNativeNotification?
    let acknowledgements: [String: String]?
    let baseRevision: Int?
}

/// Serializes framing and body so concurrent writers can't interleave a header
/// with another message's payload.
private let stdoutLock = Mutex<Void>(())

private func writeMessage(_ message: some Encodable) {
    guard let body = try? JSONEncoder().encode(message) else { return }
    let framed = withUnsafeBytes(of: UInt32(body.count).littleEndian) { Data($0) } + body
    stdoutLock.withLock { _ in
        try? FileHandle.standardOutput.write(contentsOf: framed)
    }
}

/// Reads exactly `count` bytes, or returns nil at end of stream. `read(upToCount:)` is
/// allowed to return a short read on a pipe, so a single call isn't enough.
private func readExactly(_ count: Int) throws -> Data? {
    var buffer = Data()
    buffer.reserveCapacity(count)
    while buffer.count < count {
        guard let chunk = try FileHandle.standardInput.read(upToCount: count - buffer.count),
              !chunk.isEmpty else {
            return nil
        }
        buffer.append(chunk)
    }
    return buffer
}

private func readMessage() throws -> IncomingMessage? {
    guard let header = try readExactly(4) else { return nil }
    let length = header.withUnsafeBytes { $0.loadUnaligned(as: UInt32.self).littleEndian }
    guard length > 0, length < 4_000_000 else { return nil }
    guard let body = try readExactly(Int(length)) else { return nil }
    return try JSONDecoder().decode(IncomingMessage.self, from: body)
}

// Push app-originated changes to the extension. The main thread blocks on stdin below,
// so this poll runs detached rather than as a child of the read loop.
let changePollTask = Task.detached(priority: .utility) {
    while !Task.isCancelled {
        try? GraftStateFile.touchExtensionPresence()
        let state = GraftStateFile.load()
        if !state.pendingBrowserChanges.isEmpty {
            // Retry until the exact per-key token is acknowledged, including if
            // Chrome rejected a write or the connection dropped before the ack.
            writeMessage(ApplySettingsMessage(changes: state.pendingBrowserChanges, tokens: state.browserChangeTokens, revision: state.revision))
        }
        try? await Task.sleep(for: .milliseconds(500))
    }
}

while let message = try? readMessage() {
    try? GraftStateFile.touchExtensionPresence()
    if message.type == "getRobloxWatcherOwner", let requestID = message.requestID {
        let presence = GraftStateFile.loadAppPresence()
        let state = GraftStateFile.load()
        let enabled = state.browserSettings["robloxPlayerWatcherEnabled"]?.boolValue == true
        let hasPlayers: Bool
        if case .array(let entries) = state.browserSettings["robloxPlayerWatcherWhitelist"] {
            hasPlayers = entries.contains { !($0.stringValue ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        } else {
            hasPlayers = false
        }
        let active = presence?.isFresh() == true
            && presence?.canDeliverNotifications == true
            && enabled
            && hasPlayers
        writeMessage(RobloxWatcherOwnerResultMessage(requestID: requestID, active: active))
        continue
    }
    if message.type == "notification", let requestID = message.requestID, let notification = message.notification {
        let presence = GraftStateFile.loadAppPresence()
        var handled = false
        if presence?.isFresh() == true && presence?.canDeliverNotifications == true {
            handled = (try? GraftStateFile.enqueue(notification)) != nil
        }
        writeMessage(NotificationResultMessage(requestID: requestID, handled: handled))
        continue
    }
    guard ["snapshot", "settingsApplied"].contains(message.type), let rawSettings = message.settings else { continue }
    do {
        let state = try GraftStateFile.update {
            $0.receiveBrowserSnapshot(rawSettings, acknowledgements: message.acknowledgements ?? [:], baseRevision: message.baseRevision)
        }
        writeMessage(ReadyMessage(revision: state.revision))
    } catch {
        // Keep the previous file and pending changes intact on any read/write failure.
        writeMessage(["type": "syncError", "message": "Could not save Graft settings. Retry the connection."])
    }
}

changePollTask.cancel()
