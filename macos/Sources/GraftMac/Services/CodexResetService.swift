import AppKit
import CryptoKit
import Foundation
import GraftCore
import Observation

@Observable
final class CodexResetService {
    private(set) var isEnabled = false
    private(set) var isChecking = false
    private(set) var status = "Off"
    private(set) var detail = "Enable to use banked resets about five minutes before they expire."
    private(set) var credits: [CodexResetCredit] = []
    private(set) var lastCheckedAt: Date?
    private(set) var lastRedeemedAt: Date?
    private(set) var nextRedemptionAt: Date?
    @ObservationIgnored private var task: Task<Void, Never>?
    @ObservationIgnored private var wakeObserver: NSObjectProtocol?
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private var nextCheckAt = Date.distantPast
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let api: CodexResetAPI
    @ObservationIgnored private let loadCredentials: @Sendable () async throws -> CodexResetCredentials
    @ObservationIgnored private let now: @Sendable () -> Date
    @ObservationIgnored private let onRedeemed: (String) -> Void
    @ObservationIgnored private var attempts: [String: Attempt]

    private struct Attempt: Codable {
        let requestID: String
        let expiresAt: Date
        var completed: Bool
    }
    private static let ledgerKey = "graftCodexResetAttempts"

    init(
        defaults: UserDefaults = .standard,
        api: CodexResetAPI = .init(),
        loadCredentials: @escaping @Sendable () async throws -> CodexResetCredentials = { try CodexResetCredentials.load() },
        now: @escaping @Sendable () -> Date = { Date() },
        onRedeemed: @escaping (String) -> Void = { _ in }
    ) {
        self.defaults = defaults
        self.api = api
        self.loadCredentials = loadCredentials
        self.now = now
        self.onRedeemed = onRedeemed
        attempts = defaults.data(forKey: Self.ledgerKey).flatMap { try? JSONDecoder().decode([String: Attempt].self, from: $0) } ?? [:]
        lastRedeemedAt = defaults.object(forKey: "graftCodexResetLastRedeemedAt") as? Date
    }

    func apply(enabled: Bool) {
        guard isEnabled != enabled else { return }
        isEnabled = enabled
        generation += 1
        nextCheckAt = .distantPast
        if enabled {
            status = "Checking"
            detail = "Reading reset inventory from your Codex account."
            start()
        } else {
            task?.cancel()
            task = nil
            status = "Off"
            detail = "Enable to use banked resets about five minutes before they expire."
            credits = []
            nextRedemptionAt = nil
        }
    }

    private func start() {
        if wakeObserver == nil {
            wakeObserver = NSWorkspace.shared.notificationCenter.addObserver(
                forName: NSWorkspace.didWakeNotification, object: nil, queue: .main
            ) { [weak self] _ in
                Task { @MainActor in self?.nextCheckAt = .distantPast }
            }
        }
        task = Task { [weak self] in
            while !Task.isCancelled {
                if let self, self.now() >= self.nextCheckAt { await self.checkNow() }
                do { try await Task.sleep(for: .seconds(1)) } catch { return }
            }
        }
    }

    isolated deinit {
        task?.cancel()
        if let wakeObserver { NSWorkspace.shared.notificationCenter.removeObserver(wakeObserver) }
    }

    func checkNow() async {
        guard isEnabled, !isChecking else { return }
        let revision = generation
        isChecking = true
        defer { isChecking = false }
        nextCheckAt = now().addingTimeInterval(60)
        do {
            let credentials = try await loadCredentials()
            let inventory = try await api.inventory(credentials)
            guard isEnabled, generation == revision, !Task.isCancelled else { return }
            let date = now()
            lastCheckedAt = date
            attempts = attempts.filter { $0.value.expiresAt > date }
            let available = inventory.credits.filter { $0.isAvailable(at: date) }
            credits = available
            let candidates = CodexResetPolicy.candidates(available, now: date).filter {
                attempts[attemptKey(accountID: credentials.accountID, creditID: $0.id)]?.completed != true
            }
            nextRedemptionAt = candidates.first?.expiresAt?.addingTimeInterval(-CodexResetPolicy.redeemWindow)
            status = available.isEmpty ? "No resets" : "Monitoring"
            detail = available.isEmpty ? "No banked resets available. Graft checks every minute while running."
                : "\(available.count) banked reset\(available.count == 1 ? "" : "s") available."
            if let candidate = candidates.first(where: { CodexResetPolicy.due($0, now: date) }) {
                // Re-read before consuming: a login/account change while GET was in flight
                // must never redeem inventory against a different account.
                let current = try await loadCredentials()
                guard isEnabled, generation == revision, !Task.isCancelled else { return }
                guard current.accountID == credentials.accountID else {
                    credits = []
                    nextRedemptionAt = nil
                    status = "Account changed"
                    detail = "Checking the newly signed-in account shortly."
                    nextCheckAt = now().addingTimeInterval(1)
                    return
                }
                guard CodexResetPolicy.due(candidate, now: now()), let expiry = candidate.expiresAt else { return }
                let key = attemptKey(accountID: current.accountID, creditID: candidate.id)
                let attempt = attempts[key] ?? Attempt(requestID: UUID().uuidString, expiresAt: expiry, completed: false)
                attempts[key] = attempt
                saveAttempts() // Reuse this idempotency ID after a timeout or app restart.
                status = "Using reset"
                let code = try await api.consume(candidate.id, requestID: attempt.requestID, credentials: current)
                if ["reset", "already_redeemed", "no_credit", "nothing_to_reset", "expired", "not_found"].contains(code) {
                    attempts[key]?.completed = true
                    saveAttempts()
                }
                if code == "reset" {
                    lastRedeemedAt = now()
                    defaults.set(lastRedeemedAt, forKey: "graftCodexResetLastRedeemedAt")
                    onRedeemed(key)
                }
                guard isEnabled, generation == revision, !Task.isCancelled else { return }
                if attempts[key]?.completed == true {
                    credits.removeAll { $0.id == candidate.id }
                    nextRedemptionAt = nil
                    status = code == "reset" ? "Reset used" : "Monitoring"
                    detail = code == "reset" ? "Automatically used a reset before it expired." : "Reset inventory changed. Checking again shortly."
                    nextCheckAt = now().addingTimeInterval(1)
                } else {
                    status = "Retrying"
                    detail = "Codex could not use this reset yet. Graft will retry in a minute."
                }
            } else {
                nextCheckAt = CodexResetPolicy.nextCheck(candidates, now: date)
                saveAttempts()
            }
        } catch {
            guard isEnabled, generation == revision, !Task.isCancelled else { return }
            credits = []
            nextRedemptionAt = nil
            status = (error as? CodexResetError) == .signInRequired ? "Sign in required" : "Retrying"
            // Avoid surfacing server bodies or credentials in UI/logs.
            detail = (error as? CodexResetError)?.errorDescription ?? "Unable to reach Codex. Graft will retry in a minute."
        }
    }

    private func attemptKey(accountID: String, creditID: String) -> String {
        SHA256.hash(data: Data("\(accountID)\u{0}\(creditID)".utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private func saveAttempts() {
        if let data = try? JSONEncoder().encode(attempts) { defaults.set(data, forKey: Self.ledgerKey) }
    }
}
