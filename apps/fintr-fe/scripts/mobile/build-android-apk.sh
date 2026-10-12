#!/bin/bash
set -e

echo "🤖 Building Android APK..."
echo ""

# shellcheck source=scripts/mobile/ensure-gradle-jdk.sh
source "$(dirname "${BASH_SOURCE[0]}")/ensure-gradle-jdk.sh"

cd android

# Build release APK
./gradlew assembleRelease

echo ""
echo "✅ APK built successfully!"
echo "📦 Location: android/app/build/outputs/apk/release/app-release-unsigned.apk"
echo ""
echo "Note: This is an unsigned APK. To sign it for distribution:"
echo "  1. Generate a keystore (if you don't have one)"
echo "  2. Configure signing in android/app/build.gradle"
echo ""
echo "To build AAB for Play Store instead:"
echo "  ./gradlew bundleRelease"
echo "  Location: android/app/build/outputs/bundle/release/app-release.aab"
