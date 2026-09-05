## Learned User Preferences

- Use shadcn (Radix-based) UI for the extension popup and options pages.
- Organize tweak settings in expandable sections (e.g. Accordion) so new tweaks can ship without crowding the layout.
- Present nested tweak scopes (e.g. YouTube under Theme Syncer) as visually nested sub-options using `SubOption` or equivalent panels, not as flat peer controls.
- Toolbar action should open a popup menu for quick tweak toggles, with a link to the full options page.
- Element Selector removals should remain applied after selector mode is turned off for that domain (hide persists independently of the toggle).
- Show at-a-glance on/off state on popup/options accordion triggers (status dots) without expanding sections.
- Keep extension headers branded consistently with the shared `GraftBrand` component and Graft icon/wordmark across popup, options, and edited-list pages.
- Keep popup, options, and edited-list spacing visually even — use a consistent Tailwind spacing scale so accordion gaps and nested controls feel uniform; keep popup shell width locked when expanding settings.
- Mirror Element Selector "Open edited list" access in the popup accordion, not only on the options page.
- Keep extension UI primitives presentational — core shared UI components must not embed `chrome.*` APIs.
- Prefer in-menu blurred prompt overlays for enable gates and similar confirms (blur the menu surface, show the prompt inside) rather than external bottom sheets.

## Learned Workspace Facts

- Product ships as **Graft** (name `graft`; tagline "Small fixes, grafted onto the web."); workspace folder may be `Browser Tweaks`; public repo at `https://github.com/itsasheruwu/graft`. Brand guidelines in `BRANDING.md`; CSS tokens `--graft-navy`, `--graft-green`, `--graft-glow`.
- Theme Syncer uses an isolated-world bridge that reads `chrome.storage` and `matchMedia`, then posts to MAIN-world code; MAIN-world content scripts must not read `chrome.storage`.
- Ship the extension from the Vite build output: run `npm run build` and load the built extension output. Rebuild during development with `npm run watch`. Vite `base` is set to `"./"` so bundled asset URLs work in extension pages. Popup/options/edited-list use `[data-graft-ui]` isolation and shared extension surface sizing; avoid `modulepreload` in extension HTML (cross-world preload mismatch warnings).
- YouTube syncing updates `documentElement` / `ytd-app` theme attributes and applies shadow-DOM patches under `ytd-searchbox` so header search controls track system theme without a full refresh.
- Tweak metadata and registration come from a centralized registry used at build time to generate manifest `content_scripts`, `commands`, and the dist copy list; new tweaks need full wiring across registry, service-worker defaults, catalog, status badges, and settings UI.
- Element Selector stores removals and saved text rewrites in `chrome.storage.local` (`elementSelectorRemovedElementsByDomain`, `elementSelectorTextRewritesByDomain`); enable toggle stays in `chrome.storage.sync`. Rewrites are session-only unless user chooses domain persistence. Service worker migrates legacy sync data on upgrade, reapplies persisted hides and rewrites on page load even when selector mode is off, and derives storage hostname from page context (not forgeable MAIN-world message payloads). Toggle shortcut: `Alt+Shift+E`. Persisted edits are managed in the dedicated edited-list UI.
- Background `onInstalled` / `onStartup` should backfill only missing default `chrome.storage.sync` / `local` keys using bounded key lists, instead of merging and rewriting full default objects each time.
- YouTube Auto Translation uses Google Translate (`translate.googleapis.com`) from the service worker with queued/rate-limited requests; UI copy should not claim Chrome built-in translation. `youtubeAutoTranslateDebugEnabled` defaults to false.
- Extension UI pages (popup, options, edited-list) follow system light/dark via `prefers-color-scheme`, not a hardcoded `dark` class on `<html>`.
- Content scripts use registry `exclude_matches` for browser/extension-store URLs and a central early-guard snippet; they must tolerate `Extension context invalidated` after reload (stop timers / ignore dead `chrome.*` calls).
- ChatGPT archived mass delete was intentionally removed — do not re-add files, registry entries, or manifest wiring.
- Watcher-style features should request optional `notifications` permission on enable. Roblox Player Watcher uses the running Graft Mac app as the primary owner and a `chrome.alarms` service-worker poller as fallback; neither path requires a Roblox tab or Roblox cookie, and ownership handoff must seed silently to avoid duplicate or stale alerts. Mac-only delivery prefs (Time Sensitive, sound) live in a nested Notifications subgroup on the web tweak. Anti-spam (on by default) throttles repeat join-game alerts for a few minutes on both Mac and Chrome paths.
- The macOS app's settings panes are built only from the shared components in `GraftSettingsStyle.swift` (`GraftSettingsPage`, `GraftSettingsGroup`, `GraftSettingsSubGroup`, `GraftRow` / `GraftRowLabel` / `GraftToggleRow`, `GraftIconChip`) with geometry from `GraftMetrics`. Groups insert their own row dividers — never hand-place them — and pane titles come from `navigationTitle`, not a repeated in-page header. Nested related controls use `GraftSettingsSubGroup` inside the parent group or expanded tweak, not a peer group. Each web tweak's primary control is the row's trailing switch; only the remaining controls live in the expandable area, indented to `GraftMetrics.labelInset` and disabled while the tweak is off.


## Additional Architecture Facts from Full Scan

- Build pipeline includes a manifest/copy stage that synthesizes the final manifest from registry + base configuration, injects `content_scripts`, copies required registry entrypoint assets, and includes command metadata.
- Runtime defaults are enforced in the service worker using bounded-key initialization:
 - `SYNC_DEFAULT_SETTINGS` and `LOCAL_DEFAULT_SETTINGS` are complete default dictionaries used in startup/onInstalled handlers.
 - If a key is missing, only that key is backfilled instead of rewriting whole objects.
 - The same code migrates legacy selector removals from sync -> local once using marker `graftMigratedElementSelectorRemovalsToLocal`.
- Background message contracts:
 - `graft-ai-rewriter:generate` forwards a local helper request to `127.0.0.1:<port>/rewrite` (`port` defaults to 27491, token required).
 - `youtube-auto-translate:translate` calls Google Translate from the service worker with a 220ms minimum gap queue.
 - `youtube-auto-translate:log` logs service-level debug events to console only.
- Build/deploy defaults:
 - `host_permissions` include YouTube + `translate.googleapis.com` + `127.0.0.1`.
 - `minimum_chrome_version` is `111`.
 - Registry build default run timing is `document_start` unless explicitly overridden.
- UI contract is shared:
 - Shared UI and component layers must remain presentational and must not own chrome runtime calls.
 - Tweak settings list renders expandable categories with tweak-level controls and status dots on trigger lines.
- Storage model:
 - Keep sync settings and local edit-caches conceptually separated: user prefs for toggle/feature state live in sync, while per-domain element and AI edits are persisted locally and reapplied by the background worker.
- `elementSelectorLocateRequest` is a short-lived locate payload; the bridge clears it after use so live highlight/locate actions are one-shot.
- Edited list is authoritative for review/export:
 - The edited-list UI surfaces and mutates persisted removals, rewrites, and AI recipes.
 - Supports per-domain filtering, export/import JSON, bulk-clear by site, and opens options tab on demand.
- Theme Syncer nested UI includes explicit sub-option composition, and YouTube Auto Translation also uses nested child switches plus a live active-tab status panel.
- Asset Finder runs from content script message `asset-finder:open`, scans DOM assets into an injected side panel, and uses `chrome.tabs.sendMessage` from options state.
- Force Dark Mode injects a host-level `<style>` when active and intentionally excludes `data-graft-ui` roots and obvious media/logo containers from overrides.
- Sound Booster builds `MediaElement` gain chains and restores default gain when disabled/blocklisted.
