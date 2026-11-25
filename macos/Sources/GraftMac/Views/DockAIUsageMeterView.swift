import AppKit

final class DockAIUsageMeterView: NSView {
    private var provider: DockAIProvider?
    private var usage: DockAIUsageWindow?
    private var countdown: String?

    override var isFlipped: Bool { true }

    func update(provider: DockAIProvider, window: DockAIUsageWindow, countdown: String?) {
        guard self.provider != provider || self.usage != window || self.countdown != countdown else { return }
        self.provider = provider
        self.usage = window
        self.countdown = countdown
        needsDisplay = true
    }

    override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        needsDisplay = true
    }

    override func draw(_ dirtyRect: NSRect) {
        guard let usage, let provider else { return }
        let side = min(bounds.width, bounds.height) * 0.84
        guard side >= 12 else { return }
        let icon = CGRect(x: bounds.midX - side / 2, y: bounds.midY - side / 2, width: side, height: side)
        NSGraphicsContext.saveGraphicsState()
        defer { NSGraphicsContext.restoreGraphicsState() }
        NSBezierPath(roundedRect: icon, xRadius: side * 0.23, yRadius: side * 0.23).addClip()

        let tint: NSColor
        switch provider {
        case .codex: tint = NSColor(srgbRed: 0.14, green: 0.65, blue: 0.85, alpha: 1)
        case .claude: tint = NSColor(srgbRed: 0.97, green: 0.42, blue: 0.19, alpha: 1)
        case .cursor: tint = NSColor(srgbRed: 0.53, green: 0.43, blue: 0.91, alpha: 1)
        }

        let fill = min(100, CGFloat(usage.percentUsed)) / 100
        if fill > 0 {
            let waterline = icon.maxY - side * fill
            let amplitude = min(side * 0.035, side * fill / 2, side * (1 - fill) / 2)
            let wave = NSBezierPath()
            wave.move(to: CGPoint(x: icon.minX, y: waterline))
            wave.curve(
                to: CGPoint(x: icon.maxX, y: waterline),
                controlPoint1: CGPoint(x: icon.minX + side * 0.32, y: waterline - amplitude * 2),
                controlPoint2: CGPoint(x: icon.minX + side * 0.68, y: waterline + amplitude * 2)
            )
            tint.withAlphaComponent(0.9).setStroke()
            wave.lineWidth = max(0.6, side * 0.016)
            wave.stroke()
            wave.line(to: CGPoint(x: icon.maxX, y: icon.maxY))
            wave.line(to: CGPoint(x: icon.minX, y: icon.maxY))
            wave.close()
            NSGradient(starting: tint.withAlphaComponent(0.55), ending: tint.withAlphaComponent(0.75))?
                .draw(in: wave, angle: 90)
        }

        let padding = side * 0.055
        drawLabel(usage.percentageLabel, size: max(7, side * 0.27), padding: padding) { size in
            CGPoint(x: icon.midX - size.width / 2, y: icon.maxY - padding - size.height)
        }
        if let countdown, side >= 23 {
            drawLabel(countdown, size: max(6, side * 0.16), padding: padding) { size in
                CGPoint(x: icon.midX - size.width / 2, y: icon.minY + padding)
            }
        }
    }

    private func drawLabel(_ label: String, size: CGFloat, padding: CGFloat, position: (CGSize) -> CGPoint) {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedDigitSystemFont(ofSize: size, weight: .bold),
            .foregroundColor: NSColor.white,
        ]
        let text = NSAttributedString(string: label, attributes: attributes)
        let labelSize = CGSize(width: ceil(text.size().width) + 2 * padding, height: ceil(text.size().height))
        let background = CGRect(origin: position(labelSize), size: labelSize)
        NSColor.black.withAlphaComponent(0.68).setFill()
        NSBezierPath(roundedRect: background, xRadius: padding, yRadius: padding).fill()
        text.draw(at: CGPoint(x: background.minX + padding, y: background.minY))
    }
}
