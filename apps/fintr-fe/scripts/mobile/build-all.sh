#!/bin/bash
set -e

echo "🚀 Building Fintr Mobile Apps"
echo "================================"
echo ""

# First, build and sync web assets
./build-production.sh

echo ""
echo "📦 Building Native Apps..."
echo ""

# Build Android APK
if [ -d "android" ]; then
    echo "🤖 Building Android APK..."
    cd android
    ./gradlew assembleRelease
    cd ..
    echo "✅ Android APK: android/app/build/outputs/apk/release/app-release-unsigned.apk"
    echo "   Note: This is an unsigned APK. Sign it before distribution."
    echo ""
fi

echo "📱 iOS App:"
echo "  To create iOS IPA:"
echo "  1. Run: npx cap open ios"
echo "  2. In Xcode: Product → Archive"
echo "  3. Distribute App → Choose distribution method"
echo ""
echo "✅ Build complete!"
