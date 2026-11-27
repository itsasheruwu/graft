#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="Graft"
BUNDLE_ID="com.itsasheruwu.graft.mac"
MIN_SYSTEM_VERSION="15.0"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MACOS_DIR="$ROOT_DIR/macos"
DIST_DIR="${GRAFT_DIST_DIR:-$ROOT_DIR/dist}"
CONFIGURATION="${GRAFT_BUILD_CONFIGURATION:-debug}"
APP_VERSION="$(/usr/bin/plutil -extract version raw "$ROOT_DIR/manifest.json")"
# Assemble away from cloud-managed folders: Finder can attach metadata between
# copying a nested resource bundle and signing its parent.
ASSEMBLY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/graft-assembly.XXXXXX")"
trap 'rm -rf "$ASSEMBLY_DIR"' EXIT
APP_BUNDLE="$ASSEMBLY_DIR/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_HELPERS="$APP_CONTENTS/Helpers"
APP_RESOURCES="$APP_CONTENTS/Resources"
APP_FRAMEWORKS="$APP_CONTENTS/Frameworks"

if [[ "$MODE" != "build" && "$MODE" != "--build" ]]; then
  pkill -TERM -x "$APP_NAME" >/dev/null 2>&1 || true
  for _ in {1..50}; do
    if ! pgrep -x "$APP_NAME" >/dev/null; then break; fi
    sleep 0.1
  done
  if pgrep -x "$APP_NAME" >/dev/null; then
    echo "Graft is still shutting down; close it before rebuilding." >&2
    exit 1
  fi
fi

# macOS grants an app the current system appearance (Liquid Glass on macOS 26 and
# later) based on the SDK version recorded in the binary; anything older gets the
# legacy compatibility appearance instead. SwiftPM links with the package's
# deployment target as the triple, which makes the linker stamp the SDK version as
# macOS 15, so build against the newest installed SDK and stamp it explicitly.
# `minos` stays at the package floor, so this does not raise the system requirement.
if [[ -z "${DEVELOPER_DIR:-}" && -d "/Applications/Xcode Beta.app/Contents/Developer" ]]; then
  export DEVELOPER_DIR="/Applications/Xcode Beta.app/Contents/Developer"
fi
SDK_VERSION="$(xcrun --show-sdk-version)"
DEPLOYMENT_TARGET="$MIN_SYSTEM_VERSION"
LINK_ARGS=(-Xlinker -platform_version -Xlinker macos -Xlinker "$DEPLOYMENT_TARGET" -Xlinker "$SDK_VERSION")

BUILD_ARGS=(-c "$CONFIGURATION" "${LINK_ARGS[@]}" -Xlinker -rpath -Xlinker @executable_path/../Frameworks)
if [[ "${GRAFT_SWIFT_DISABLE_SANDBOX:-0}" == "1" ]]; then BUILD_ARGS+=(--disable-sandbox); fi
# SwiftPM also signs its generated resource bundles. Keep those products out
# of synced checkouts and isolate the caches of different worktrees.
if [[ -z "${SWIFTPM_BUILD_DIR:-}" ]]; then
  WORKSPACE_FINGERPRINT="$(printf %s "$ROOT_DIR" | /usr/bin/shasum -a 256 | cut -c1-16)"
  export SWIFTPM_BUILD_DIR="$HOME/Library/Caches/com.itsasheruwu.graft.mac/SwiftPM/$WORKSPACE_FINGERPRINT"
fi
BIN_DIR="$(swift build --package-path "$MACOS_DIR" "${BUILD_ARGS[@]}" --show-bin-path)"
# Only remove Finder metadata from final, generated bundle roots.
clear_bundle_finder_info() {
  if [[ -d "$1" ]] && /usr/bin/xattr -p com.apple.FinderInfo "$1" >/dev/null 2>&1; then
    /usr/bin/xattr -d com.apple.FinderInfo "$1"
  fi
}
swift build --package-path "$MACOS_DIR" "${BUILD_ARGS[@]}"

SPARKLE_FRAMEWORK="${SWIFTPM_BUILD_DIR}/artifacts/sparkle/Sparkle/Sparkle.xcframework/macos-arm64_x86_64/Sparkle.framework"
mkdir -p "$APP_MACOS" "$APP_HELPERS" "$APP_RESOURCES" "$APP_FRAMEWORKS"
/usr/bin/ditto --norsrc "$SPARKLE_FRAMEWORK" "$APP_FRAMEWORKS/Sparkle.framework"
cp -R "$BIN_DIR/GraftMac_GraftBend.bundle" "$APP_RESOURCES/"
cp "$MACOS_DIR/BENDABLE-LICENSE" "$MACOS_DIR/BENDABLE-NOTICE.md" "$APP_RESOURCES/"
cp "$BIN_DIR/Graft" "$APP_MACOS/Graft"
cp "$BIN_DIR/GraftNativeHost" "$APP_HELPERS/GraftNativeHost"
cp "$ROOT_DIR/src/assets/icons/graft-256.png" "$APP_RESOURCES/graft-256.png"
cp "$ROOT_DIR/macos/Resources/graft-spotify-bridge.js" "$APP_RESOURCES/graft-spotify-bridge.js"
mkdir -p "$APP_RESOURCES/Licenses"
cp "$SWIFTPM_BUILD_DIR/checkouts/Sparkle/LICENSE" "$APP_RESOURCES/Licenses/SPARKLE-LICENSE"
for notice in CODEXBAR-LICENSE CODEXBAR-NOTICE.md LICENSE GRAFT-MIT-LICENSE FINETUNE-LICENSE FINETUNE-NOTICE.md FINETUNE-SOURCE.json BENDABLE-LICENSE BENDABLE-NOTICE.md; do
  cp "$MACOS_DIR/$notice" "$APP_RESOURCES/Licenses/$notice"
done
chmod +x "$APP_MACOS/Graft" "$APP_HELPERS/GraftNativeHost"

cat > "$APP_CONTENTS/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>Graft</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleName</key><string>Graft</string>
  <key>CFBundleDisplayName</key><string>Graft</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$APP_VERSION</string>
  <key>CFBundleVersion</key><string>$APP_VERSION</string>
  <key>CFBundleIconFile</key><string>graft-256.png</string>
  <key>LSMinimumSystemVersion</key><string>$MIN_SYSTEM_VERSION</string>
  <key>NSAppleEventsUsageDescription</key><string>Graft reads and adjusts system audio settings when you use its audio controls.</string>
  <key>NSAudioCaptureUsageDescription</key><string>Graft uses system audio access for application volume, routing, and equalization.</string>
  <key>NSMicrophoneUsageDescription</key><string>Graft needs microphone access only when the selected audio configuration requires an input-capable device.</string>
  <key>NSBluetoothAlwaysUsageDescription</key><string>Graft uses Bluetooth when you browse or connect paired audio devices.</string>
  <key>CFBundleURLTypes</key><array><dict><key>CFBundleURLName</key><string>com.itsasheruwu.graft.audio</string><key>CFBundleURLSchemes</key><array><string>graft</string></array></dict></array>
  <key>NSPrincipalClass</key><string>NSApplication</string>
</dict></plist>
PLIST

if [[ "${GRAFT_ENABLE_UPDATES:-0}" == "1" ]]; then
  /usr/bin/plutil \
    -insert SUFeedURL -string 'https://github.com/itsasheruwu/graft/releases/latest/download/appcast.xml' "$APP_CONTENTS/Info.plist"
  /usr/bin/plutil -insert SUPublicEDKey -string 'mt2l3yQcj5mU6nwwkQz2j0w75g43DTVlOzBQ1mnyH4o=' "$APP_CONTENTS/Info.plist"
  /usr/bin/plutil -insert SURequireSignedFeed -bool YES "$APP_CONTENTS/Info.plist"
  /usr/bin/plutil -insert SUSignedFeedFailureExpirationInterval -integer 0 "$APP_CONTENTS/Info.plist"
  /usr/bin/plutil -insert SUVerifyUpdateBeforeExtraction -bool YES "$APP_CONTENTS/Info.plist"
  /usr/bin/plutil -insert SUEnableAutomaticChecks -bool YES "$APP_CONTENTS/Info.plist"
  /usr/bin/plutil -insert SUAutomaticallyUpdate -bool YES "$APP_CONTENTS/Info.plist"
fi

# SwiftPM signs the standalone executables before this app bundle and its
# Info.plist exist. Re-sign the assembled bundle so macOS sees the stable bundle
# identifier (instead of a per-build executable identifier) when granting
# notification authorization and other app-scoped privacy permissions.
# Time Sensitive notifications use a restricted entitlement and therefore need
# both a real signing identity and a matching provisioning profile. Ad-hoc builds
# remain runnable, but macOS can downgrade their Time Sensitive alerts.
CODESIGN_IDENTITY="${GRAFT_CODESIGN_IDENTITY:-}"
PROVISIONING_PROFILE="${GRAFT_PROVISIONING_PROFILE:-}"

if [[ -n "$CODESIGN_IDENTITY" && -f "$PROVISIONING_PROFILE" ]]; then
  cp "$PROVISIONING_PROFILE" "$APP_CONTENTS/embedded.provisionprofile"
  /usr/bin/codesign --force --sign "$CODESIGN_IDENTITY" "$APP_HELPERS/GraftNativeHost"
  /usr/bin/codesign --force --sign "$CODESIGN_IDENTITY" --entitlements "$MACOS_DIR/Graft.entitlements" "$APP_BUNDLE"
else
  echo "warning: no provisioned signing configuration; macOS can downgrade Time Sensitive alerts" >&2
  /usr/bin/codesign --force --sign - "$APP_HELPERS/GraftNativeHost"
  /usr/bin/codesign --force --sign - --entitlements "$MACOS_DIR/GraftLocal.entitlements" "$APP_BUNDLE"
fi
/usr/bin/codesign --verify --deep --strict "$APP_BUNDLE"
mkdir -p "$DIST_DIR"
rm -rf "$DIST_DIR/$APP_NAME.app"
/usr/bin/ditto --norsrc "$APP_BUNDLE" "$DIST_DIR/$APP_NAME.app"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
clear_bundle_finder_info "$APP_BUNDLE/Contents/Resources/GraftMac_GraftBend.bundle"
clear_bundle_finder_info "$APP_BUNDLE"
if ! SIGNATURE_ERROR="$(/usr/bin/codesign --verify --deep --strict --verbose=4 "$APP_BUNDLE" 2>&1)"; then
  # iCloud can reattach FinderInfo as soon as the bundle is accessed. Verify
  # the actual dist contents on a clean volume, including the nested helper.
  if [[ "$SIGNATURE_ERROR" != *"Disallowed xattr com.apple.FinderInfo"* ]]; then
    echo "$SIGNATURE_ERROR" >&2
    exit 1
  fi
  VERIFY_BUNDLE="$ASSEMBLY_DIR/dist-copy/$APP_NAME.app"
  /usr/bin/ditto --norsrc --noextattr "$APP_BUNDLE" "$VERIFY_BUNDLE"
  /usr/bin/codesign --verify --deep --strict "$VERIFY_BUNDLE"
  echo "Verified the exported app after removing cloud-added Finder metadata." >&2
fi

open_app() {
  # Chrome keeps native hosts alive across app rebuilds. Reconnect them to the
  # newly assembled helper so an old settings writer cannot remain in memory.
  /usr/bin/pkill -TERM -x GraftNativeHost >/dev/null 2>&1 || true
  /usr/bin/open -n "$APP_BUNDLE"
}

case "$MODE" in
  build|--build) ;;
  run) open_app ;;
  --debug|debug) lldb -- "$APP_MACOS/Graft" ;;
  --logs|logs) open_app; /usr/bin/log stream --info --style compact --predicate "process == \"$APP_NAME\"" ;;
  --telemetry|telemetry) open_app; /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\"" ;;
  --verify|verify) open_app; sleep 2; pgrep -x "$APP_NAME" >/dev/null ;;
  *) echo "usage: $0 [build|run|--debug|--logs|--telemetry|--verify]" >&2; exit 2 ;;
esac
