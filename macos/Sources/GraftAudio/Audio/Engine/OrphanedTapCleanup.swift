// Adapted for Graft, 2026-09-14. See macos/FINETUNE-NOTICE.md for source and modifications.
// FineTune/Audio/Engine/OrphanedTapCleanup.swift
import AudioToolbox
import os

private let logger = Logger(subsystem: "com.graft.audio", category: "OrphanedTapCleanup")

/// Scans CoreAudio for orphaned Graft audio aggregate devices and destroys them.
/// Orphans occur when Graft crashes or is force-killed (`kill -9`), leaving
/// aggregate devices with `.mutedWhenTapped` process taps that silently mute apps.
package enum OrphanedTapCleanup {
    package static func ownsAggregate(name: String, uid: String) -> Bool {
        name.hasPrefix("GraftAudio-") && uid.hasPrefix("com.itsasheruwu.graft.audio.")
    }

    /// Destroys any aggregate devices named "GraftAudio-*" left over from a previous session.
    /// Call on startup before creating any new taps.
    package static func destroyOrphanedDevices() {
        let devices: [AudioDeviceID]
        do {
            devices = try AudioObjectID.readDeviceList()
        } catch {
            logger.error("[CLEANUP] Failed to read device list: \(error.localizedDescription)")
            return
        }

        var destroyedCount = 0

        for device in devices {
            let transportType = device.readTransportType()
            guard transportType == .aggregate else { continue }

            guard let name = try? device.readDeviceName(),
                  let uid = try? device.readDeviceUID(),
                  ownsAggregate(name: name, uid: uid) else { continue }

            let err = AudioHardwareDestroyAggregateDevice(device)
            if err == noErr {
                destroyedCount += 1
                logger.info("[CLEANUP] Destroyed orphaned aggregate device: \(name) (ID \(device))")
            } else {
                logger.error("[CLEANUP] Failed to destroy \(name) (ID \(device)): OSStatus \(err)")
            }
        }

        if destroyedCount == 0 {
            logger.info("[CLEANUP] No orphaned Graft audio devices found")
        } else {
            logger.info("[CLEANUP] Destroyed \(destroyedCount) orphaned device(s)")
        }
    }
}
