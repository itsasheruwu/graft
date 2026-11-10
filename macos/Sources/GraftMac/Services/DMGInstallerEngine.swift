import Foundation

/// File work runs off the main actor. Never launches code from an image, runs
/// packages, replaces existing apps, or removes quarantine metadata.
nonisolated struct DMGInstallerEngine: Sendable {
    var applicationsDirectory = URL(fileURLWithPath: "/Applications", isDirectory: true)
    var detach: @Sendable (URL) throws -> Void = { volume in
        try Self.run("/usr/bin/hdiutil", ["detach", volume.path])
    }
    var trash: @Sendable (URL) throws -> Void = { file in
        try FileManager.default.trashItem(at: file, resultingItemURL: nil)
    }

    struct MountedImage: Sendable {
        let file: URL
        let volume: URL
    }

    struct Outcome: Sendable {
        let applications: [URL]
        let detail: String
        var needsCleanup = false
    }

    struct InstallError: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    static func mountedImage(for volume: URL, info: Data) throws -> MountedImage? {
        let object = try PropertyListSerialization.propertyList(from: info, format: nil)
        guard let plist = object as? [String: Any], let images = plist["images"] as? [[String: Any]] else { return nil }
        for image in images {
            // Image-building tools mount writable staging volumes under /Volumes
            // too. Those are not a user opening a finished installer image.
            guard image["writeable"] as? Bool != true else { continue }
            guard let path = image["image-path"] as? String,
                  URL(fileURLWithPath: path).pathExtension.lowercased() == "dmg",
                  let entities = image["system-entities"] as? [[String: Any]] else { continue }
            let mounts = entities.compactMap { $0["mount-point"] as? String }
            guard mounts.contains(volume.path) else { continue }
            guard mounts.count == 1 else {
                throw InstallError(message: "This DMG has multiple volumes. Install it manually; the DMG was kept.")
            }
            return MountedImage(file: URL(fileURLWithPath: path), volume: volume)
        }
        return nil
    }

    static func mountedImage(file: URL, info: Data) throws -> MountedImage? {
        let object = try PropertyListSerialization.propertyList(from: info, format: nil)
        guard let plist = object as? [String: Any], let images = plist["images"] as? [[String: Any]] else { return nil }
        for image in images {
            guard let path = image["image-path"] as? String,
                  URL(fileURLWithPath: path).resolvingSymlinksInPath() == file.resolvingSymlinksInPath(),
                  let entities = image["system-entities"] as? [[String: Any]],
                  let mount = entities.compactMap({ $0["mount-point"] as? String }).first else { continue }
            return try mountedImage(for: URL(fileURLWithPath: mount), info: info)
        }
        return nil
    }

    func install(_ image: MountedImage, trashAfterSuccess: Bool) throws -> Outcome {
        let fm = FileManager.default
        let apps = try applicationSources(on: image.volume)
        // Preflight every destination before copying anything. Existing installs
        // need an explicit manual update rather than an unattended replacement.
        for app in apps {
            let destination = applicationsDirectory.appendingPathComponent(app.lastPathComponent)
            guard !fm.fileExists(atPath: destination.path),
                  (try? destination.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink) != true else {
                throw InstallError(message: "\(app.lastPathComponent) already exists in Applications. Update it manually; the DMG was kept.")
            }
        }
        let staging = applicationsDirectory.appendingPathComponent(".graft-install-\(UUID().uuidString)", isDirectory: true)
        try fm.createDirectory(at: staging, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: staging) }
        let quarantine = try? Self.run("/usr/bin/xattr", ["-p", "com.apple.quarantine", image.file.path])
        for app in apps {
            let staged = staging.appendingPathComponent(app.lastPathComponent)
            try Self.run("/usr/bin/ditto", ["--rsrc", "--extattr", "--qtn", app.path, staged.path])
            try validateApplication(staged)
            if let quarantine, let value = String(data: quarantine, encoding: .utf8)?.trimmingCharacters(in: .newlines), !value.isEmpty {
                try Self.run("/usr/bin/xattr", ["-w", "com.apple.quarantine", value, staged.path])
            }
        }
        var installed: [URL] = []
        do {
            for app in apps {
                let destination = applicationsDirectory.appendingPathComponent(app.lastPathComponent)
                try fm.moveItem(at: staging.appendingPathComponent(app.lastPathComponent), to: destination)
                installed.append(destination)
            }
        } catch {
            for app in installed { try? fm.removeItem(at: app) }
            throw error
        }
        return try finishCleanup(image, applications: installed, trashAfterSuccess: trashAfterSuccess)
    }

    func finishCleanup(_ image: MountedImage, applications: [URL], trashAfterSuccess: Bool) throws -> Outcome {
        let fm = FileManager.default
        guard !applications.isEmpty else { throw InstallError(message: "No successful installation was recorded. The DMG was kept.") }
        for app in applications { try validateApplication(app) }
        let names = applications.map(\.lastPathComponent).joined(separator: ", ")
        do {
            // No force-eject: a busy image and its source file remain intact.
            if fm.fileExists(atPath: image.volume.path) {
                let info = try Self.run("/usr/bin/hdiutil", ["info", "-plist"])
                guard try Self.mountedImage(for: image.volume, info: info)?.file.resolvingSymlinksInPath() == image.file.resolvingSymlinksInPath() else {
                    throw InstallError(message: "The mounted image changed. Eject it manually.")
                }
                try detach(image.volume)
            }
        } catch {
            return Outcome(applications: applications, detail: "Installed \(names). Could not eject the image; the DMG was kept. \(error.localizedDescription)", needsCleanup: true)
        }
        if trashAfterSuccess {
            do {
                try trash(image.file)
                return Outcome(applications: applications, detail: "Installed \(names). Image ejected and DMG moved to Trash.")
            } catch {
                return Outcome(applications: applications, detail: "Installed \(names) and ejected the image. Could not move the DMG to Trash: \(error.localizedDescription)", needsCleanup: true)
            }
        }
        return Outcome(applications: applications, detail: "Installed \(names). Image ejected; DMG kept.")
    }

    func applicationSources(on volume: URL) throws -> [URL] {
        let children = try FileManager.default.contentsOfDirectory(
            at: volume, includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey], options: [.skipsHiddenFiles]
        )
        if children.contains(where: { ["pkg", "mpkg"].contains($0.pathExtension.lowercased()) }) {
            throw InstallError(message: "This DMG contains an installer package. Run its installer manually; the DMG was kept.")
        }
        let apps = children.filter { $0.pathExtension.lowercased() == "app" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
        guard !apps.isEmpty else {
            throw InstallError(message: "No drag-to-install app was found at the top level of this DMG. The DMG was kept.")
        }
        for app in apps { try validateApplication(app) }
        return apps
    }

    private func validateApplication(_ app: URL) throws {
        let values = try app.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard values.isDirectory == true, values.isSymbolicLink != true else {
            throw InstallError(message: "\(app.lastPathComponent) is not a regular application bundle. The DMG was kept.")
        }
        let root = app.resolvingSymlinksInPath().path + "/"
        let plistURL = app.appendingPathComponent("Contents/Info.plist")
        guard plistURL.resolvingSymlinksInPath().path.hasPrefix(root),
              let data = try? Data(contentsOf: plistURL),
              let plist = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
              plist["CFBundlePackageType"] as? String == "APPL",
              let identifier = plist["CFBundleIdentifier"] as? String, !identifier.isEmpty,
              let executable = plist["CFBundleExecutable"] as? String,
              !executable.isEmpty, executable != ".", executable != "..", !executable.contains("/") else {
            throw InstallError(message: "\(app.lastPathComponent) has invalid app metadata. The DMG was kept.")
        }
        let binary = app.appendingPathComponent("Contents/MacOS").appendingPathComponent(executable)
        guard binary.resolvingSymlinksInPath().path.hasPrefix(root), FileManager.default.isExecutableFile(atPath: binary.path) else {
            throw InstallError(message: "\(app.lastPathComponent) is missing its executable. The DMG was kept.")
        }
    }

    @discardableResult
    static func run(_ executable: String, _ arguments: [String]) throws -> Data {
        let process = Process()
        let output = Pipe()
        let errorURL = FileManager.default.temporaryDirectory.appendingPathComponent("graft-command-\(UUID().uuidString).log")
        guard FileManager.default.createFile(atPath: errorURL.path, contents: nil) else {
            throw InstallError(message: "Could not create a temporary command log. Check available disk space.")
        }
        defer { try? FileManager.default.removeItem(at: errorURL) }
        let errorOutput = try FileHandle(forWritingTo: errorURL)
        defer { try? errorOutput.close() }
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.standardOutput = output
        process.standardError = errorOutput
        process.standardInput = FileHandle.nullDevice
        try process.run()
        let timeout = DispatchWorkItem { if process.isRunning { process.terminate() } }
        DispatchQueue.global().asyncAfter(deadline: .now() + 300, execute: timeout)
        let data = output.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        timeout.cancel()
        guard process.terminationStatus == 0 else {
            let reader = try FileHandle(forReadingFrom: errorURL)
            defer { try? reader.close() }
            let reason = String(data: (try? reader.read(upToCount: 2_000)) ?? Data(), encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            throw InstallError(message: "\(URL(fileURLWithPath: executable).lastPathComponent) failed (\(process.terminationStatus)). \(reason.isEmpty ? "Check file permissions and available disk space." : reason)")
        }
        return data
    }
}
