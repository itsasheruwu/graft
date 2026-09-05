<p align="center">
  <img src=".github/brand/logo.png" alt="Graft logo" width="120" />
</p>

<h1 align="center">Graft</h1>

<p align="center">
  <strong>Small fixes, grafted onto the web.</strong><br />
  <sub>Browser customization, native Mac controls, and activity notifications.</sub>
</p>

<p align="center">
  <a href="https://github.com/itsasheruwu/graft/actions/workflows/ci.yml"><img src="https://github.com/itsasheruwu/graft/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

<p align="center">
  The complete Graft project: Chrome extension, macOS app, native messaging bridge, local AI helper, and website.
</p>

[Website & interactive preview](https://itsasheruwu.github.io/graft/) · [Browser setup](#install) · [Mac setup](macos/README.md)

## The project

| Component | What it provides | Source |
|---|---|---|
| Chrome extension | Eleven browser tweaks, popup, full settings, and saved page edits | [`src/`](src/) |
| Mac app | SwiftUI window, menu bar, Mac controls, Roblox and Spotify activity | [`macos/`](macos/) |
| Native messaging host | Settings exchange between Chrome and the Mac app | [`GraftNativeHost`](macos/Sources/GraftNativeHost/) |
| Shared native core | Settings model and bridge protocol | [`GraftCore`](macos/Sources/GraftCore/) |
| Local AI helper | Optional Codex-powered page rewrite recipes | [`tools/`](tools/) |
| Website | GitHub Pages site and actual browser UI demo | [`website/`](website/) |

Both apps are available from source. There is no Chrome Web Store listing or packaged Mac release yet. The native companion is development software; see its [current limitations](macos/README.md#development-status).

## Tweaks

Settings in the popup and options pages are grouped by topic. Each category collapses independently; tweaks inside are sorted A–Z.

| Category | Tweak | What it does |
|----------|-------|----------------|
| **Appearance** | Theme Syncer | Mirrors your system light/dark preference on supported pages. YouTube gets dedicated handling (nested toggle + per-site blocklist). |
| **Appearance** | Force Dark Mode | Applies a balanced dark palette on sites without native dark themes. Per-site blocklist supported. |
| **Customization** | AI Rewriter | Optional local Codex helper for turning a plain-English page rewrite prompt into previewed, safe Element Selector recipes. Recipes persist per domain after approval. |
| **Media** | Asset Finder | Scans the current page for visible images and media; browse them in an in-page panel. |
| **Media** | Sound Booster | Boosts HTML5 audio and video volume with a global gain control. Per-site blocklist supported. |
| **Page tools** | Element Selector | Hover and hide page elements. Removals persist per domain even when selector mode is off. Export/import, undo, and bulk unhide supported. Shortcut: `Alt+Shift+E`. |
| **Page tools** | Scroll to Top | Floating button to jump back to the top of long pages. Per-site blocklist supported. |
| **Roblox** | Roblox Player Watcher | Whitelist Roblox players and get desktop notifications when they come online, go offline, or join a game. Graft for Mac watches when available; otherwise Chrome watches in the background without a Roblox tab. |
| **Wikipedia** | Wikipedia Enhancements | Tune article width, hide navigation clutter, collapse references, add a floating table of contents, highlight search terms, and hide fundraising banners on article pages. |
| **X** | X Quiet Feed | Hide promoted posts and recommendation modules on X without changing posts or account controls. |
| **YouTube** | YouTube Auto Translation | Translates foreign video titles and descriptions into your browser language (or a fixed target language). Skips low-confidence detections; original text preserved on hover. |

Open the toolbar popup for quick toggles, or **All settings** for the full options page. Hidden elements and saved text rewrites are managed at `edited-list.html`.

## Install

Requires Chrome 111+ and Node.js 22.12+ with npm.

```bash
git clone https://github.com/itsasheruwu/graft.git
cd graft
npm ci
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the **`dist/`** folder

After code changes, run `npm run build` again (or `npm run watch`) and click **Reload** on the extension card.

## Development

```bash
npm ci
npm run build      # production build → dist/
npm run watch      # rebuild dist/ on file changes
npm test           # Vitest unit tests for shared libs
npm run dev        # Vite preview of popup UI only (not full extension)
```

Open `gallery.html` via `npm run dev` (or load it from `dist/` after build) to preview Graft UI primitives and the grouped tweak-category accordion layout.

### macOS companion

The native companion in `macos/` provides extension controls in a standalone
SwiftUI window and menu bar menu, plus Mac controls and activity integrations. Requires **macOS 15+ and Xcode 26+ (Swift 6.2)**. See [native setup and architecture](macos/README.md). Run it
from Codex's **Run** action or with:

```bash
./script/build_and_run.sh --verify
```

Time Sensitive notifications require Apple's restricted notification entitlement.
For a provisioned test build, set `GRAFT_CODESIGN_IDENTITY` and
`GRAFT_PROVISIONING_PROFILE` to a matching signing identity and profile before
running the script; otherwise it produces a runnable ad-hoc build and macOS may
downgrade those alerts to ordinary notifications.

To connect Chrome, open the app's **Connection** screen, paste Graft's ID from
`chrome://extensions`, install the bridge, and reload the extension. The bridge
only exchanges Graft setting keys; it does not read browsing history or pages.

### Local AI helper

AI Rewriter requires a local helper process. It does not put an OpenAI API key in the extension.

```bash
npm run ai-helper
```

Copy the printed token into **Element Selector -> AI Rewriter** in the popup or options page. The helper listens on `127.0.0.1:27491` by default, spawns `codex app-server` over stdio, and requests `gpt-5.5` with medium reasoning. Approved recipes are stored in `chrome.storage.local` under `graftAiRecipesByDomain`.

### Adding a tweak

1. Register the tweak in [`src/tweaks/registry.js`](src/tweaks/registry.js) (entrypoints, match patterns, storage keys, UI keys, and `ui.category`).
2. Implement scripts under `src/tweaks/<id>/`.
3. Add React settings in `src/components/tweaks/` and register the entry in [`src/lib/tweak-catalog.ts`](src/lib/tweak-catalog.ts) (category, labels, badge key, settings component). Popup and options pages render from the catalog via `TweakSettingsList`.
4. Run `npm run build` — Vite generates `dist/manifest.json` `content_scripts` and copies tweak assets from the registry.

Bridge + MAIN-world pairs are required when page DOM must be touched; isolated scripts own `chrome.storage` I/O.

**Categories** (sorted A–Z in the UI): `appearance`, `customization`, `media`, `page-tools`, `roblox`, `wikipedia`, `x`, `youtube`.

### Project layout

| Path | Role |
|------|------|
| `src/tweaks/registry.js` | Single source of truth for shipped tweaks |
| `src/lib/tweak-catalog.ts` | Popup/options tweak list — categories, sort order, settings wiring |
| `src/build/registry-build.mjs` | Manifest content_scripts + dist copy list |
| `src/background/service_worker.js` | Defaults, migrations, translate API queue |
| `popup.html` / `options.html` / `edited-list.html` / `gallery.html` | Vite React entry pages |

## Privacy

- The Mac app stores its settings, activity logs, and Spotify listening history in local Application Support. Optional Spotify integration reads friend activity through a local Spicetify bridge. Listening history is not uploaded or synced by Graft.

- **Theme Syncer**, **Force Dark Mode**, **Element Selector**, **Asset Finder**, **Sound Booster**, and **Wikipedia Enhancements** run locally in your browser. Hides, layout preferences, and blocklists are stored in extension storage on your device.
- **AI Rewriter** sends bounded page context and your prompt to the local `graft-ai-helper`; the helper uses your local Codex authentication and returns constrained recipe JSON. Graft never executes model-generated JavaScript.
- **Roblox Player Watcher** sends only watched usernames or user IDs to Roblox's public user and presence APIs. It does not read or store Roblox cookies.
- **YouTube Auto Translation** sends text to Google’s Translate API via the extension service worker when a translation is needed. No analytics or accounts are involved.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and feature requests: [GitHub Issues](https://github.com/itsasheruwu/graft/issues).

Architecture notes and agent conventions: [`AGENTS.md`](AGENTS.md).

## License

[MIT](LICENSE)
