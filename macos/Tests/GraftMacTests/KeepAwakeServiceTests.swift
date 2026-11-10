import Foundation
import GraftCore
import Testing
@testable import GraftMac

@MainActor
struct KeepAwakeServiceTests {
    @Test(arguments: [KeepAwakeMode.thirtyMinutes, .twoHours])
    func timedSessionsExpireAtOriginalDeadlineWithoutRestarting(mode: KeepAwakeMode) throws {
        var now = Date(timeIntervalSince1970: 1_800_000_000)
        var created = 0
        var released: [UInt32] = []
        var stopped = 0
        let service = KeepAwakeService(now: { now }, createAssertion: { created += 1; return 42 }, releaseAssertion: { released.append($0) }, automaticallyMonitor: false)
        service.onStopped = { _, _ in stopped += 1 }
        var settings = MacSettings()
        settings.keepAwake = true
        settings.keepAwakeMode = mode
        settings.keepAwakeDeadline = now.addingTimeInterval(try #require(mode.duration))
        service.apply(settings)
        #expect(service.isActive)
        now = try #require(settings.keepAwakeDeadline).addingTimeInterval(-1)
        service.apply(settings)
        service.checkNow()
        #expect(created == 1)
        #expect(released.isEmpty)
        now = try #require(settings.keepAwakeDeadline)
        service.checkNow()
        service.checkNow()
        #expect(!service.isActive)
        #expect(released == [42])
        #expect(stopped == 1)
    }

    @Test func appBoundSessionEndsWhenChosenProcessExits() {
        var running = true
        var released = 0
        let service = KeepAwakeService(targetIsRunning: { settings in
            #expect(settings.keepAwakeAppPID == 123)
            return running
        }, createAssertion: { 11 }, releaseAssertion: { _ in released += 1 }, automaticallyMonitor: false)
        var settings = MacSettings()
        settings.keepAwake = true
        settings.keepAwakeMode = .untilAppQuits
        settings.keepAwakeAppBundleID = "test.app"
        settings.keepAwakeAppPID = 123
        service.apply(settings)
        #expect(service.isActive)
        running = false
        service.checkNow()
        #expect(!service.isActive)
        #expect(released == 1)
    }

    @Test func shutdownReleasesExactlyOnceAndExpiredSessionsDoNotStart() {
        var created = 0
        var released = 0
        let service = KeepAwakeService(createAssertion: { created += 1; return 7 }, releaseAssertion: { _ in released += 1 }, automaticallyMonitor: false)
        var settings = MacSettings()
        settings.keepAwake = true
        settings.keepAwakeMode = .thirtyMinutes
        settings.keepAwakeDeadline = Date.distantPast
        service.apply(settings)
        #expect(created == 0)
        settings.keepAwakeMode = .untilTurnedOff
        service.apply(settings)
        #expect(service.isActive)
        service.shutdown()
        service.shutdown()
        #expect(!service.isActive)
        #expect(released == 1)
    }

    @Test func deniedPowerAssertionDoesNotClaimActive() {
        let service = KeepAwakeService(createAssertion: { throw CocoaError(.featureUnsupported) }, automaticallyMonitor: false)
        var failed = false
        service.onStopped = { _, wasFailure in failed = wasFailure }
        var settings = MacSettings()
        settings.keepAwake = true
        service.apply(settings)
        #expect(!service.isActive)
        #expect(failed)
    }

    @Test func realPowerAssertionStartsAndReleases() {
        let service = KeepAwakeService(automaticallyMonitor: false)
        var settings = MacSettings()
        settings.keepAwake = true
        service.apply(settings)
        #expect(service.isActive)
        service.shutdown()
        #expect(!service.isActive)
    }
}
