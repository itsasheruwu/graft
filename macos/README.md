# Graft for Mac

The native part of the Graft project: a SwiftUI app, menu bar companion, shared settings core, and Chrome native messaging host.

## Requirements

- macOS 15 or later
- Xcode 26 or later with Swift 6.2
- The Graft Chrome extension for browser page tweaks and settings synchronization
- Spotify desktop and Spicetify for Spotify Friend Watcher

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
- **Music Scene** (Mac Tweaks → Music, or ⇧⌘M) follows playback in the Spotify and Apple Music desktop apps. Click the sleeve or press A to expand the artwork while keeping playback controls in reach. Escape collapses it. Graft retries delayed player artwork. For Apple Music streams missing a cover, it checks the recording against Apple’s catalog. Expanding a low-resolution Apple Music sleeve looks up the artist and album and uses a larger cover when the images match. Lyrics appear in conversation bubbles with backing-vocal replies, macOS emoji Tapbacks and offline street maps. Slow Silver 03 tags lift and place the group sticker on the lyric in any song. The kurtains recording of “trees” also uses syllable reveals, echo and ink effects, and a Twitter.com link preview. Word effects follow syllable timing, held notes, repeats and punctuation. Line-synced lyrics use estimated word pacing. Plain lyrics display an Estimated timing label. The edge light follows the player window until you switch on **Desktop edge light**, which moves it to the selected display. Options include an artwork companion window, a silent preview, a volume-reactive glow and a separate **Sync light to the beat** switch that follows percussion in the system audio. With **Animate light** on, the album-colored glow travels clockwise. Beat sync follows the song’s tempo, gently advances the highlight on percussion, and pulses the glow. Live playback uses macOS Automation. The optional pulse reads the system audio mix locally. Lyrics mode looks up track metadata on [LRCLIB](https://lrclib.net/docs) and also accepts a timed .lrc or plain .txt file through the player’s More menu.
- Auto-install DMGs (Mac Tweaks → Applications): while enabled and Graft is running, opening a read-only DMG copies its top-level apps into `/Applications`, then ejects it. The nested **Delete DMG after installation** option moves the source to Trash only after every app is copied and the image ejects. Both options default off. Writable image-building volumes are ignored. Existing apps, package installers, multi-volume images, and invalid bundles require manual installation; failures keep the source. Graft preserves quarantine and does not launch installed apps or bypass macOS security checks. Disabling stops new installs; a copy already in progress finishes.
- Auto-use Codex banked rate limit resets about five minutes before expiry, using the existing Codex sign-in (Mac Tweaks → Applications). Off by default; Graft must be running and the Mac awake. Checks on wake, retries temporary failures with the same redemption request ID, and keeps a local attempt ledger across restarts. Open Codex or run `codex login` if sign-in expires.
- **Dock AI Usage** (Mac Tweaks → Applications) puts a usage meter on ChatGPT/Codex, Claude, and Cursor in the Dock. Hover over an icon for its reset countdown. Enable the tweak and allow Accessibility so Graft can follow the icons. ChatGPT/Codex uses your Codex sign-in. For Claude and Cursor, set up those usage providers in [CodexBar](https://github.com/steipete/CodexBar). Keep Graft running and pin or open the apps you want to see.
- Caffeinate for idle keep-awake sessions, Insomnia for timed closed-lid sessions, and a floating Graft window
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
python3 macos/Tests/ClosedLidPowerScriptTests.py
```

Run these from the repository root. SwiftPM builds the executables as part of the test build. The closed-lid tests require Python 3.11 or later and use simulated power and recovery commands. These checks do not verify a physical lid close, real notification delivery, Spotify setup, or live Chrome/native synchronization.

## Development status

The [GitHub release](https://github.com/itsasheruwu/graft/releases/latest) includes an Apple Silicon build for macOS 15 or later. The app is ad-hoc signed and unnotarized. Foreground notification sound preferences and real-device delivery still need broader integration validation.

## Updates and release packaging

Install `Graft-Mac.zip` from GitHub once to receive future updates. Graft checks for new releases and can install them when it quits. In the Graft menu, use **Check for Updates…** or change **Install Updates Automatically**. Source builds omit the update feed by default.

To package a release, bump the version in `manifest.json`, install the repository's npm dependencies, and run the packaging script on Apple Silicon with the Sparkle 2.10.1 release tools:

```bash
script/package_release.sh /path/to/Sparkle/bin/sign_update /tmp/graft-release
```

The script signs the update archive and feed with the `com.itsasheruwu.graft.mac` Sparkle key in the macOS Keychain. Preserve that key for future releases. Upload `Graft-Mac.zip`, `Graft-Chrome.zip`, and `appcast.xml` together on the GitHub release tagged `v<version>`. Publish it as the latest release only after all assets are attached.

## Settings synchronization

The Mac app and native host mutate only the fields they own inside a read/modify/write transaction protected by a stable sidecar file lock. Atomic JSON replacement keeps readers from seeing partial files. Mac edits merge only changed fields into the latest state, and malformed state files are preserved rather than overwritten with defaults. Failed app writes remain queued in memory for Retry Sync while Graft stays running.

Browser changes from the Mac carry per-key acknowledgement tokens and revision numbers. The extension serializes storage reads/writes, acknowledges the exact completed write, then reports the current browser state. Stale snapshots and acknowledgements cannot overwrite a newer queued toggle. Pending changes retry across reconnects and app restarts. Rebuild the extension with `npm run build` and reload it in Chrome when updating this protocol; restart the old native host processes so every writer uses the transaction API.

## Caffeinate and Insomnia

**Mac Tweaks → System** has separate collapsed rows for **Caffeinate** and **Insomnia**. Each has its own switch and session. Both are also available from the menu bar.

Caffeinate prevents idle sleep while Graft runs. Choose a duration, keep it on until stopped, or select a running app such as Codex. Enable **Keep the screen on** for tasks such as Codex Computer Use that need an unlocked desktop. **Add 30 min** extends an active timer. Existing Stay Awake preferences carry over to Caffeinate.

Insomnia keeps an Apple Silicon MacBook awake with the lid closed on macOS 26 or later. Expand its row to choose 1–240 minutes, then turn on its switch and approve the macOS administrator prompt. It works on battery or while charging and ends at 10% charge. Use a ventilated surface.

Insomnia has its own recovery job, which restores the sleep setting when its timer ends, Graft exits, or the Mac reboots. If the lid is still closed at expiry and no external display is online, Graft asks macOS to sleep. Insomnia was inspired by [Insomnia](https://github.com/krishhgg/Insomnia).

Codex and local scripts can control Caffeinate while Graft is open. Durations are in minutes.

```bash
dist/Graft.app/Contents/MacOS/Graft --caffeinate start 60
dist/Graft.app/Contents/MacOS/Graft --caffeinate extend 30
dist/Graft.app/Contents/MacOS/Graft --caffeinate status
dist/Graft.app/Contents/MacOS/Graft --caffeinate end
```

The existing `--stay-awake` flag remains an alias for Caffeinate commands.

## Activity and troubleshooting

**Activity** in the sidebar and menu bar shows local install results, watcher checks, settings connectivity/acknowledgements, Caffeinate sessions, Spotify repairs, and failures. The latest 200 events persist in `~/Library/Application Support/Graft/activity.json`; repeated identical watcher checks share one row. Search, category filtering, and Only problems narrow the history.

Retry actions repeat the operation represented by the entry: retry an install from its original DMG, finish cleanup without reinstalling apps, check a watcher, repair Spotify, retry settings sync, or retry Caffeinate. They do not enable disabled watchers or grant permissions. Spotify repair success means the repair was applied; a fresh heartbeat separately confirms reconnection. History starts when this version is first run; older operations are not reconstructed.

## Appearance and startup

Mac Tweaks includes System / Light / Dark appearance for Graft and Open on startup, backed by `SMAppService.mainApp`. The startup switch reads the system registration state and shows approval requirements or errors.

The opt-in MacBook closing and open animation uses Bendable's MIT-licensed engine (see BENDABLE-NOTICE.md and BENDABLE-LICENSE). Fold, Crease, Fade, Aperture, and Shutter follow the built-in lid angle sensor where available. On Macs that report only open and closed events, Graft plays a short timed animation. macOS can turn off the display before a closing animation finishes. The controls include opening/closing switches, start angle, calibration reset, and a draggable preview. Fold and Crease require Screen Recording for desktop stills; without it, the display falls back to Fade. Reduce Motion also uses Fade. External displays are untouched.

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
