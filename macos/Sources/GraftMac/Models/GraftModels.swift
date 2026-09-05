import Foundation
import GraftCore

enum AppDestination: String, CaseIterable, Identifiable {
    case web = "Web Extension"
    case mac = "Mac Tweaks"
    case connection = "Connection"

    var id: String { rawValue }
    var icon: String {
        switch self {
        case .web: "safari"
        case .mac: "macbook"
        case .connection: "cable.connector"
        }
    }
}

enum TweakControlKind: Sendable {
    case toggle
    case slider(range: ClosedRange<Double>, step: Double, suffix: String)
    case picker(options: [(value: String, label: String)])
}

struct TweakControlDefinition: Identifiable, Sendable {
    let id: String
    let label: String
    let defaultValue: JSONValue
    let kind: TweakControlKind
    let nested: Bool

    init(_ id: String, _ label: String, default defaultValue: JSONValue, kind: TweakControlKind = .toggle, nested: Bool = false) {
        self.id = id
        self.label = label
        self.defaultValue = defaultValue
        self.kind = kind
        self.nested = nested
    }
}

struct BrowserTweakDefinition: Identifiable, Sendable {
    let id: String
    let name: String
    let category: String
    let summary: String
    let controls: [TweakControlDefinition]

    var primaryKey: String { controls[0].id }
}

enum BrowserTweakCatalog {
    static let tweaks: [BrowserTweakDefinition] = [
        .init(id: "force-dark-mode", name: "Force Dark Mode", category: "Appearance", summary: "Apply balanced dark styling to unsupported sites", controls: [
            .init("forceDarkModeEnabled", "Enable Force Dark Mode", default: .bool(false)),
        ]),
        .init(id: "theme-syncer", name: "Theme Syncer", category: "Appearance", summary: "Match page themes to your Mac appearance", controls: [
            .init("themeSyncerEnabled", "Enable Theme Syncer", default: .bool(true)),
            .init("themeSyncerYoutubeEnabled", "Sync YouTube", default: .bool(true), nested: true),
        ]),
        .init(id: "graft-ai-rewriter", name: "AI Rewriter", category: "Customization", summary: "Reflow, restyle, and save site-specific versions", controls: [
            .init("graftAiRewriterEnabled", "Enable AI Rewriter", default: .bool(true)),
        ]),
        .init(id: "asset-finder", name: "Asset Finder", category: "Media", summary: "Browse visible media assets on the current page", controls: [
            .init("assetFinderEnabled", "Enable Asset Finder", default: .bool(true)),
            .init("assetFinderHideBlankAssets", "Hide blank assets", default: .bool(false), nested: true),
        ]),
        .init(id: "sound-booster", name: "Sound Booster", category: "Media", summary: "Boost regular HTML5 audio and video volume", controls: [
            .init("soundBoosterEnabled", "Enable Sound Booster", default: .bool(false)),
            .init("soundBoosterGain", "Boost", default: .number(1.5), kind: .slider(range: 1...5, step: 0.25, suffix: "×"), nested: true),
        ]),
        .init(id: "element-selector", name: "Element Selector", category: "Page Tools", summary: "Hide and inspect page elements with hover actions", controls: [
            .init("elementSelectorEnabled", "Enable selector mode", default: .bool(false)),
        ]),
        .init(id: "scroll-to-top", name: "Scroll to Top", category: "Page Tools", summary: "Add a floating shortcut on long pages", controls: [
            .init("scrollToTopEnabled", "Enable Scroll to Top", default: .bool(false)),
        ]),
        .init(id: "roblox-player-watcher", name: "Roblox Player Watcher", category: "Roblox", summary: "Get alerts when watched players change status", controls: [
            .init("robloxPlayerWatcherEnabled", "Enable Player Watcher", default: .bool(false)),
            .init("robloxPlayerWatcherNotifyOnline", "Notify when online", default: .bool(true), nested: true),
            .init("robloxPlayerWatcherNotifyOffline", "Notify when offline", default: .bool(true), nested: true),
            .init("robloxPlayerWatcherNotifyJoinGame", "Notify when joining a game", default: .bool(true), nested: true),
            .init("robloxPlayerWatcherAntiSpamEnabled", "Reduce notification spam", default: .bool(true), nested: true),
            .init("robloxPlayerWatcherShowExactGame", "Show exact game", default: .bool(false), nested: true),
        ]),
        .init(id: "wikipedia-enhancements", name: "Wikipedia Enhancements", category: "Wikipedia", summary: "Tune article layout and navigation", controls: [
            .init("wikipediaEnhancementsEnabled", "Enable Wikipedia Enhancements", default: .bool(false)),
            .init("wikipediaReadingWidthEnabled", "Comfortable reading width", default: .bool(false), nested: true),
            .init("wikipediaNavigationCleanupEnabled", "Clean up navigation", default: .bool(false), nested: true),
            .init("wikipediaCollapseReferencesEnabled", "Collapse references", default: .bool(false), nested: true),
            .init("wikipediaFloatingTocEnabled", "Floating table of contents", default: .bool(false), nested: true),
            .init("wikipediaSearchHighlightEnabled", "Highlight search terms", default: .bool(false), nested: true),
            .init("wikipediaHideDonationBannersEnabled", "Hide fundraising banners", default: .bool(false), nested: true),
        ]),
        .init(id: "x-quiet-feed", name: "X Quiet Feed", category: "X", summary: "Hide promotions and recommendation clutter", controls: [
            .init("xQuietFeedEnabled", "Enable X Quiet Feed", default: .bool(false)),
        ]),
        .init(id: "youtube-auto-translate", name: "YouTube Auto Translation", category: "YouTube", summary: "Translate titles and descriptions", controls: [
            .init("youtubeAutoTranslateEnabled", "Enable Auto Translation", default: .bool(true)),
            .init("youtubeAutoTranslateTitlesEnabled", "Translate titles", default: .bool(true), nested: true),
            .init("youtubeAutoTranslateDescriptionsEnabled", "Translate descriptions", default: .bool(true), nested: true),
            .init("youtubeAutoTranslateTargetMode", "Target language", default: .string("auto"), kind: .picker(options: [("auto", "Browser language"), ("manual", "English")]), nested: true),
        ]),
    ]

    static let categories: [String] = {
        var seen = Set<String>()
        return tweaks.compactMap { seen.insert($0.category).inserted ? $0.category : nil }
    }()

    static var defaults: [String: JSONValue] {
        Dictionary(uniqueKeysWithValues: tweaks.flatMap(\.controls).map { ($0.id, $0.defaultValue) })
    }
}
