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
  One tweak at a time — theme sync, element hiding, YouTube translation — with a clean settings UI and no bloat.
</p>

**Install from source:** clone, build, load `dist/` unpacked (see [Install](#install)).  
There is no Chrome Web Store listing yet.

## Tweaks

| Tweak | What it does |
|-------|----------------|
| **Theme Syncer** | Mirrors your system light/dark preference on supported pages. YouTube gets dedicated handling (nested toggle + per-site blocklist). |
| **Element Selector** | Hover and hide page elements. Removals persist per domain even when selector mode is off. Export/import, undo, and bulk unhide supported. Shortcut: `Alt+Shift+E`. |
| **YouTube Auto Translation** | Translates foreign video titles and descriptions into your browser language (or a fixed target language). Skips low-confidence detections; original text preserved on hover. |

Open the toolbar popup for quick toggles, or **All settings** for the full options page. Hidden elements are managed at `hidden-elements.html`.

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

### Adding a tweak

1. Register the tweak in [`src/tweaks/registry.js`](src/tweaks/registry.js) (entrypoints, match patterns, storage keys, UI keys).
2. Implement scripts under `src/tweaks/<id>/`.
3. Add React settings in `src/components/tweaks/` and wire into popup/options accordions.
4. Run `npm run build` — Vite generates `dist/manifest.json` `content_scripts` and copies tweak assets from the registry.

Bridge + MAIN-world pairs are required when page DOM must be touched; isolated scripts own `chrome.storage` I/O.

### Project layout

| Path | Role |
|------|------|
| `src/tweaks/registry.js` | Single source of truth for shipped tweaks |
| `src/build/registry-build.mjs` | Manifest content_scripts + dist copy list |
| `src/background/service_worker.js` | Defaults, migrations, translate API queue |
| `popup.html` / `options.html` / `hidden-elements.html` | Vite React entry pages |

## Privacy

- **Theme Syncer** and **Element Selector** run locally in your browser. Element hides are stored in extension storage on your device.
- **YouTube Auto Translation** sends text to Google’s Translate API via the extension service worker when a translation is needed. No analytics or accounts are involved.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and feature requests: [GitHub Issues](https://github.com/itsasheruwu/graft/issues).

Architecture notes and agent conventions: [`AGENTS.md`](AGENTS.md).

## License

[MIT](LICENSE)
