import AppKit
import Observation
import SwiftUI

/// Graft's boundary to the MIT-licensed Bendable engine. No sensor work occurs
/// until the user enables the tweak; settings previews use a local sample image.
@MainActor @Observable
public final class GraftBendService {
    private let coordinator = AppCoordinator()
    private var running = false

    public init() {}

    public var enabled: Bool {
        get { coordinator.preferences.enabled }
        set {
            coordinator.preferences.enabled = newValue
            if newValue { startIfEnabled() }
            else {
                coordinator.applySettings()
                coordinator.stop()
                running = false
            }
        }
    }

    public func startIfEnabled() {
        guard enabled, !running else { return }
        running = true
        coordinator.start()
    }

    public var style: String {
        get { coordinator.preferences.presetID }
        set { coordinator.preferences.presetID = newValue; coordinator.applySettings() }
    }
    public var animateOpening: Bool {
        get { coordinator.preferences.animatesOpening }
        set { coordinator.preferences.animatesOpening = newValue; coordinator.applySettings() }
    }
    public var animateClosing: Bool {
        get { coordinator.preferences.animatesClosing }
        set { coordinator.preferences.animatesClosing = newValue; coordinator.applySettings() }
    }
    public var startAngle: Double {
        get { coordinator.preferences.startAngle }
        set { coordinator.preferences.startAngle = min(max(newValue, 20), 120); coordinator.applySettings() }
    }
    public var status: String {
        enabled ? coordinator.state.capability.localizedDescription : "Enable to detect this Mac’s lid sensor"
    }
    public var statusDetail: String { coordinator.state.capability.explanation }
    public var hasScreenPermission: Bool { coordinator.state.screenCaptureGranted }
    public var needsScreenPermission: Bool {
        AnimationPresetCatalog.preset(id: style).requiresScreenCapture && !hasScreenPermission
    }
    public var reducedMotion: Bool { NSWorkspace.shared.accessibilityDisplayShouldReduceMotion }
    public func refreshPermission() { coordinator.refreshScreenCapturePermission() }
    public func requestPermission() { coordinator.requestScreenCapturePermission() }
    public func preview() { coordinator.applySettings(); coordinator.runPreview() }
    public func stopPreview() {
        if !enabled { coordinator.stop() }
    }
    public func resetCalibration() { coordinator.resetCalibration() }
    public func previewView(progress: Double) -> some View {
        PresetPreview(progress: progress).environment(coordinator)
    }
}
