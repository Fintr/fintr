#!/bin/bash
set -e

echo "📦 Building Android App Bundle (AAB) for Google Play..."
echo ""

cd android

# Build release AAB
./gradlew bundleRelease

echo ""
echo "✅ AAB built successfully!"
echo "📦 Location: android/app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "This AAB file is ready to upload to Google Play Console for:"
echo "  - Internal testing"
echo "  - Closed testing"
echo "  - Open testing"
echo "  - Production release"
echo ""
echo "Note: Make sure you have a keystore configured for signing."
echo "      If not, run: cd android && ./create-keystore.sh"
