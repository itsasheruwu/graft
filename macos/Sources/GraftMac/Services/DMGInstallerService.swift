import AppKit
import GraftCore
import Observation

@Observable
final class DMGInstallerService: NSObject {
    private(set) var isEnabled = false
    private(set) var isInstalling = false
    private(set) var status = "Off"
    private(set) var detail = "Open a DMG while Graft is running to install its apps into Applications."
    private var trashAfterSuccess = false
    private var pendingVolumes: [URL] = []
    private var handledVolumes: Set<URL> = []
    private var activeVolume: URL?
    private var generation = 0
    @ObservationIgnored private var worker: Task<Void, Never>?
    @ObservationIgnored private let activity: GraftActivityStore?

    init(activity: GraftActivityStore? = nil) {
        self.activity = activity
        super.init()
        NSWorkspace.shared.notificationCenter.addObserver(
            self, selector: #selector(didMount(_:)), name: NSWorkspace.didMountNotification, object: nil
        )
        NSWorkspace.shared.notificationCenter.addObserver(
            self, selector: #selector(didUnmount(_:)), name: NSWorkspace.didUnmountNotification, object: nil
        )
    }

    deinit { NSWorkspace.shared.notificationCenter.removeObserver(self) }

    func apply(_ settings: MacSettings) {
        trashAfterSuccess = settings.dmgAutoInstallTrashAfterSuccess
        guard isEnabled != settings.dmgAutoInstallEnabled else { return }
        isEnabled = settings.dmgAutoInstallEnabled
        generation += 1
        if !isEnabled { pendingVolumes.removeAll() }
        if !isInstalling { status = isEnabled ? "Ready" : "Off" }
    }

    @objc private func didMount(_ notification: Notification) {
        guard isEnabled, let volume = notification.userInfo?[NSWorkspace.volumeURLUserInfoKey] as? URL,
              volume.deletingLastPathComponent().path == "/Volumes",
              volume != activeVolume, !handledVolumes.contains(volume) else { return }
        handledVolumes.insert(volume)
        pendingVolumes.append(volume)
        startNext()
    }

    @objc private func didUnmount(_ notification: Notification) {
        if let volume = notification.userInfo?[NSWorkspace.volumeURLUserInfoKey] as? URL {
            handledVolumes.remove(volume)
        }
    }

    func retry(file: URL) async throws {
        guard isEnabled else { throw DMGInstallerEngine.InstallError(message: "Enable Auto-install DMGs in Mac Tweaks before retrying.") }
        guard !isInstalling, worker == nil else { throw DMGInstallerEngine.InstallError(message: "Another installation is still running.") }
        guard file.isFileURL, file.pathExtension.lowercased() == "dmg", FileManager.default.fileExists(atPath: file.path) else {
            throw DMGInstallerEngine.InstallError(message: "The DMG is no longer at its original location. Open the DMG from Finder to try again.")
        }
        let mounted = try await Task.detached {
            try DMGInstallerEngine.mountedImage(file: file, info: DMGInstallerEngine.run("/usr/bin/hdiutil", ["info", "-plist"]))
        }.value
        if let mounted {
            handledVolumes.insert(mounted.volume)
            pendingVolumes.append(mounted.volume)
            startNext()
        } else if !NSWorkspace.shared.open(file) {
            throw DMGInstallerEngine.InstallError(message: "macOS could not open this DMG. Try opening it in Finder.")
        }
    }

    func retryCleanup(file: URL, volume: URL, applications: [URL], trash: Bool) async throws {
        guard !isInstalling, worker == nil else { throw DMGInstallerEngine.InstallError(message: "Another installation is still running.") }
        isInstalling = true
        defer { isInstalling = false; startNext() }
        let image = DMGInstallerEngine.MountedImage(file: file, volume: volume)
        let outcome = try await Task.detached { try DMGInstallerEngine().finishCleanup(image, applications: applications, trashAfterSuccess: trash) }.value
        detail = outcome.detail
        status = outcome.needsCleanup ? "Needs attention" : "Installed"
        record(outcome, image: image, trash: trash)
    }

    private func record(_ outcome: DMGInstallerEngine.Outcome, image: DMGInstallerEngine.MountedImage, trash: Bool) {
        activity?.record(.installs, outcome.needsCleanup ? .warning : .success, outcome.needsCleanup ? "DMG cleanup needs attention" : "DMG installation finished", outcome.detail,
            retry: outcome.needsCleanup ? .cleanupDMG(file: image.file, volume: image.volume, applications: outcome.applications, trash: trash) : nil)
    }

    private func startNext() {
        guard worker == nil, !isInstalling, isEnabled, !pendingVolumes.isEmpty else { return }
        let volume = pendingVolumes.removeFirst()
        activeVolume = volume
        let currentGeneration = generation
        worker = Task { [weak self] in
            guard let self else { return }
            defer {
                self.worker = nil
                self.activeVolume = nil
                self.isInstalling = false
                if !self.isEnabled { self.status = "Off" }
                self.startNext()
            }
            var sourceFile: URL?
            do {
                // Mount notifications can precede hdiutil's image inventory.
                var mounted: DMGInstallerEngine.MountedImage?
                for attempt in 0..<3 {
                    mounted = try await Task.detached {
                        let info = try DMGInstallerEngine.run("/usr/bin/hdiutil", ["info", "-plist"])
                        return try DMGInstallerEngine.mountedImage(for: volume, info: info)
                    }.value
                    if mounted != nil { break }
                    if attempt < 2 { try await Task.sleep(for: .milliseconds(350)) }
                }
                guard let mounted, self.isEnabled, self.generation == currentGeneration else { return }
                sourceFile = mounted.file
                let attributes = try FileManager.default.attributesOfItem(atPath: mounted.file.path)
                guard (attributes[.ownerAccountID] as? NSNumber)?.uint32Value == getuid(),
                      !mounted.file.path.hasPrefix("/System/"), !mounted.file.path.hasPrefix("/Library/") else { return }
                self.isInstalling = true
                self.status = "Installing"
                self.detail = "Installing from \(mounted.file.lastPathComponent)…"
                self.activity?.record(.installs, .info, "DMG installation started", mounted.file.lastPathComponent)
                let trash = self.trashAfterSuccess
                let outcome = try await Task.detached {
                    try DMGInstallerEngine().install(mounted, trashAfterSuccess: trash)
                }.value
                self.status = outcome.needsCleanup ? "Needs attention" : "Installed"
                self.detail = outcome.detail
                self.record(outcome, image: mounted, trash: trash)
            } catch {
                self.status = "Needs attention"
                self.detail = error.localizedDescription
                self.activity?.record(.installs, .failure, "DMG installation failed", error.localizedDescription, retry: sourceFile.map(ActivityRetry.installDMG))
            }
        }
    }
}
