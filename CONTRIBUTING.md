# Contributing

Thanks for helping improve Graft.

## Getting started

```bash
git clone https://github.com/itsasheruwu/graft.git
cd graft
npm install
npm run build
```

Load **`dist/`** as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

During development:

```bash
npm run watch   # rebuild dist/ on changes
npm test        # unit tests for shared libs
npm run dev     # preview popup UI in Vite (not the full extension)
```

## Adding a tweak

1. Register it in [`src/tweaks/registry.js`](src/tweaks/registry.js).
2. Add scripts under `src/tweaks/<id>/`.
3. Add settings UI in `src/components/tweaks/` and wire popup/options accordions.
4. Run `npm run build` — manifest `content_scripts` are generated from the registry.

Use an isolated **bridge** + **MAIN-world page** pair when you need to touch host-page DOM. Keep `chrome.storage` and extension APIs in isolated scripts only.

See [`AGENTS.md`](AGENTS.md) for architecture notes and conventions.

## Pull requests

- Keep changes focused — one tweak or one concern per PR when possible.
- Run `npm test` and `npm run build` before opening.
- Update README or settings copy if user-facing behavior changes.

## Reporting issues

Use the GitHub issue templates and include browser version, Graft version, and steps to reproduce.
