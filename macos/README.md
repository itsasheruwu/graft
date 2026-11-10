# Graft for Mac

The native part of the Graft project: a SwiftUI app, menu bar companion, shared settings core, and Chrome native messaging host.

## Requirements

- macOS 15 or later
- Xcode 26 or later with Swift 6.2
- The Graft Chrome extension for browser page tweaks and settings synchronization
- Spotify desktop and Spicetify only if you enable the optional Spotify integration

## Build and run

From the repository root:

```bash
./script/build_and_run.sh --verify
```

This builds both executables, assembles and signs `dist/Graft.app`, opens it, and checks that the process is running. The script stops any existing Graft process before building. If the selected developer tools are Command Line Tools, select your Xcode installation with `DEVELOPER_DIR` before running it. The script automatically uses `/Applications/Xcode Beta.app` when available.

The default build uses ad-hoc signing. Time Sensitive notifications need a matching Apple signing identity and provisioning profile; set `GRAFT_CODESIGN_IDENTITY` and `GRAFT_PROVISIONING_PROFILE` for a provisioned build. Keep profiles and signing keys out of Git.

## Connect Chrome

1. Build and load the extension using the [root setup instructions](../README.md#install).
2. Copy its extension ID from `chrome://extensions`.
3. Open **Connection** in the Mac app, enter that ID, and install the native bridge.
4. Reload the extension and check the connection state in Graft.

The bridge exchanges Graft settings. It does not read browsing history or page contents. Browser tweaks require the installed extension; the Mac app is not a browser engine.

## Features

- Web tweak settings in a native window and menu bar
- Auto-install DMGs (Mac Tweaks → Applications): while enabled and Graft is running, opening a read-only DMG copies its top-level apps into `/Applications`, then ejects it. The nested **Delete DMG after installation** option moves the source to Trash only after every app is copied and the image ejects. Both options default off. Writable image-building volumes are ignored. Existing apps, package installers, multi-volume images, and invalid bundles require manual installation; failures keep the source. Graft preserves quarantine and does not launch installed apps or bypass macOS security checks. Disabling stops new installs; a copy already in progress finishes.
- Auto-use Codex banked rate limit resets about five minutes before expiry, using the existing Codex sign-in (Mac Tweaks → Applications). Off by default; Graft must be running and the Mac awake. Checks on wake, retries temporary failures with the same redemption request ID, and keeps a local attempt ledger across restarts. Open Codex or run `codex login` if sign-in expires.
- Keep Mac awake and float the Graft window
- Show hidden Finder files or hide desktop icons, with a confirmation before restarting Finder
- Roblox presence notifications, coordinated with the browser fallback
- Optional Spotify friend activity notifications and local listening history through Spicetify

Spotify setup is opt-in and changes the local Spotify customization. Its controls appear when Spotify is installed. Listening history and app state remain in local Application Support and are not repository assets.

## Source map

| Path | Purpose |
|---|---|
| `Sources/GraftMac/` | SwiftUI app, settings, native services, and watchers |
| `Sources/GraftNativeHost/` | Chrome native messaging executable |
| `Sources/GraftCore/` | Shared models and persistence |
| `Resources/graft-spotify-bridge.js` | Local Spicetify integration |
| `Tests/` | Swift tests and JavaScript bridge resource tests |
| `../script/build_and_run.sh` | App assembly, signing, launch, and verification |

## Validation

```bash
swift test --package-path macos
node --test macos/Tests/SpotifyBridgeResourceTests.mjs
```

Run these from the repository root. SwiftPM builds the executables as part of the test build. These checks do not verify real notification delivery, Spotify setup, or live Chrome/native synchronization.

## Development status

This is the current development source, not a packaged or notarized release. Native settings writes now use locked transactions, Spotify setup drains output to a temporary file with a timeout, and Keep Awake uses a process-owned power assertion. Foreground notification sound preferences and real-device delivery still need broader integration validation before a stable native release.

## Settings synchronization

The Mac app and native host mutate only the fields they own inside a read/modify/write transaction protected by a stable sidecar file lock. Atomic JSON replacement keeps readers from seeing partial files. Mac edits merge only changed fields into the latest state, and malformed state files are preserved rather than overwritten with defaults. Failed app writes remain queued in memory for Retry Sync while Graft stays running.

Browser changes from the Mac carry per-key acknowledgement tokens and revision numbers. The extension serializes storage reads/writes, acknowledges the exact completed write, then reports the current browser state. Stale snapshots and acknowledgements cannot overwrite a newer queued toggle. Pending changes retry across reconnects and app restarts. Rebuild the extension with `npm run build` and reload it in Chrome when updating this protocol; restart the old native host processes so every writer uses the transaction API.

## Timed Keep Awake

Expand **Keep Mac awake → Session** in Mac Tweaks to choose Until turned off, 30 minutes, 2 hours, or Until an app quits. App-bound sessions select a running application and track that process and launch time. Timed sessions store an absolute deadline, so unrelated settings changes and app restarts do not reset the timer. Changing the duration while active starts a new duration.

Keep Awake uses an IOKit power assertion owned by the Graft process. Normal quit releases it explicitly; process death also releases it, including force quit. It prevents idle display/system sleep, without changing persistent system power preferences. Closed-lid and explicit user-requested sleep remain system-controlled.

## Activity and troubleshooting

**Activity** in the sidebar and menu bar shows local install results, watcher checks, settings connectivity/acknowledgements, Keep Awake sessions, Spotify repairs, and failures. The latest 200 events persist in `~/Library/Application Support/Graft/activity.json`; repeated identical watcher checks share one row. Search, category filtering, and Only problems narrow the history.

Retry actions repeat the operation represented by the entry: retry an install from its original DMG, finish cleanup without reinstalling apps, check a watcher, repair Spotify, retry settings sync, or retry Keep Awake. They do not enable disabled watchers or grant permissions. Spotify repair success means the repair was applied; a fresh heartbeat separately confirms reconnection. History starts when this version is first run; older operations are not reconstructed.

## Appearance and startup

Mac Tweaks includes System / Light / Dark appearance for Graft and Open on startup, backed by `SMAppService.mainApp`. The startup switch reads the system registration state and shows approval requirements or errors.

The opt-in MacBook closing and open animation uses Bendable's MIT-licensed engine (see BENDABLE-NOTICE.md and BENDABLE-LICENSE). Fold, Crease, Fade, Aperture, and Shutter follow the built-in lid sensor where available, with discrete lid events as fallback. The controls include opening/closing switches, start angle, calibration reset, and a draggable preview. Fold and Crease require Screen Recording for desktop stills; without it, the display falls back to Fade. Reduce Motion also uses Fade. External displays are untouched.

Animation preferences use the `graft.bend.*` namespace in Graft's local defaults. Disabling stops the sensor and overlay. Preview tasks stop on sleep or lock. The shader is packaged in the SwiftPM resource bundle and compiled through Metal at runtime; the build script copies that bundle into Graft.app. Tests exercise the actual GPU renderer when Metal is available.

## Native Audio

The Audio sidebar pane and Graft menu bar mixer share one app-lifetime audio
service. Audio management defaults to off and works independently of the browser
extension. Enable it in Audio; macOS requests system audio access when an app
plays sound. The access indicator stays provisional until CoreAudio confirms a
successful tap. If access is denied, open Permissions, allow Graft in Screen &
System Audio Recording, return to Graft, and Retry. Disabling audio or quitting
releases Graft's taps. A running FineTune instance pauses activation until it exits.

Applications support volume, mute, 1–4× boost, inactive pinning, ignoring,
single/multiple output routing, and 10-band EQ with built-in/custom presets.
Outputs provide hardware/DDC/software volume, saved priority and reconnect
restoration, and per-device AutoEQ correction. Inputs expose device selection,
volume and opt-in locking. Audio Settings contains loudness processing, alerts,
software volume, correction preamp, cache management, and local data operations.
DDC controls are available only when the display and connection support them.
Paired Bluetooth discovery starts only when requested.

The menu bar mixer displays the first six active/pinned apps; Open Audio Settings
reveals the complete searchable list. Existing Web and Mac toggles remain in the
same menu bar item. Headphone catalog searches access AutoEQ's public GitHub
catalog; captured audio is processed locally and is not recorded or uploaded.

### Data and import

Audio data lives in `~/Library/Application Support/Graft/Audio/`, separately from
extension shared state. Review Import offers a one-time copy from FineTune's
Application Support directory. Graft's prior settings and imported profiles are
backed up under `Audio/Backups/<identifier>/`. FineTune files are never modified.
Startup, menu icon, onboarding, and OS grants are excluded. The import preserves
audio rules, pinned/ignored apps, EQ presets, audio profiles, favorites, and
headphone files. Missing hardware remains a saved routing preference.

Graft JSON exports use `com.graft.audio.settings` and include imported headphone
files; imports also accept FineTune's `com.finetuneapp.settings` envelope or its
versioned `settings.json`. Unsupported versions and malformed/path-traversing
profile files are rejected before replacement. Reset affects audio settings only
and saves a backup first. Diagnostics are exported locally only on request.

### Automation

Use `graft://audio/<action>` with these actions:

| Action | Parameters |
| --- | --- |
| `set-volumes` | ordered `app=<bundle ID>&volume=<0–400>` pairs |
| `set-boost` | `app`, `boost=1x|2x|3x|4x` |
| `step-volume` | `app`, `direction=up|down` |
| `set-mute` | ordered `app` / `muted=true|false` pairs |
| `toggle-mute` | one or more `app` values |
| `set-device` | `app`, `device=<UID>` |
| `set-device-mode` | `app`, `mode=single|multi`, repeated `device=<UID>` |
| `set-eq` | `app`, `preset=<preset ID>` or ten comma-separated `gains`; optional `enabled` |
| `set-autoeq` | `device`, `profile=<ID>` and/or `enabled=true|false` |
| `set-loudness` | `enabled=true|false` (compensation and equalization together) |
| `pin-app`, `ignore-app` | `app`, optional `name` |
| `unpin-app`, `unignore-app` | `app` |
| `reset` | none (reset active app volumes/mutes) |

Example: `open 'graft://audio/set-volumes?app=com.spotify.client&volume=50'`.
Audio must already be enabled and capture-authorized; commands never grant
permissions or turn on audio management. Graft does not register `finetune://`.
Browser Sound Booster and native boost multiply when both are enabled.

### Build, license, and validation

The combined macOS app is GPLv3; see `LICENSE`, `FINETUNE-NOTICE.md`, and the
recorded source snapshot hashes. Independent extension/website code retains the
root MIT license. Match every distributed macOS binary with its complete source
archive and build instructions. `./script/build_and_run.sh build` packages
without launching; `--verify` packages and launches the exact artifact.

`GraftAudio` uses explicit main-actor control operations and a nonisolated audio
callback/DSP path. Its source retains Swift 5 language compatibility while Graft's
UI stays in Swift 6. Tests cover processing, routing, permissions, lifecycle,
automation, persistence, and import failure. Run `swift test --package-path macos`.
For a restricted build environment that cannot nest SwiftPM's sandbox, set
`GRAFT_SWIFT_DISABLE_SANDBOX=1` for the packaging script and point compiler caches
at a writable temporary directory. This affects the build tool only.

Real-device acceptance still requires system audio permission and hardware:
independent playback from two apps, mute/boost/routing audibility, multi-output
drift, disconnect/reconnect, sleep/wake, app relaunch/browser subprocesses,
microphone controls, Bluetooth and supported-display DDC. Compare idle and active
CPU/latency against FineTune with the same apps/devices. Unit tests cannot certify
those hardware outcomes. Check window/menu synchronization, both appearances,
minimum window size, VoiceOver, and window-close playback in the packaged build.
