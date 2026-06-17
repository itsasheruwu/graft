<p align="center">
  <img src=".github/brand/logo.png" alt="Graft logo" width="120" />
</p>

<h1 align="center">Graft</h1>

<p align="center">
  <strong>Small fixes, grafted onto the web.</strong><br />
  <sub>A focused kit for grafting small fixes onto the web.</sub>
</p>

<p align="center">
  <a href="https://github.com/itsasheruwu/graft/actions/workflows/ci.yml"><img src="https://github.com/itsasheruwu/graft/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

<p align="center">
  One tweak at a time — theme sync, element hiding, media tools, and more — with a clean settings UI and no bloat.
</p>

**Install from source:** clone, build, load `dist/` unpacked (see [Install](#install)).  
There is no Chrome Web Store listing yet.

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
| **YouTube** | YouTube Auto Translation | Translates foreign video titles and descriptions into your browser language (or a fixed target language). Skips low-confidence detections; original text preserved on hover. |

Open the toolbar popup for quick toggles, or **All settings** for the full options page. Hidden elements and saved text rewrites are managed at `edited-list.html`.

## Install

```bash
git clone https://github.com/itsasheruwu/graft.git
cd graft
npm install
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the **`dist/`** folder

After code changes, run `npm run build` again (or `npm run watch`) and click **Reload** on the extension card.

## Development

```bash
npm install
npm run build      # production build → dist/
npm run watch      # rebuild dist/ on file changes
npm test           # Vitest unit tests for shared libs
npm run dev        # Vite preview of popup UI only (not full extension)
```

Open `gallery.html` via `npm run dev` (or load it from `dist/` after build) to preview Graft UI primitives and the grouped tweak-category accordion layout.

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

**Categories** (sorted A–Z in the UI): `appearance`, `customization`, `media`, `page-tools`, `youtube`.

### Project layout

| Path | Role |
|------|------|
| `src/tweaks/registry.js` | Single source of truth for shipped tweaks |
| `src/lib/tweak-catalog.ts` | Popup/options tweak list — categories, sort order, settings wiring |
| `src/build/registry-build.mjs` | Manifest content_scripts + dist copy list |
| `src/background/service_worker.js` | Defaults, migrations, translate API queue |
| `popup.html` / `options.html` / `edited-list.html` / `gallery.html` | Vite React entry pages |

## Privacy

- **Theme Syncer**, **Force Dark Mode**, **Element Selector**, **Asset Finder**, and **Sound Booster** run locally in your browser. Hides and blocklists are stored in extension storage on your device.
- **AI Rewriter** sends bounded page context and your prompt to the local `graft-ai-helper`; the helper uses your local Codex authentication and returns constrained recipe JSON. Graft never executes model-generated JavaScript.
- **YouTube Auto Translation** sends text to Google’s Translate API via the extension service worker when a translation is needed. No analytics or accounts are involved.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and feature requests: [GitHub Issues](https://github.com/itsasheruwu/graft/issues).

Architecture notes and agent conventions: [`AGENTS.md`](AGENTS.md).

## License

[MIT](LICENSE)
