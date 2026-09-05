#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="Graft"
BUNDLE_ID="com.itsasheruwu.graft.mac"
MIN_SYSTEM_VERSION="15.0"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MACOS_DIR="$ROOT_DIR/macos"
DIST_DIR="$ROOT_DIR/dist"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_HELPERS="$APP_CONTENTS/Helpers"
APP_RESOURCES="$APP_CONTENTS/Resources"

pkill -x "$APP_NAME" >/dev/null 2>&1 || true

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

swift build --package-path "$MACOS_DIR" "${LINK_ARGS[@]}"
BIN_DIR="$(swift build --package-path "$MACOS_DIR" "${LINK_ARGS[@]}" --show-bin-path)"

rm -rf "$APP_BUNDLE"
mkdir -p "$APP_MACOS" "$APP_HELPERS" "$APP_RESOURCES"
cp "$BIN_DIR/Graft" "$APP_MACOS/Graft"
cp "$BIN_DIR/GraftNativeHost" "$APP_HELPERS/GraftNativeHost"
cp "$ROOT_DIR/src/assets/icons/graft-256.png" "$APP_RESOURCES/graft-256.png"
cp "$ROOT_DIR/macos/Resources/graft-spotify-bridge.js" "$APP_RESOURCES/graft-spotify-bridge.js"
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
  <key>CFBundleIconFile</key><string>graft-256.png</string>
  <key>LSMinimumSystemVersion</key><string>$MIN_SYSTEM_VERSION</string>
  <key>NSPrincipalClass</key><string>NSApplication</string>
</dict></plist>
PLIST

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
  /usr/bin/codesign --force --sign - "$APP_BUNDLE"
fi
/usr/bin/codesign --verify --deep --strict "$APP_BUNDLE"

open_app() { /usr/bin/open -n "$APP_BUNDLE"; }

case "$MODE" in
  run) open_app ;;
  --debug|debug) lldb -- "$APP_MACOS/Graft" ;;
  --logs|logs) open_app; /usr/bin/log stream --info --style compact --predicate "process == \"$APP_NAME\"" ;;
  --telemetry|telemetry) open_app; /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\"" ;;
  --verify|verify) open_app; sleep 2; pgrep -x "$APP_NAME" >/dev/null ;;
  *) echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2; exit 2 ;;
esac
