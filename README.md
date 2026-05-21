# Graft

Chrome MV3 extension for small, focused tweaks on the web (theme sync, element hiding, YouTube metadata translation).

## Development

```bash
npm install
npm run build      # production build → dist/
npm run watch      # rebuild dist/ on file changes
npm test           # Vitest unit tests for shared libs
```

Load **`dist/`** as an unpacked extension in `chrome://extensions` (Developer mode → Load unpacked).

## Adding a tweak

1. Register the tweak in [`src/tweaks/registry.js`](src/tweaks/registry.js) (entrypoints, match patterns, storage keys, UI keys).
2. Implement scripts under `src/tweaks/<id>/`.
3. Add React settings in `src/components/tweaks/` and wire into popup/options accordions.
4. Run `npm run build` — Vite generates `dist/manifest.json` `content_scripts` and copies tweak assets from the registry.

Bridge + MAIN-world pairs are required when page DOM must be touched; isolated scripts own `chrome.storage` I/O.

## Project layout

| Path | Role |
|------|------|
| `src/tweaks/registry.js` | Single source of truth for shipped tweaks |
| `src/build/registry-build.mjs` | Manifest content_scripts + dist copy list |
| `src/background/service_worker.js` | Defaults, migrations, translate API queue |
| `popup.html` / `options.html` / `hidden-elements.html` | Vite React entry pages |

## Learned conventions

See [`AGENTS.md`](AGENTS.md) for user preferences and architecture notes.
