import AppKit
import SwiftUI

/// SwiftUI does not expose AppKit's focus-ring setting. Installed once at the
/// app root, this bridge removes the blue halo from every native text field
/// while preserving first-responder state, selection, and the insertion point.
struct GraftTextFieldFocusRingConfigurator: NSViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        context.coordinator.attach(to: view)
        return view
    }

    func updateNSView(_ view: NSView, context: Context) {
        context.coordinator.attach(to: view)
    }

    final class Coordinator {
        private weak var window: NSWindow?
        private var observers: [NSObjectProtocol] = []

        func attach(to view: NSView) {
            DispatchQueue.main.async { [weak self, weak view] in
                guard let self, let view, let window = view.window else { return }
                if self.window !== window {
                    self.removeObservers()
                    self.window = window
                    let center = NotificationCenter.default
                    for name in [NSWindow.didUpdateNotification, NSWindow.didBecomeKeyNotification] {
                        observers.append(center.addObserver(forName: name, object: window, queue: .main) { [weak self] _ in
                            Task { @MainActor in self?.configureWindow() }
                        })
                    }
                }
                self.configureWindow()
            }
        }

        private func configureWindow() {
            guard let window else { return }
            window.contentView?.setGraftTextFieldFocusRingsHidden()
            for item in window.toolbar?.items ?? [] {
                if let searchItem = item as? NSSearchToolbarItem {
                    searchItem.searchField.focusRingType = .none
                }
                item.view?.setGraftTextFieldFocusRingsHidden()
            }
        }

        private func removeObservers() {
            observers.forEach(NotificationCenter.default.removeObserver)
            observers.removeAll()
        }
    }
}

private extension NSView {
    func setGraftTextFieldFocusRingsHidden() {
        if let textField = self as? NSTextField {
            textField.focusRingType = .none
        }
        subviews.forEach { $0.setGraftTextFieldFocusRingsHidden() }
    }
}
