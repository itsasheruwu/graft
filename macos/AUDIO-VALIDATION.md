# Audio integration verification — 2026-09-14

## Verified

- Packaged `dist/Graft.app` builds and passes strict deep code-sign verification.
- Binary SHA-256: `2012fa0021f8e854f7898b50735fb2779cd533af89d025bf00e40f78dc3bdb0f`.
- Mach-O minimum OS is macOS 15.0; SDK stamp is 27.0.
- Graft audio/microphone/Bluetooth usage descriptions, the `graft` URL scheme,
  local audio entitlements, and third-party notices are present in the bundle.
- The exact packaged executable was launched and its Audio sidebar destination
  inspected. The off state, labeled controls, and import preview rendered in the
  native window. Light and dark appearances were checked; System was restored.
- FineTune import preview found 3 app volume settings and no pinned apps, custom
  EQ presets, audio profiles, or imported headphone files. Import was cancelled.
  All 64 original FineTune source files match the recorded pre-import hashes.
- Existing Graft startup, lid-animation, and watcher preferences were preserved.
- Full native test run: 357 audio tests, 30 GraftMac tests, 10 GraftCore tests,
  and 151 GraftBend cases (10 existing skips), with no failures.
- Two later migration tests cover portable headphone files and rollback after an
  actual destination-write failure. The targeted run passed all 11 matching tests.
- Extension: 55 tests pass; production build and TypeScript check pass.
- Shell syntax and tracked diff whitespace checks pass.

## Pending live verification

The user subsequently approved enabling audio and granting system-audio access.
Manage audio is now on. A quiet local 440 Hz test tone played through `afplay`
outside the command sandbox triggered real capture successfully: Graft displayed
“Managing audio on this Mac” and a changing level meter for the hosting ChatGPT
process. No new macOS permission dialog appeared. Volume changed to 50%, mute
toggled, and both were restored to 100% and unmuted. Disable followed by enable
during playback returned to successful capture with the baseline settings intact.
Outputs and inputs were discovered; removal of the Sceptre display output was
reflected in the UI. No device volumes or microphone settings were changed.

The sandboxed player failed with AudioQueueStart -66680; running the same tone
outside that sandbox succeeded. QuickTime launch through computer use timed out.
Meter/control verification does not establish actual audible quality. Remaining checks:

- New permission prompt, denial/revocation/recovery, and actual audible playback.
- Two independent apps, mute, boost, EQ, single/multiple outputs, and persistence.
- Device disconnect/reconnect, browser subprocess changes, sleep/wake, and
  audible quit/crash recovery on target OS versions.
- Input controls, Bluetooth connection, software volume, and supported-display DDC.
- Active menu mixer synchronization, window-close playback, minimum-size active
  layouts, and full VoiceOver traversal. The closed menu extra was not exposed by
  the available accessibility surface, so no live menu-render claim is made.
- Matched idle/active CPU, latency, and multi-output drift comparison with FineTune.

Automated DSP and state tests do not certify audible output or physical-device
behavior. This is a local build; no release or website deployment was performed.
