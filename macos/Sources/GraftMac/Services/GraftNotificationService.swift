import AppKit
import Foundation
import GraftCore
import OSLog
import UserNotifications

struct GraftNotificationPreferences: Equatable, Sendable {
    var timeSensitive = false
    var soundEnabled = true
}

@MainActor
final class GraftNotificationService: NSObject, UNUserNotificationCenterDelegate {
    private var task: Task<Void, Never>?
    private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined
    private(set) var authorizationError: String?
    private(set) var timeSensitiveEnabled = false
    private(set) var notificationSoundEnabled = true
    private let processIdentifier = ProcessInfo.processInfo.processIdentifier
    private let logger = Logger(subsystem: "com.itsasheruwu.graft.mac", category: "Notifications")

    var canDeliverNotifications: Bool {
        authorizationStatus == .authorized || authorizationStatus == .provisional
    }

    func apply(_ settings: MacSettings) {
        timeSensitiveEnabled = settings.robloxWatcherTimeSensitive
        notificationSoundEnabled = settings.robloxWatcherNotificationSoundEnabled
    }

    func start() {
        guard task == nil else { return }
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        refreshAuthorization()
        center.requestAuthorization(options: [.alert, .sound]) { [weak self] _, error in
            Task { @MainActor in
                if let error {
                    self?.authorizationError = error.localizedDescription
                    self?.logger.error("Notification authorization failed: \(error.localizedDescription, privacy: .public)")
                }
                self?.refreshAuthorization()
            }
        }
        task = Task { [weak self] in
            while !Task.isCancelled {
                self?.refreshAuthorization()
                self?.heartbeat()
                self?.deliverPendingNotifications()
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }

    deinit { task?.cancel() }

    func refreshAuthorization() {
        UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
            let status = settings.authorizationStatus
            Task { @MainActor in
                self?.authorizationStatus = status
                if status == .authorized || status == .provisional {
                    self?.authorizationError = nil
                }
            }
        }
    }

    func deliver(_ notification: GraftNativeNotification) {
        deliver(notification, preferences: .init(
            timeSensitive: timeSensitiveEnabled,
            soundEnabled: notificationSoundEnabled
        ))
    }

    func deliver(
        _ notification: GraftNativeNotification,
        preferences: GraftNotificationPreferences
    ) {
        guard canDeliverNotifications else { return }
        UNUserNotificationCenter.current().add(.init(
            identifier: notification.id,
            content: makeContent(for: notification, preferences: preferences),
            trigger: nil
        ))
    }

    func makeContent(for notification: GraftNativeNotification) -> UNMutableNotificationContent {
        makeContent(
            for: notification,
            preferences: .init(
                timeSensitive: timeSensitiveEnabled,
                soundEnabled: notificationSoundEnabled
            )
        )
    }

    func makeContent(
        for notification: GraftNativeNotification,
        preferences: GraftNotificationPreferences
    ) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = notification.title
        content.body = notification.message
        content.sound = preferences.soundEnabled ? .default : nil
        content.interruptionLevel = preferences.timeSensitive ? .timeSensitive : .active
        return content
    }

    private func heartbeat() {
        try? GraftStateFile.saveAppPresence(.init(
            processIdentifier: processIdentifier,
            canDeliverNotifications: canDeliverNotifications
        ))
    }

    private func deliverPendingNotifications() {
        guard canDeliverNotifications else { return }
        let directory = GraftStateFile.notificationsDirectoryURL
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else { return }

        for file in files where file.pathExtension == "json" {
            guard let data = try? Data(contentsOf: file),
                  let notification = try? JSONDecoder().decode(GraftNativeNotification.self, from: data) else {
                continue
            }
            let content = makeContent(for: notification)
            UNUserNotificationCenter.current().add(.init(identifier: notification.id, content: content, trigger: nil)) { error in
                if error == nil { try? FileManager.default.removeItem(at: file) }
            }
        }
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        let shouldPlaySound = await MainActor.run { notificationSoundEnabled }
        return shouldPlaySound ? [.banner, .sound] : [.banner]
    }
}
