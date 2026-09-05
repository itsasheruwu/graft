// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "GraftMac",
    // macOS 15 is the floor for Synchronization.Mutex, used by the native host.
    platforms: [.macOS(.v15)],
    products: [
        .executable(name: "Graft", targets: ["GraftMac"]),
        .executable(name: "GraftNativeHost", targets: ["GraftNativeHost"]),
    ],
    targets: [
        .target(name: "GraftCore"),
        .executableTarget(
            name: "GraftMac",
            dependencies: ["GraftCore"],
            // The app target is entirely UI-driven, so main-actor isolation is the
            // correct default. GraftCore stays nonisolated for the native host.
            swiftSettings: [.defaultIsolation(MainActor.self)]
        ),
        .executableTarget(name: "GraftNativeHost", dependencies: ["GraftCore"]),
        .testTarget(name: "GraftCoreTests", dependencies: ["GraftCore"]),
        .testTarget(name: "GraftMacTests", dependencies: ["GraftMac"]),
    ]
)
