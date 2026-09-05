import GraftCore
import Testing
import UserNotifications
@testable import GraftMac

@Suite("Native notification preferences")
@MainActor
struct GraftNotificationServiceTests {
    private let notification = GraftNativeNotification(
        id: "test",
        title: "Player joined",
        message: "Ash joined Adopt Me."
    )

    @Test("Defaults to an active notification with sound")
    func defaults() {
        let service = GraftNotificationService()
        let content = service.makeContent(for: notification)
        #expect(content.interruptionLevel == .active)
        #expect(content.sound != nil)
    }

    @Test("Supports Time Sensitive silent notifications")
    func timeSensitiveAndSilent() {
        var settings = MacSettings()
        settings.robloxWatcherTimeSensitive = true
        settings.robloxWatcherNotificationSoundEnabled = false
        let service = GraftNotificationService()
        service.apply(settings)

        let content = service.makeContent(for: notification)
        #expect(content.interruptionLevel == .timeSensitive)
        #expect(content.sound == nil)
    }

    @Test("Supports source-specific preferences without changing Roblox defaults")
    func sourceSpecificPreferences() {
        let service = GraftNotificationService()
        let spotifyContent = service.makeContent(
            for: notification,
            preferences: .init(timeSensitive: true, soundEnabled: false)
        )
        let defaultContent = service.makeContent(for: notification)
        #expect(spotifyContent.interruptionLevel == .timeSensitive)
        #expect(spotifyContent.sound == nil)
        #expect(defaultContent.interruptionLevel == .active)
        #expect(defaultContent.sound != nil)
    }
}
