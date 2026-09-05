import Foundation

enum RobloxAccountResolverError: LocalizedError {
    case invalidEntry
    case accountNotFound
    case requestFailed

    var errorDescription: String? {
        switch self {
        case .invalidEntry: "Enter a Roblox username, user ID, or profile link."
        case .accountNotFound: "That Roblox account could not be found."
        case .requestFailed: "Graft could not reach Roblox. Try again."
        }
    }
}

struct RobloxIdentity: Equatable, Sendable {
    let id: Int
    let username: String
}

enum RobloxAccountResolver {
    private struct User: Decodable { let id: Int; let name: String }
    private struct UsernameResponse: Decodable { let data: [User] }
    private struct UsernameRequest: Encodable {
        let usernames: [String]
        let excludeBannedUsers: Bool
    }

    static func resolve(_ raw: String) async throws -> String {
        try await resolveIdentity(raw).username
    }

    static func resolveIdentity(_ raw: String) async throws -> RobloxIdentity {
        let entry = normalize(raw)
        guard !entry.isEmpty else { throw RobloxAccountResolverError.invalidEntry }

        let user: User
        if entry.allSatisfy(\.isNumber) {
            guard let url = URL(string: "https://users.roblox.com/v1/users/\(entry)") else {
                throw RobloxAccountResolverError.invalidEntry
            }
            user = try await request(url: url)
        } else {
            guard let url = URL(string: "https://users.roblox.com/v1/usernames/users") else {
                throw RobloxAccountResolverError.requestFailed
            }
            var urlRequest = URLRequest(url: url)
            urlRequest.httpMethod = "POST"
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = try JSONEncoder().encode(UsernameRequest(
                usernames: [entry],
                excludeBannedUsers: true
            ))
            let response: UsernameResponse = try await request(urlRequest)
            guard let first = response.data.first else { throw RobloxAccountResolverError.accountNotFound }
            user = first
        }

        guard user.id > 0, !user.name.isEmpty else { throw RobloxAccountResolverError.accountNotFound }
        return RobloxIdentity(id: user.id, username: user.name)
    }

    private static func normalize(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if let match = trimmed.firstMatch(of: #/\/users\/(\d+)(?:\/|$)/#) {
            return String(match.1)
        }
        return trimmed.trimmingCharacters(in: CharacterSet(charactersIn: "@"))
    }

    private static func request<T: Decodable>(url: URL) async throws -> T {
        try await request(URLRequest(url: url))
    }

    private static func request<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response): (Data, URLResponse)
        do { (data, response) = try await URLSession.shared.data(for: request) }
        catch { throw RobloxAccountResolverError.requestFailed }
        guard let http = response as? HTTPURLResponse else { throw RobloxAccountResolverError.requestFailed }
        if http.statusCode == 404 { throw RobloxAccountResolverError.accountNotFound }
        guard (200..<300).contains(http.statusCode) else { throw RobloxAccountResolverError.requestFailed }
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw RobloxAccountResolverError.accountNotFound }
    }
}
