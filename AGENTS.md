## Learned User Preferences

- Use shadcn (Radix-based) UI for the extension popup and options pages.
- Organize tweak settings in expandable sections (e.g. Accordion) so new tweaks can ship without crowding the layout.
- Present the YouTube Theme Syncer scope as a visually nested sub-option under the main Theme Syncer toggle, not as a flat peer control.
- Toolbar action should open a popup menu for quick tweak toggles, with a link to the full options page.
- Element Selector removals should remain applied after selector mode is turned off for that domain (hide persists independently of the toggle).
- Show at-a-glance on/off state on popup/options accordion triggers (status dots) without expanding sections.

## Learned Workspace Facts

- Theme Syncer uses an isolated-world `bridge.js` that reads `chrome.storage` and `matchMedia`, then `postMessage`s to MAIN-world `page.js`; MAIN-world content scripts cannot use `chrome.storage`.
- Ship the extension from the Vite build output: run `npm run build` and load the `dist/` folder unpacked; `vite.config.ts` sets `base: "./"` so bundled asset URLs work in Chrome extension pages.
- YouTube syncing updates `documentElement` / `ytd-app` theme attributes and includes targeted shadow-DOM patches under `ytd-searchbox` so header search controls track system theme without a full refresh.
- Tweak metadata and registration live in `src/tweaks/registry.js`; `src/build/registry-build.mjs` generates manifest `content_scripts`, `commands`, and the dist copy list at build time.
- Element Selector stores removals in `chrome.storage.local` (`elementSelectorRemovedElementsByDomain`); enable toggle stays in `chrome.storage.sync`. Service worker migrates legacy sync data on upgrade.
- Element Selector should reapply persisted hidden signatures on page load even when selector mode is off.
- Element Selector’s isolated bridge must derive the storage hostname for removal writes from the active page context (normalized hostname in the bridge), not from MAIN-world `postMessage` fields that page scripts can forge.
- Background `onInstalled` / `onStartup` should backfill only missing default `chrome.storage.sync` / `local` keys using bounded key lists, instead of merging and rewriting full default objects each time.
- YouTube Auto Translation uses Google Translate (`translate.googleapis.com`) from the service worker with queued/rate-limited requests; UI copy should not claim Chrome built-in translation.
- `youtubeAutoTranslateDebugEnabled` defaults to false.
- Extension UI pages (popup, options, hidden-elements) follow system light/dark via `prefers-color-scheme`, not a hardcoded `dark` class on `<html>`.
- Content scripts use registry `exclude_matches` for browser/extension store URLs plus `src/lib/extension-bail.js` as an early guard.
