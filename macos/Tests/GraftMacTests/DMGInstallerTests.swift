import Foundation
import GraftCore
import Testing
@testable import GraftMac

@Suite(.serialized)
nonisolated struct DMGInstallerTests {
    private func workspace() throws -> URL {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("graft-dmg-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }

    @discardableResult
    private func makeApp(in directory: URL, name: String = "Fixture.app") throws -> URL {
        let app = directory.appendingPathComponent(name)
        let binaries = app.appendingPathComponent("Contents/MacOS")
        try FileManager.default.createDirectory(at: binaries, withIntermediateDirectories: true)
        let plist: [String: String] = [
            "CFBundlePackageType": "APPL", "CFBundleIdentifier": "com.graft.dmg-test",
            "CFBundleExecutable": "fixture", "CFBundleName": "DMG Test"
        ]
        try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
            .write(to: app.appendingPathComponent("Contents/Info.plist"))
        let executable = binaries.appendingPathComponent("fixture")
        try Data("#!/bin/sh\nexit 0\n".utf8).write(to: executable)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: executable.path)
        return app
    }

    private func mountFixture(at root: URL) throws -> DMGInstallerEngine.MountedImage {
        let source = root.appendingPathComponent("Source")
        try FileManager.default.createDirectory(at: source, withIntermediateDirectories: true)
        try makeApp(in: source)
        try FileManager.default.createSymbolicLink(at: source.appendingPathComponent("Applications"), withDestinationURL: URL(fileURLWithPath: "/Applications"))
        let image = root.appendingPathComponent("Graft Test \(UUID().uuidString).dmg")
        try DMGInstallerEngine.run("/usr/bin/hdiutil", ["create", "-srcfolder", source.path, "-volname", "Graft DMG Test", "-format", "UDZO", image.path])
        try DMGInstallerEngine.run("/usr/bin/xattr", ["-w", "com.apple.quarantine", "0081;67500000;GraftTest;", image.path])
        // A private mount point keeps a running Graft instance from treating the
        // test image as a real user install under /Volumes.
        let mountPoint = root.appendingPathComponent("Mounted")
        let attached = try DMGInstallerEngine.run("/usr/bin/hdiutil", ["attach", "-readonly", "-nobrowse", "-noautoopen", "-mountpoint", mountPoint.path, "-plist", image.path])
        let plist = try #require(PropertyListSerialization.propertyList(from: attached, format: nil) as? [String: Any])
        let entities = try #require(plist["system-entities"] as? [[String: Any]])
        let mount = try #require(entities.compactMap { $0["mount-point"] as? String }.first)
        return .init(file: image, volume: URL(fileURLWithPath: mount))
    }

    private func destination(in root: URL) throws -> URL {
        let url = root.appendingPathComponent("Installed Apps")
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    @Test func legacySettingsDecodeWithBothOptionsOffAndRoundTrip() throws {
        var settings = try JSONDecoder().decode(MacSettings.self, from: Data("{}".utf8))
        #expect(!settings.dmgAutoInstallEnabled)
        #expect(!settings.dmgAutoInstallTrashAfterSuccess)
        settings.dmgAutoInstallEnabled = true
        settings.dmgAutoInstallTrashAfterSuccess = true
        #expect(try JSONDecoder().decode(MacSettings.self, from: JSONEncoder().encode(settings)) == settings)
    }

    @Test func realImageInstallsPreservesQuarantineEjectsAndKeepsDMG() throws {
        let root = try workspace()
        defer { try? FileManager.default.removeItem(at: root) }
        let image = try mountFixture(at: root)
        defer { _ = try? DMGInstallerEngine.run("/usr/bin/hdiutil", ["detach", image.volume.path]) }
        let info = try DMGInstallerEngine.run("/usr/bin/hdiutil", ["info", "-plist"])
        #expect(try DMGInstallerEngine.mountedImage(for: image.volume, info: info)?.file == image.file)
        let target = try destination(in: root)
        let result = try DMGInstallerEngine(applicationsDirectory: target).install(image, trashAfterSuccess: false)
        #expect(result.applications.count == 1)
        let app = try #require(result.applications.first)
        #expect(FileManager.default.isExecutableFile(atPath: app.appendingPathComponent("Contents/MacOS/fixture").path))
        #expect(try String(data: DMGInstallerEngine.run("/usr/bin/xattr", ["-p", "com.apple.quarantine", app.path]), encoding: .utf8)?.contains("GraftTest") == true)
        #expect(!FileManager.default.fileExists(atPath: image.volume.path))
        #expect(FileManager.default.fileExists(atPath: image.file.path))
        #expect(try FileManager.default.contentsOfDirectory(atPath: target.path) == ["Fixture.app"])
    }

    @Test func cleanupRunsOnlyAfterInstallationAndEjection() throws {
        let root = try workspace()
        defer { try? FileManager.default.removeItem(at: root) }
        let image = try mountFixture(at: root)
        defer { _ = try? DMGInstallerEngine.run("/usr/bin/hdiutil", ["detach", image.volume.path]) }
        let target = try destination(in: root)
        // Keep the real source out of the user's Trash, while checking the exact
        // cleanup ordering at the injected filesystem boundary.
        let engine = DMGInstallerEngine(applicationsDirectory: target, trash: { file in
            #expect(file == image.file)
            #expect(!FileManager.default.fileExists(atPath: image.volume.path))
            #expect(FileManager.default.fileExists(atPath: target.appendingPathComponent("Fixture.app").path))
            try FileManager.default.moveItem(at: file, to: root.appendingPathComponent("Trashed.dmg"))
        })
        let result = try engine.install(image, trashAfterSuccess: true)
        #expect(result.detail.contains("moved to Trash"))
        #expect(!FileManager.default.fileExists(atPath: image.file.path))
        #expect(FileManager.default.fileExists(atPath: root.appendingPathComponent("Trashed.dmg").path))
    }

    @Test func failedEjectionKeepsSourceAndSuccessfulInstallation() throws {
        let root = try workspace()
        defer { try? FileManager.default.removeItem(at: root) }
        let image = try mountFixture(at: root)
        defer { _ = try? DMGInstallerEngine.run("/usr/bin/hdiutil", ["detach", image.volume.path]) }
        let engine = DMGInstallerEngine(applicationsDirectory: try destination(in: root), detach: { _ in
            throw DMGInstallerEngine.InstallError(message: "Image is busy")
        }, trash: { _ in Issue.record("Must not trash an image that failed to eject") })
        let result = try engine.install(image, trashAfterSuccess: true)
        #expect(result.detail.contains("DMG was kept"))
        #expect(FileManager.default.fileExists(atPath: image.file.path))
        #expect(FileManager.default.fileExists(atPath: result.applications[0].path))
    }

    @Test func existingAppPreventsAnyInstallOrCleanup() throws {
        let root = try workspace()
        defer { try? FileManager.default.removeItem(at: root) }
        let source = root.appendingPathComponent("Source")
        try FileManager.default.createDirectory(at: source, withIntermediateDirectories: true)
        try makeApp(in: source, name: "A New.app")
        try makeApp(in: source, name: "Z Existing.app")
        let target = try destination(in: root)
        let existing = try makeApp(in: target, name: "Z Existing.app")
        try Data("original".utf8).write(to: existing.appendingPathComponent("marker"))
        let engine = DMGInstallerEngine(applicationsDirectory: target,
            detach: { _ in Issue.record("Must not eject after a collision") },
            trash: { _ in Issue.record("Must not trash after a collision") })
        #expect(throws: DMGInstallerEngine.InstallError.self) {
            try engine.install(.init(file: root.appendingPathComponent("Keep.dmg"), volume: source), trashAfterSuccess: true)
        }
        #expect(!FileManager.default.fileExists(atPath: target.appendingPathComponent("A New.app").path))
        #expect(try String(contentsOf: existing.appendingPathComponent("marker"), encoding: .utf8) == "original")
    }

    @Test func packagesSymlinksAndInvalidBundlesAreRejected() throws {
        let root = try workspace()
        defer { try? FileManager.default.removeItem(at: root) }
        let engine = DMGInstallerEngine()
        let outside = try makeApp(in: root, name: "Outside.app")
        let source = root.appendingPathComponent("Source")
        try FileManager.default.createDirectory(at: source, withIntermediateDirectories: true)
        let link = source.appendingPathComponent("Link.app")
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: outside)
        #expect(throws: DMGInstallerEngine.InstallError.self) { try engine.applicationSources(on: source) }
        try FileManager.default.removeItem(at: link)
        let app = try makeApp(in: source)
        try Data().write(to: source.appendingPathComponent("Setup.pkg"))
        #expect(throws: DMGInstallerEngine.InstallError.self) { try engine.applicationSources(on: source) }
        try FileManager.default.removeItem(at: source.appendingPathComponent("Setup.pkg"))
        try FileManager.default.removeItem(at: app.appendingPathComponent("Contents/MacOS/fixture"))
        #expect(throws: DMGInstallerEngine.InstallError.self) { try engine.applicationSources(on: source) }
    }

    @Test func unrelatedVolumesAndMultiVolumeImagesAreNotInstalled() throws {
        let info: [String: Any] = ["images": [["image-path": "/tmp/example.dmg", "system-entities": [["mount-point": "/Volumes/One"], ["mount-point": "/Volumes/Two"]]]]]
        let data = try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0)
        #expect(try DMGInstallerEngine.mountedImage(for: URL(fileURLWithPath: "/Volumes/USB"), info: data) == nil)
        #expect(throws: DMGInstallerEngine.InstallError.self) { try DMGInstallerEngine.mountedImage(for: URL(fileURLWithPath: "/Volumes/One"), info: data) }
    }

    @Test func writableImageCreationMountsAreIgnored() throws {
        let info: [String: Any] = ["images": [["image-path": "/tmp/Building.dmg", "writeable": true, "system-entities": [["mount-point": "/Volumes/Building"]]]]]
        let data = try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0)
        #expect(try DMGInstallerEngine.mountedImage(for: URL(fileURLWithPath: "/Volumes/Building"), info: data) == nil)
    }
}
