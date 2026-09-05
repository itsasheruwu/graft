import AppKit
import SwiftUI

/// Shared geometry so every settings surface lines up: rows, dividers, and nested
/// controls all hang off the same leading edge.
enum GraftMetrics {
    static let rowHorizontalPadding: CGFloat = 14
    static let rowVerticalPadding: CGFloat = 9
    static let chipSize: CGFloat = 28
    static let chipGap: CGFloat = 12
    static let groupSpacing: CGFloat = 20
    static let contentWidth: CGFloat = 640

    /// Where row titles start, and therefore where dividers and nested controls align.
    static let labelInset: CGFloat = rowHorizontalPadding + chipSize + chipGap
}

// MARK: - Page

/// A settings pane. The pane name already lives in the window title, so the page
/// only carries an optional one-line intro above its groups.
struct GraftSettingsPage<Content: View>: View {
    private let intro: String?
    private let content: Content

    init(intro: String? = nil, @ViewBuilder content: () -> Content) {
        self.intro = intro
        self.content = content()
    }

    var body: some View {
        ScrollView {
            GraftGlassStack(spacing: GraftMetrics.groupSpacing) {
                if let intro {
                    Text(intro)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 8)
                }
                content
            }
            .frame(maxWidth: GraftMetrics.contentWidth, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.top, 18)
            .padding(.bottom, 30)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

// MARK: - Group

/// A titled card of rows. Dividers are inserted between the rows automatically so
/// call sites never hand-place them (and never drift out of alignment).
struct GraftSettingsGroup<Content: View>: View {
    private let title: String?
    private let footer: String?
    private let footerSymbol: String?
    private let dividerInset: CGFloat
    private let content: Content

    init(
        _ title: String? = nil,
        footer: String? = nil,
        footerSymbol: String? = "info.circle",
        dividerInset: CGFloat = GraftMetrics.labelInset,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.footer = footer
        self.footerSymbol = footerSymbol
        self.dividerInset = dividerInset
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let title {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 8)
            }

            VStack(spacing: 0) {
                Group(subviews: content) { subviews in
                    ForEach(subviews.indices, id: \.self) { index in
                        if index != subviews.startIndex {
                            Divider().padding(.leading, dividerInset)
                        }
                        subviews[index]
                    }
                }
            }
            .graftCardStyle()

            if let footer {
                Label {
                    Text(footer).fixedSize(horizontal: false, vertical: true)
                } icon: {
                    if let footerSymbol { Image(systemName: footerSymbol) }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 8)
                .padding(.top, 1)
            }
        }
    }
}

/// A nested cluster of rows inside a parent group or an expanded tweak.
/// Use this for related sub-options so they read as a child of the parent
/// control, not a peer `GraftSettingsGroup`. Nested glass is avoided on
/// purpose: this sits inside an already-glassed card.
struct GraftSettingsSubGroup<Content: View>: View {
    private let title: String
    private let footer: String?
    private let dividerInset: CGFloat
    private let content: Content

    init(
        _ title: String,
        footer: String? = nil,
        dividerInset: CGFloat = GraftMetrics.rowHorizontalPadding,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.footer = footer
        self.dividerInset = dividerInset
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: "arrow.turn.down.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .labelStyle(.titleAndIcon)
                .symbolRenderingMode(.hierarchical)

            VStack(spacing: 0) {
                Group(subviews: content) { subviews in
                    ForEach(subviews.indices, id: \.self) { index in
                        if index != subviews.startIndex {
                            Divider().padding(.leading, dividerInset)
                        }
                        subviews[index]
                    }
                }
            }
            .background(Color.primary.opacity(0.045), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(.primary.opacity(0.08))
            }

            if let footer {
                Text(footer)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// A nested settings cluster that stays compact until the user asks to see its
/// rows. The binding lives at the call site so expansion state remains local to
/// the feature while this shared primitive stays presentational.
struct GraftDisclosureSubGroup<Content: View>: View {
    private let title: String
    private let footer: String?
    private let dividerInset: CGFloat
    @Binding private var isExpanded: Bool
    private let content: Content

    init(
        _ title: String,
        isExpanded: Binding<Bool>,
        footer: String? = nil,
        dividerInset: CGFloat = GraftMetrics.rowHorizontalPadding,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        _isExpanded = isExpanded
        self.footer = footer
        self.dividerInset = dividerInset
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                withAnimation(.snappy(duration: 0.2)) { isExpanded.toggle() }
            } label: {
                HStack(spacing: 7) {
                    Image(systemName: "arrow.turn.down.right")
                    Text(title)
                    Spacer()
                    GraftDisclosureChevron(isExpanded: isExpanded)
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(title)
            .accessibilityValue(isExpanded ? "Expanded" : "Collapsed")

            if isExpanded {
                VStack(spacing: 0) {
                    Group(subviews: content) { subviews in
                        ForEach(subviews.indices, id: \.self) { index in
                            if index != subviews.startIndex {
                                Divider().padding(.leading, dividerInset)
                            }
                            subviews[index]
                        }
                    }
                }
                .background(Color.primary.opacity(0.045), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .strokeBorder(.primary.opacity(0.08))
                }

                if let footer {
                    Text(footer)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

// MARK: - Rows

/// The leading icon chip shared by every row and sidebar item.
struct GraftIconChip: View {
    let symbol: String
    var tint: Color = .accentColor
    var size: CGFloat = GraftMetrics.chipSize

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
            .fill(tint.gradient)
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: symbol)
                    .font(.system(size: size * 0.43, weight: .semibold))
                    .foregroundStyle(.white)
            }
    }
}

/// Icon + title + optional detail, sized so the trailing accessory always lands on
/// the row's trailing edge.
struct GraftRowLabel: View {
    let title: String
    var detail: String?
    var symbol: String?
    var tint: Color = .accentColor

    var body: some View {
        HStack(spacing: GraftMetrics.chipGap) {
            if let symbol {
                GraftIconChip(symbol: symbol, tint: tint)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.body.weight(.medium))
                if let detail {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 8)
        }
    }
}

/// A row whose only control is a switch pinned to the trailing edge.
struct GraftToggleRow: View {
    let title: String
    var detail: String?
    var symbol: String?
    var tint: Color = .accentColor
    @Binding var isOn: Bool

    var body: some View {
        GraftRow {
            GraftRowLabel(title: title, detail: detail, symbol: symbol, tint: tint)
            Toggle("", isOn: $isOn)
                .labelsHidden()
                .toggleStyle(.switch)
                .controlSize(.small)
        }
    }
}

/// Standard row padding and hit area. Children lay out left-to-right; put a
/// `Spacer` (or a `GraftRowLabel`, which contains one) before trailing controls.
struct GraftRow<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        HStack(spacing: GraftMetrics.chipGap) {
            content
        }
        .padding(.horizontal, GraftMetrics.rowHorizontalPadding)
        .padding(.vertical, GraftMetrics.rowVerticalPadding)
        .frame(minHeight: 44)
        .contentShape(Rectangle())
    }
}

/// Right-pointing chevron that rotates open, used by rows that reveal sub-options.
struct GraftDisclosureChevron: View {
    let isExpanded: Bool

    var body: some View {
        Image(systemName: "chevron.right")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.tertiary)
            .rotationEffect(.degrees(isExpanded ? 90 : 0))
            .frame(width: 14)
            .accessibilityHidden(true)
    }
}

// MARK: - Brand

struct GraftAppIcon: View {
    let size: CGFloat

    /// Loaded once; `NSImage(contentsOf:)` on every body evaluation is needless disk work.
    private static let bundledIcon: NSImage? = {
        guard let url = Bundle.main.url(forResource: "graft-256", withExtension: "png") else { return nil }
        return NSImage(contentsOf: url)
    }()

    var body: some View {
        Group {
            if let image = Self.bundledIcon {
                Image(nsImage: image).resizable().scaledToFit()
            } else {
                Image(systemName: "leaf.fill")
                    .resizable().scaledToFit()
                    .padding(size * 0.22)
                    .foregroundStyle(GraftTheme.green)
            }
        }
        .frame(width: size, height: size)
        .background(GraftTheme.navy, in: RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
        .shadow(color: .black.opacity(0.18), radius: 2, y: 1)
    }
}

/// Shared, presentational search control for local activity histories.
struct GraftHistorySearchField: View {
    @Binding var text: String
    let prompt: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
            TextField(prompt, text: $text)
                .textFieldStyle(.plain)
                .accessibilityLabel(prompt)
            if !text.isEmpty {
                Button("Clear search", systemImage: "xmark.circle.fill") { text = "" }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .background(Color.primary.opacity(0.045), in: RoundedRectangle(cornerRadius: 8))
        .overlay { RoundedRectangle(cornerRadius: 8).strokeBorder(.primary.opacity(0.08)) }
    }
}
