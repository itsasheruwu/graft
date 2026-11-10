import Foundation
import GraftCore
import Testing
@testable import GraftMac

private actor ResetFixture {
    var posts: [String] = []
    var failNextPost = false
    var credentialLoads = 0
    var changesAccount = false
    var onInventory: (@MainActor @Sendable () -> Void)?
    let expiry: Date
    init(expiry: Date) { self.expiry = expiry }
    func setFailure() { failNextPost = true }
    func switchAccount() { changesAccount = true }
    func setInventoryAction(_ action: @escaping @MainActor @Sendable () -> Void) { onInventory = action }
    func credentials() -> CodexResetCredentials {
        credentialLoads += 1
        return .init(accessToken: "fixture", accountID: changesAccount && credentialLoads > 1 ? "other" : "account")
    }
    func response(_ request: URLRequest) async throws -> (Data, Int) {
        if request.httpMethod == "GET" {
            await onInventory?()
            let formatter = ISO8601DateFormatter()
            let object: [String: Any] = ["available_count": 1, "credits": [["id": "credit", "status": "available", "expires_at": formatter.string(from: expiry)]]]
            return (try JSONSerialization.data(withJSONObject: object), 200)
        }
        let body = try JSONDecoder().decode([String: String].self, from: #require(request.httpBody))
        posts.append(try #require(body["redeem_request_id"]))
        if failNextPost { failNextPost = false; throw URLError(.timedOut) }
        return (Data(#"{"code":"reset"}"#.utf8), 200)
    }
}

@MainActor
struct CodexResetServiceTests {
    let now = Date(timeIntervalSince1970: 1_800_000_000)

    private func makeService(_ fixture: ResetFixture, defaults: UserDefaults) -> CodexResetService {
        let date = now
        return CodexResetService(defaults: defaults, api: .init { try await fixture.response($0) },
            loadCredentials: { await fixture.credentials() }, now: { date })
    }

    @Test func retriesReuseRequestIDAndCompletedCreditsStaySuppressedAcrossRestart() async throws {
        let suite = "graft-reset-tests-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let fixture = ResetFixture(expiry: now.addingTimeInterval(100))
        await fixture.setFailure()
        let service = makeService(fixture, defaults: defaults)
        service.apply(enabled: true)
        await service.checkNow()
        #expect(service.status == "Retrying")
        service.apply(enabled: false)
        let retryAfterRestart = makeService(fixture, defaults: defaults)
        retryAfterRestart.apply(enabled: true)
        await retryAfterRestart.checkNow()
        #expect(retryAfterRestart.lastRedeemedAt == now)
        retryAfterRestart.apply(enabled: false)
        let posts = await fixture.posts
        #expect(posts.count == 2)
        #expect(posts[0] == posts[1])
        let restarted = makeService(fixture, defaults: defaults)
        restarted.apply(enabled: true)
        await restarted.checkNow()
        restarted.apply(enabled: false)
        #expect(await fixture.posts.count == 2)
    }

    @Test func disablingDuringInventoryDoesNotConsume() async throws {
        let suite = "graft-reset-tests-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let fixture = ResetFixture(expiry: now.addingTimeInterval(100))
        let service = makeService(fixture, defaults: defaults)
        await fixture.setInventoryAction { service.apply(enabled: false) }
        service.apply(enabled: true)
        await service.checkNow()
        #expect(await fixture.posts.isEmpty)
        #expect(service.status == "Off")
        #expect(service.credits.isEmpty)
    }

    @Test func changedAccountDoesNotConsumeOldInventory() async throws {
        let suite = "graft-reset-tests-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let fixture = ResetFixture(expiry: now.addingTimeInterval(100))
        await fixture.switchAccount()
        let service = makeService(fixture, defaults: defaults)
        service.apply(enabled: true)
        await service.checkNow()
        service.apply(enabled: false)
        #expect(await fixture.posts.isEmpty)
    }
}
