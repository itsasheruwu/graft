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

This is the current development source, not a packaged or notarized release. Known issues from the source review include concurrent app/bridge settings writes potentially overwriting each other, verbose Spotify setup subprocesses potentially blocking, Keep Awake potentially outliving the app, and foreground Spotify notification sound using the Roblox preference. These need fixes and integration validation before a stable native release.
