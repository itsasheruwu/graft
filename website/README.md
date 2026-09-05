# Graft website

The standalone static marketing site published at https://itsasheruwu.github.io/graft/.

Preview from the repository root:

```sh
python3 -m http.server 4178 --directory website
```

Open http://localhost:4178. No extension installation is needed to view the site. The marketing page is plain HTML/CSS/JS; its authentic UI snapshot is built separately. The sample page is an illustration; the embedded popup runs the real Graft UI with isolated demo data. It never changes the visitor's browser settings or plays audio.

`pages.yml` publishes only this directory when website changes reach `main`. Extension builds remain independent. Use relative asset URLs to support the `/graft/` project path. Keep the toolkit and installation copy aligned with what is actually available in the public repository; the native companion is available as source, with no packaged download yet.

The Geist font is self-hosted; its license is in `assets/FONT-LICENSE.txt`. The Graft mark and social image reuse the repository's brand assets. The landscape and feature illustrations are original inline SVG/CSS. The site makes no third-party font, analytics, or API requests.

Before publishing, check desktop and mobile layouts, keyboard operation, the actual popup controls, reset, expandable toolkit/FAQ rows, copy commands (including clipboard-denied fallback), internal anchors, local assets, and reduced-motion behavior.

## Authentic UI preview

The preview now runs the actual popup, options, and edited-list entry points from `src/`, inside an iframe that isolates the extension CSS from the marketing page. It uses the real `GraftBrand`, Radix accordions, switches, nested settings, status badges, and the 300px popup shell. There is no separately maintained copy of that UI.

Rebuild the checked-in preview snapshot from the current working tree:

```sh
node tools/build-site-preview.mjs
npx tsc -p tools/site-preview/tsconfig.json
```

The generated `website/preview/` files are committed so GitHub Pages can still deploy only static assets. `source-snapshot.json` records hashes of the source used, including any local UI changes not yet published as extension source. Rebuild and commit the snapshot when the real UI changes. The adapter has a separate TypeScript check. Check the application with `npx tsc --noEmit -p tsconfig.app.json`; the root solution config does not typecheck application files on its own.

`tools/site-preview/preview-adapter.ts` substitutes in-memory browser APIs. No real Chrome storage, accounts, notifications, native host, or local AI helper are accessed. The iframe's CSP blocks network APIs. Theme, gain, domain blocklists, persisted hiding, and the real edited-list removal UI are connected to the sample journal. Options and popup share the same ephemeral state. Refresh or Reset discards it. Integration-only actions explain that the installed extension is needed.
