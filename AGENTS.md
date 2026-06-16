## Learned User Preferences

- Use shadcn (Radix-based) UI for the extension popup and options pages.
- Organize tweak settings in expandable sections (e.g. Accordion) so new tweaks can ship without crowding the layout.
- Present nested tweak scopes (e.g. YouTube under Theme Syncer) as visually nested sub-options using `SubOption` or equivalent panels, not as flat peer controls.
- Toolbar action should open a popup menu for quick tweak toggles, with a link to the full options page.
- Element Selector removals should remain applied after selector mode is turned off for that domain (hide persists independently of the toggle).
- Show at-a-glance on/off state on popup/options accordion triggers (status dots) without expanding sections.
- Keep extension headers branded consistently with the shared `GraftBrand` component and Graft icon/wordmark across popup, options, and edited-list pages.
- Keep popup, options, and edited-list spacing visually even — use a consistent Tailwind spacing scale so accordion gaps and nested controls feel uniform.
- Mirror Element Selector "Open edited list" access in the popup accordion, not only on the options page.
- Keep extension UI primitives presentational — core components under `src/components/primitives` and `src/components/ui` must not embed `chrome.*` APIs.

## Learned Workspace Facts

- Product ships as **Graft** (`package.json`/`manifest.json` name `graft`; tagline "Small fixes, grafted onto the web."); workspace folder may be `Browser Tweaks`; public repo at `https://github.com/itsasheruwu/graft`. Brand guidelines in `BRANDING.md`; CSS tokens `--graft-navy`, `--graft-green`, `--graft-glow`.
- Theme Syncer uses an isolated-world `bridge.js` that reads `chrome.storage` and `matchMedia`, then `postMessage`s to MAIN-world `page.js`; MAIN-world content scripts cannot use `chrome.storage`.
- Ship the extension from the Vite build output: run `npm run build` and load the `dist/` folder unpacked; `vite.config.ts` sets `base: "./"` so bundled asset URLs work in Chrome extension pages. Use `npm run watch` to rebuild `dist/` during development; preview UI primitives in `gallery.html`. Extension surfaces use `ExtensionSurface` / `[data-graft-ui]` for injected UI isolation (popup ~300px per `src/lib/extension-ui.ts`).
- YouTube syncing updates `documentElement` / `ytd-app` theme attributes and includes targeted shadow-DOM patches under `ytd-searchbox` so header search controls track system theme without a full refresh.
- Tweak metadata and registration live in `src/tweaks/registry.js`; `src/build/registry-build.mjs` generates manifest `content_scripts`, `commands`, and the dist copy list at build time.
- Element Selector stores removals and saved text rewrites in `chrome.storage.local` (`elementSelectorRemovedElementsByDomain`, `elementSelectorTextRewritesByDomain`); enable toggle stays in `chrome.storage.sync`. Rewrites are session-only unless the user opts to persist per domain. Service worker migrates legacy sync data on upgrade, reapplies persisted hides and rewrites on page load even when selector mode is off, and derives storage hostname from page context (not forgeable MAIN-world `postMessage` fields). Toggle shortcut: `Alt+Shift+E`. Persisted edits are managed at `edited-list.html`.
- Background `onInstalled` / `onStartup` should backfill only missing default `chrome.storage.sync` / `local` keys using bounded key lists, instead of merging and rewriting full default objects each time.
- YouTube Auto Translation uses Google Translate (`translate.googleapis.com`) from the service worker with queued/rate-limited requests; UI copy should not claim Chrome built-in translation. `youtubeAutoTranslateDebugEnabled` defaults to false.
- Extension UI pages (popup, options, edited-list) follow system light/dark via `prefers-color-scheme`, not a hardcoded `dark` class on `<html>`.
- Content scripts use registry `exclude_matches` for browser/extension store URLs plus `src/lib/extension-bail.js` as an early guard.
- ChatGPT archived mass delete was intentionally removed — do not re-add files, registry entries, or manifest wiring.
- `.cursor/` is gitignored local editor state; untrack with `git rm --cached` if previously committed.
