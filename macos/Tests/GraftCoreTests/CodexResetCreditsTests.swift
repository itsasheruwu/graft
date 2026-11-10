import Foundation
import Testing
@testable import GraftCore

struct CodexResetCreditsTests {
    let now = Date(timeIntervalSince1970: 1_800_000_000)

    @Test func expiryBoundariesAndCandidateOrdering() {
        let credits = [
            CodexResetCredit(id: "later", status: "available", expiresAt: now.addingTimeInterval(301)),
            CodexResetCredit(id: "due", status: "available", expiresAt: now.addingTimeInterval(300)),
            CodexResetCredit(id: "expired", status: "available", expiresAt: now),
            CodexResetCredit(id: "used", status: "redeemed", expiresAt: now.addingTimeInterval(1)),
            CodexResetCredit(id: "no-expiry", status: "available", expiresAt: nil),
        ]
        #expect(CodexResetPolicy.candidates(credits, now: now).map(\.id) == ["due", "later"])
        #expect(CodexResetPolicy.due(credits[1], now: now))
        #expect(!CodexResetPolicy.due(credits[0], now: now))
        #expect(!CodexResetPolicy.due(credits[2], now: now))
        #expect(!CodexResetPolicy.due(credits[4], now: now))
        #expect(CodexResetPolicy.nextCheck([credits[0]], now: now) == now.addingTimeInterval(1))
    }

    @Test func oldSettingsStayOffAndNewSettingsRoundTrip() throws {
        let old = try JSONDecoder().decode(MacSettings.self, from: Data(#"{"keepAwake":true}"#.utf8))
        #expect(old.keepAwake)
        #expect(!old.codexAutoUseResetsEnabled)
        var enabled = old
        enabled.codexAutoUseResetsEnabled = true
        #expect(try JSONDecoder().decode(MacSettings.self, from: JSONEncoder().encode(enabled)) == enabled)
    }

    @Test func credentialsRejectAPIKeysAndRecoverAccountFromJWT() throws {
        #expect(throws: CodexResetError.self) {
            try CodexResetCredentials.decode(Data(#"{"OPENAI_API_KEY":"fixture"}"#.utf8))
        }
        let payload = Data(#"{"https://api.openai.com/auth":{"chatgpt_account_id":"test-account"},"exp":1900000000}"#.utf8)
            .base64EncodedString().replacingOccurrences(of: "=", with: "").replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
        let data = try JSONSerialization.data(withJSONObject: ["tokens": ["access_token": "header.\(payload).signature"]])
        #expect(try CodexResetCredentials.decode(data, now: now).accountID == "test-account")
        #expect(throws: CodexResetError.self) {
            try CodexResetCredentials.decode(data, now: Date(timeIntervalSince1970: 1_900_000_001))
        }
    }

    @Test func inventoryDecodesBothDateFormatsAndConsumeUsesContract() async throws {
        let api = CodexResetAPI { request in
            #expect(request.url?.host == "chatgpt.com")
            #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer fixture")
            #expect(request.value(forHTTPHeaderField: "ChatGPT-Account-ID") == "account")
            if request.httpMethod == "GET" {
                return (Data(#"{"available_count":2,"credits":[{"id":"1","status":"available","expires_at":"2027-01-15T08:00:00Z"},{"id":"2","status":"available","expires_at":"2027-01-15T08:00:00.123Z"}]}"#.utf8), 200)
            }
            #expect(request.url?.path.hasSuffix("/consume") == true)
            let body = try JSONDecoder().decode([String: String].self, from: #require(request.httpBody))
            #expect(body == ["credit_id": "credit", "redeem_request_id": "request"])
            return (Data(#"{"code":"reset"}"#.utf8), 200)
        }
        let credentials = CodexResetCredentials(accessToken: "fixture", accountID: "account")
        #expect(try await api.inventory(credentials).credits.count == 2)
        #expect(try await api.consume("credit", requestID: "request", credentials: credentials) == "reset")
    }

    @Test func unauthorizedAndMalformedSuccessAreNotRedeemed() async throws {
        let credentials = CodexResetCredentials(accessToken: "fixture", accountID: "account")
        for status in [401, 403, 200, 500] {
            let api = CodexResetAPI { _ in (Data("{}".utf8), status) }
            await #expect(throws: CodexResetError.self) {
                try await api.consume("credit", requestID: "request", credentials: credentials)
            }
        }
    }
}
