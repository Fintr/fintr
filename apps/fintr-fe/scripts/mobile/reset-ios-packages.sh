#!/bin/bash
# Reset corrupted Xcode DerivedData / SwiftPM artifacts (e.g. Facebook SDK zips).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
IOS_WORKSPACE="$PROJECT_ROOT/ios/App/App.xcworkspace"
SWIFTPM_CACHE="$HOME/Library/Caches/org.swift.swiftpm"

if [ ! -d "$IOS_WORKSPACE" ]; then
  echo "iOS workspace not found at $IOS_WORKSPACE" >&2
  echo "Run: pnpm cap sync ios" >&2
  exit 1
fi

echo "Removing Xcode DerivedData for App..."
rm -rf "$HOME/Library/Developer/Xcode/DerivedData/App-"* 2>/dev/null || true

echo "Removing local iOS build folders..."
rm -rf "$PROJECT_ROOT/ios/build" 2>/dev/null || true
rm -rf "$PROJECT_ROOT/ios/App/build" 2>/dev/null || true

echo "Clearing SwiftPM caches..."
rm -rf "$SWIFTPM_CACHE" 2>/dev/null || true
rm -f "$HOME/Library/org.swift.swiftpm/security/fingerprints/facebook-ios-sdk-"*.json 2>/dev/null || true

resolve_packages() {
  xcodebuild \
    -resolvePackageDependencies \
    -workspace "$IOS_WORKSPACE" \
    -scheme App
}

echo "Resolving Swift packages..."
if resolve_packages; then
  echo "Swift packages resolved. Rebuild in Xcode or run: make ios-dev"
  exit 0
fi

echo "Package resolve failed; clearing any stale Facebook artifact entries and retrying..."
find "$HOME/Library/Caches" -maxdepth 4 -name '*facebook*' -print0 2>/dev/null \
  | xargs -0 rm -rf 2>/dev/null || true
rm -rf "$SWIFTPM_CACHE" 2>/dev/null || true

resolve_packages
echo "Swift packages resolved. Rebuild in Xcode or run: make ios-dev"
