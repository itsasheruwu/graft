import SwiftUI

extension View {
    @ViewBuilder
    func graftPrimaryButtonStyle() -> some View {
        if #available(macOS 26.0, *) {
            self.buttonStyle(.glassProminent)
        } else {
            self.buttonStyle(.borderedProminent)
        }
    }

    @ViewBuilder
    func graftSecondaryButtonStyle() -> some View {
        if #available(macOS 26.0, *) {
            self.buttonStyle(.glass)
        } else {
            self.buttonStyle(.bordered)
        }
    }

    /// Settings groups read as a single glass surface on macOS 26 and later, and fall back
    /// to the hand-drawn fill and hairline border on earlier releases.
    @ViewBuilder
    func graftCardStyle(cornerRadius: CGFloat = 12) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
        if #available(macOS 26.0, *) {
            self.glassEffect(.regular, in: shape)
        } else {
            self
                .background(Color.primary.opacity(0.055), in: shape)
                .overlay { shape.strokeBorder(.primary.opacity(0.06)) }
                .clipShape(shape)
        }
    }
}

/// Stacks sibling glass surfaces inside a `GlassEffectContainer` so they sample and blend
/// together rather than each reading the background independently.
struct GraftGlassStack<Content: View>: View {
    var spacing: CGFloat = 22
    @ViewBuilder let content: () -> Content

    var body: some View {
        if #available(macOS 26.0, *) {
            GlassEffectContainer(spacing: spacing) {
                VStack(spacing: spacing) { content() }
            }
        } else {
            VStack(spacing: spacing) { content() }
        }
    }
}
