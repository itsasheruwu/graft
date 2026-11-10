import Foundation

// Reset inventory and wire contract adapted from CodexBar (MIT; see CODEXBAR-NOTICE.md).
public struct CodexResetCredit: Decodable, Equatable, Sendable, Identifiable {
    public let id: String
    public let status: String
    public let expiresAt: Date?
    public let title: String?

    public init(id: String, status: String, expiresAt: Date?, title: String? = nil) {
        self.id = id
        self.status = status
        self.expiresAt = expiresAt
        self.title = title
    }

    enum CodingKeys: String, CodingKey {
        case id, status, title
        case expiresAt = "expires_at"
    }

    public func isAvailable(at now: Date) -> Bool {
        status == "available" && !id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (expiresAt.map { $0 > now } ?? true)
    }
}

public struct CodexResetInventory: Decodable, Sendable {
    public let credits: [CodexResetCredit]
    public let availableCount: Int
    enum CodingKeys: String, CodingKey {
        case credits
        case availableCount = "available_count"
    }
    public init(credits: [CodexResetCredit], availableCount: Int) {
        self.credits = credits
        self.availableCount = availableCount
    }
}

public enum CodexResetPolicy {
    public static let redeemWindow: TimeInterval = 300

    public static func candidates(_ credits: [CodexResetCredit], now: Date) -> [CodexResetCredit] {
        credits.filter { $0.isAvailable(at: now) && $0.expiresAt != nil }
            .sorted {
                if $0.expiresAt != $1.expiresAt { return $0.expiresAt! < $1.expiresAt! }
                return $0.id < $1.id
            }
    }

    public static func due(_ credit: CodexResetCredit, now: Date) -> Bool {
        credit.isAvailable(at: now)
            && (credit.expiresAt.map { $0.timeIntervalSince(now) <= redeemWindow } ?? false)
    }

    public static func nextCheck(_ credits: [CodexResetCredit], now: Date) -> Date {
        // Poll for newly granted credits; shorten the interval for a known expiry.
        let scheduled = candidates(credits, now: now).compactMap { $0.expiresAt?.addingTimeInterval(-redeemWindow) }.min()
        return min(now.addingTimeInterval(60), max(now.addingTimeInterval(1), scheduled ?? .distantFuture))
    }
}

public struct CodexResetCredentials: Equatable, Sendable {
    public let accessToken: String
    public let accountID: String
    public init(accessToken: String, accountID: String) {
        self.accessToken = accessToken
        self.accountID = accountID
    }

    public static var authURL: URL {
        let configured = ProcessInfo.processInfo.environment["CODEX_HOME"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let root: URL
        if let configured, !configured.isEmpty {
            root = URL(fileURLWithPath: NSString(string: configured).expandingTildeInPath, isDirectory: true)
        } else {
            root = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".codex", isDirectory: true)
        }
        return root.appendingPathComponent("auth.json")
    }

    public static func load() throws -> Self {
        guard let data = try? Data(contentsOf: authURL) else { throw CodexResetError.signInRequired }
        return try decode(data)
    }

    public static func decode(_ data: Data, now: Date = Date()) throws -> Self {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let tokens = json["tokens"] as? [String: Any],
              let access = nonempty(tokens["access_token"] ?? tokens["accessToken"])
        else { throw CodexResetError.signInRequired }
        let accessClaims = claims(access)
        if let expiry = accessClaims?["exp"] as? Double, expiry <= now.timeIntervalSince1970 {
            throw CodexResetError.signInRequired
        }
        let idClaims = nonempty(tokens["id_token"] ?? tokens["idToken"]).flatMap(claims)
        let account = nonempty(tokens["account_id"] ?? tokens["accountId"])
            ?? accountID(idClaims) ?? accountID(accessClaims)
        guard let account else { throw CodexResetError.signInRequired }
        return Self(accessToken: access, accountID: account)
    }

    private static func nonempty(_ value: Any?) -> String? {
        guard let string = value as? String else { return nil }
        let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func accountID(_ claims: [String: Any]?) -> String? {
        nonempty(claims?["chatgpt_account_id"])
            ?? nonempty((claims?["https://api.openai.com/auth"] as? [String: Any])?["chatgpt_account_id"])
    }

    private static func claims(_ token: String) -> [String: Any]? {
        let parts = token.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3 else { return nil }
        var payload = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
        guard let data = Data(base64Encoded: payload) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}

public enum CodexResetError: LocalizedError, Equatable, Sendable {
    case signInRequired, invalidResponse, http(Int)
    public var errorDescription: String? {
        switch self {
        case .signInRequired: "Open Codex and sign in again, or run codex login. Graft uses your existing Codex sign-in."
        case .invalidResponse: "Codex returned an unreadable reset response. Graft will check again shortly."
        case .http(let status): "Codex reset check failed (HTTP \(status)). Graft will retry shortly."
        }
    }
}

public struct CodexResetAPI: Sendable {
    public typealias Transport = @Sendable (URLRequest) async throws -> (Data, Int)
    private let transport: Transport
    public init(transport: @escaping Transport = { request in
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw CodexResetError.invalidResponse }
        return (data, response.statusCode)
    }) { self.transport = transport }

    public func inventory(_ credentials: CodexResetCredentials) async throws -> CodexResetInventory {
        let (data, status) = try await transport(request(credentials, consume: false))
        try validate(status)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: raw) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: raw) else { throw CodexResetError.invalidResponse }
            return date
        }
        guard let inventory = try? decoder.decode(CodexResetInventory.self, from: data), inventory.availableCount >= 0 else {
            throw CodexResetError.invalidResponse
        }
        return inventory
    }

    public func consume(_ creditID: String, requestID: String, credentials: CodexResetCredentials) async throws -> String {
        var request = request(credentials, consume: true)
        request.httpBody = try JSONEncoder().encode(["credit_id": creditID, "redeem_request_id": requestID])
        let (data, status) = try await transport(request)
        if status == 401 || status == 403 { throw CodexResetError.signInRequired }
        let code = (try? JSONDecoder().decode([String: String].self, from: data))?["code"]
        if let code, ["already_redeemed", "no_credit", "nothing_to_reset", "expired", "not_found"].contains(code) { return code }
        try validate(status)
        guard let code else { throw CodexResetError.invalidResponse }
        return code
    }

    private func request(_ credentials: CodexResetCredentials, consume: Bool) -> URLRequest {
        // Fixed official endpoint: never send Codex credentials to a configurable proxy.
        let suffix = consume ? "/consume" : ""
        var request = URLRequest(url: URL(string: "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits\(suffix)")!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.httpMethod = consume ? "POST" : "GET"
        request.setValue("Bearer \(credentials.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue(credentials.accountID, forHTTPHeaderField: "ChatGPT-Account-ID")
        request.setValue("Graft", forHTTPHeaderField: "User-Agent")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("codex-1", forHTTPHeaderField: "OpenAI-Beta")
        request.setValue("Codex Desktop", forHTTPHeaderField: "originator")
        if consume { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        return request
    }

    private func validate(_ status: Int) throws {
        if status == 401 || status == 403 { throw CodexResetError.signInRequired }
        guard (200...299).contains(status) else { throw CodexResetError.http(status) }
    }
}
