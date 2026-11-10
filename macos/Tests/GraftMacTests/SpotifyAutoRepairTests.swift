import Foundation
import Testing
@testable import GraftMac

struct SpotifyAutoRepairTests {
    @Test func gracePeriodAndCooldown() {
        let now = Date()
        var policy = SpotifyAutoRepairPolicy(lastMaintenanceCheckAt: now)

        func check(_ seconds: Double) -> SpotifyAutoRepairAction? {
            policy.nextAction(
                enabled: true,
                eligible: true,
                status: .waitingForBridge,
                interfaceHealthy: true,
                busy: false,
                now: now.addingTimeInterval(seconds)
            )
        }

        #expect(check(0) == nil)
        #expect(check(89) == nil)
        #expect(check(90) == .repair)
        #expect(check(180) == nil)
        #expect(check(1_889) == nil)
        #expect(check(1_890) == .repair)
    }

    @Test func disabledIneligibleBusyAndUnsupportedDoNothing() {
        let now = Date()
        let cases: [(Bool, Bool, SpotifyIntegrationStatus, Bool)] = [
            (false, true, SpotifyIntegrationStatus.waitingForBridge, false),
            (true, false, .waitingForBridge, false),
            (true, true, .unsupported("Feed unavailable"), false),
            (true, true, .waitingForBridge, true),
        ]

        for (enabled, eligible, status, busy) in cases {
            var policy = SpotifyAutoRepairPolicy(
                disconnectedSince: .distantPast,
                lastMaintenanceCheckAt: now
            )
            let action = policy.nextAction(
                enabled: enabled,
                eligible: eligible,
                status: status,
                interfaceHealthy: true,
                busy: busy,
                now: now
            )
            #expect(action == nil)
        }
    }

    @Test func healthyConnectionRunsPeriodicMaintenance() {
        let now = Date()
        var policy = SpotifyAutoRepairPolicy()

        #expect(policy.nextAction(
            enabled: true,
            eligible: true,
            status: .connected,
            interfaceHealthy: true,
            busy: false,
            now: now
        ) == .maintenance)
        #expect(policy.nextAction(
            enabled: true,
            eligible: true,
            status: .connected,
            interfaceHealthy: true,
            busy: false,
            now: now.addingTimeInterval(86_399)
        ) == nil)
        #expect(policy.nextAction(
            enabled: true,
            eligible: true,
            status: .connected,
            interfaceHealthy: true,
            busy: false,
            now: now.addingTimeInterval(86_400)
        ) == .maintenance)
    }

    @Test func brokenControlsUseRepairGracePeriodEvenWhenConnected() {
        let now = Date()
        var policy = SpotifyAutoRepairPolicy(lastMaintenanceCheckAt: now)

        #expect(policy.nextAction(
            enabled: true,
            eligible: true,
            status: .connected,
            interfaceHealthy: false,
            busy: false,
            now: now
        ) == nil)
        #expect(policy.nextAction(
            enabled: true,
            eligible: true,
            status: .connected,
            interfaceHealthy: false,
            busy: false,
            now: now.addingTimeInterval(90)
        ) == .repair)
    }

    @Test func interfaceHealthRequiresInjectedControlsAndMatchingSpotifyVersion() {
        let index = "<script src=\"helper/spicetifyWrapper.js\"></script><script src=\"graft-spotify-bridge.js\"></script>"
        let wrapper = "Spicetify.SVGIcons main-globalNav-buddyFeed"
        let config = "[Setting]\nversion = 1.3.1.45\n"

        #expect(SpotifyIntegrationService.interfaceAssetsHealthy(
            indexHTML: index,
            wrapperScript: wrapper,
            config: config,
            spotifyVersion: "1.3.1"
        ))
        #expect(!SpotifyIntegrationService.interfaceAssetsHealthy(
            indexHTML: index,
            wrapperScript: "main-globalNav-buddyFeed",
            config: config,
            spotifyVersion: "1.3.1"
        ))
        #expect(!SpotifyIntegrationService.interfaceAssetsHealthy(
            indexHTML: index,
            wrapperScript: wrapper,
            config: config,
            spotifyVersion: "1.3.2"
        ))
        #expect(!SpotifyIntegrationService.interfaceAssetsHealthy(
            indexHTML: index,
            wrapperScript: wrapper,
            config: "[Setting]\n",
            spotifyVersion: "1.3.1"
        ))
    }
}
