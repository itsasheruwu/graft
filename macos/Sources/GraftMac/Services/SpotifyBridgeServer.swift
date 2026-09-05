@preconcurrency import Network
import Foundation
import Observation

nonisolated struct SpotifyBridgeHTTPRequest: Equatable, Sendable {
    let method: String
    let path: String
    let headers: [String: String]
    let body: Data
}

nonisolated enum SpotifyBridgeHTTPParser {
    static let maximumRequestSize = 256 * 1_024

    static func parse(_ data: Data) -> SpotifyBridgeHTTPRequest? {
        guard data.count <= maximumRequestSize,
              let divider = data.range(of: Data("\r\n\r\n".utf8)),
              let head = String(data: data[..<divider.lowerBound], encoding: .utf8) else {
            return nil
        }
        var lines = head.components(separatedBy: "\r\n")
        guard !lines.isEmpty else { return nil }
        let requestLine = lines.removeFirst().split(separator: " ")
        guard requestLine.count == 3 else { return nil }
        var headers: [String: String] = [:]
        for line in lines {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let key = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
            let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            headers[key] = value
        }
        let bodyStart = divider.upperBound
        let body = Data(data[bodyStart...])
        let expectedLength = Int(headers["content-length"] ?? "0") ?? 0
        guard body.count == expectedLength else { return nil }
        return .init(
            method: String(requestLine[0]),
            path: String(requestLine[1]),
            headers: headers,
            body: body
        )
    }

    static func expectedTotalSize(_ data: Data) -> Int? {
        guard let divider = data.range(of: Data("\r\n\r\n".utf8)),
              let head = String(data: data[..<divider.lowerBound], encoding: .utf8) else {
            return nil
        }
        for line in head.components(separatedBy: "\r\n").dropFirst() {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let key = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
            if key == "content-length" {
                let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
                guard let length = Int(value), length >= 0 else { return nil }
                return divider.upperBound + length
            }
        }
        return divider.upperBound
    }
}

nonisolated private final class SpotifyBridgeConnection: @unchecked Sendable {
    private let connection: NWConnection
    private let handler: @Sendable (SpotifyBridgeHTTPRequest) -> (Int, Data)
    private var buffer = Data()
    private var keepAlive: SpotifyBridgeConnection?

    init(
        connection: NWConnection,
        handler: @escaping @Sendable (SpotifyBridgeHTTPRequest) -> (Int, Data)
    ) {
        self.connection = connection
        self.handler = handler
    }

    func start(on queue: DispatchQueue) {
        keepAlive = self
        connection.start(queue: queue)
        receive()
    }

    private func receive() {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 32 * 1_024) { [weak self] data, _, complete, error in
            guard let self else { return }
            if let data { self.buffer.append(data) }
            if self.buffer.count > SpotifyBridgeHTTPParser.maximumRequestSize {
                self.respond(status: 413, body: Data())
                return
            }
            if let total = SpotifyBridgeHTTPParser.expectedTotalSize(self.buffer), self.buffer.count >= total {
                guard let request = SpotifyBridgeHTTPParser.parse(self.buffer) else {
                    self.respond(status: 400, body: Data())
                    return
                }
                let result = self.handler(request)
                self.respond(status: result.0, body: result.1)
                return
            }
            if error == nil && !complete {
                self.receive()
            } else {
                self.connection.cancel()
                self.keepAlive = nil
            }
        }
    }

    private func respond(status: Int, body: Data) {
        let reason: String
        switch status {
        case 200: reason = "OK"
        case 204: reason = "No Content"
        case 400: reason = "Bad Request"
        case 401: reason = "Unauthorized"
        case 404: reason = "Not Found"
        case 413: reason = "Payload Too Large"
        default: reason = "Internal Server Error"
        }
        let headers = "HTTP/1.1 \(status) \(reason)\r\nContent-Length: \(body.count)\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: https://xpui.app.spotify.com\r\nAccess-Control-Allow-Headers: Content-Type, X-Graft-Bridge-Token\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Allow-Private-Network: true\r\nConnection: close\r\n\r\n"
        var response = Data(headers.utf8)
        response.append(body)
        connection.send(content: response, completion: .contentProcessed { [connection] _ in
            connection.cancel()
            self.keepAlive = nil
        })
    }
}

@MainActor
@Observable
final class SpotifyBridgeServer {
    nonisolated static let port: UInt16 = 27_492
    nonisolated static let allowedOrigin = "https://xpui.app.spotify.com"

    private(set) var isListening = false
    private(set) var lastHeartbeatAt: Date?
    private(set) var bridgeVersion: String?
    private(set) var spotifyVersion: String?
    private(set) var lastError: String?

    @ObservationIgnored nonisolated private let token: String
    @ObservationIgnored private let onPayload: (SpotifyBridgePayload, Date) -> Void
    @ObservationIgnored private var listener: NWListener?
    @ObservationIgnored private let queue = DispatchQueue(label: "com.itsasheruwu.graft.spotify-bridge")

    init(token: String, onPayload: @escaping (SpotifyBridgePayload, Date) -> Void) {
        self.token = token
        self.onPayload = onPayload
    }

    func start() {
        guard listener == nil else { return }
        do {
            let parameters = NWParameters.tcp
            parameters.requiredLocalEndpoint = .hostPort(
                host: .ipv4(.loopback),
                port: NWEndpoint.Port(rawValue: Self.port)!
            )
            let listener = try NWListener(using: parameters)
            listener.stateUpdateHandler = { [weak self] state in
                Task { @MainActor in
                    guard let self else { return }
                    switch state {
                    case .ready:
                        self.isListening = true
                        self.lastError = nil
                    case .failed(let error):
                        self.isListening = false
                        self.lastError = error.localizedDescription
                    case .cancelled:
                        self.isListening = false
                    default: break
                    }
                }
            }
            let requestHandler: @Sendable (SpotifyBridgeHTTPRequest) -> (Int, Data) = { [weak self] request in
                guard let self else { return (500, Data()) }
                return self.handleSynchronously(request)
            }
            listener.newConnectionHandler = { connection in
                SpotifyBridgeConnection(connection: connection, handler: requestHandler)
                    .start(on: self.queue)
            }
            self.listener = listener
            listener.start(queue: queue)
        } catch {
            lastError = error.localizedDescription
        }
    }

    deinit { listener?.cancel() }

    nonisolated private func handleSynchronously(_ request: SpotifyBridgeHTTPRequest) -> (Int, Data) {
        guard request.path == "/v1/spotify/friends-snapshot" else { return (404, Data()) }
        guard request.headers["origin"] == Self.allowedOrigin else {
            return (401, Data())
        }
        if request.method == "OPTIONS" { return (204, Data()) }
        guard request.headers["x-graft-bridge-token"] == token else { return (401, Data()) }
        guard request.method == "POST" else { return (404, Data()) }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let payload = try? decoder.decode(SpotifyBridgePayload.self, from: request.body) else {
            return (400, Data())
        }
        let receivedAt = Date()
        Task { @MainActor [weak self] in
            guard let self else { return }
            self.lastHeartbeatAt = receivedAt
            self.bridgeVersion = payload.bridgeVersion
            self.spotifyVersion = payload.spotifyVersion
            self.lastError = payload.capability == .unsupported
                ? (payload.error ?? "This Spotify version does not expose friend activity.")
                : nil
            self.onPayload(payload, receivedAt)
        }
        return (200, Data("{\"ok\":true}".utf8))
    }
}
