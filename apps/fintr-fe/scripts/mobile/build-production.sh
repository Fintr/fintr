#!/bin/bash
set -e

echo "🚀 Production Build & Deploy to iOS"
echo "===================================="
echo ""
echo "This script will:"
echo "  1. Clean previous builds"
echo "  2. Build production app"
echo "  3. Sync to Capacitor"
echo "  4. Verify configuration"
echo "  5. Open the iOS project in Xcode"
echo ""

# Step 1: Clean previous builds
echo "🧹 Step 1: Cleaning previous builds..."
rm -rf .next out
rm -rf ios/App/App/capacitor.config.json
rm -rf android/app/src/main/assets/capacitor.config.json
echo "✅ Clean complete"
echo ""

# Step 2: Set up environment
echo "⚙️  Step 2: Setting up environment..."

# Production app loads the web app from the live website so updates appear without app store release
PRODUCTION_WEB_URL="https://www.fintr.ai"
echo "🔧 App will load web app from: ${PRODUCTION_WEB_URL}"
export CAPACITOR_SERVER_URL="${PRODUCTION_WEB_URL}"
echo "✅ CAPACITOR_SERVER_URL set (app will use live website)"

# Export all variables from .env.production
if [ -f .env.production ]; then
    echo "Loading environment variables from .env.production..."
    # Use a safer method to export variables (handles values with spaces, special chars)
    set -a
    source .env.production
    set +a
else
    echo "Warning: .env.production not found"
fi

# IMPORTANT: For Capacitor builds, we need to use the production web URL
# as the base URL during build time, NOT the custom URL scheme
# The custom scheme (fintrapp://) is only used at runtime for deep linking
echo "Overriding NEXT_PUBLIC_APP_BASE_URL for Capacitor build..."
export NEXT_PUBLIC_APP_BASE_URL="https://www.fintr.ai"
echo "✅ Environment configured"
echo ""

# Step 3: Build Next.js app
echo "🔨 Step 3: Building Next.js app for Capacitor..."

# For Capacitor, we need static export, not standalone
export NEXT_OUTPUT_MODE=export

# Create a temporary next.config that exports to 'out'
cat > next.config.capacitor.ts << 'NEXTCONFIG'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true, // Required for static export
    domains: [
      "fintr-development.s3.ap-southeast-1.amazonaws.com",
      "fintr-staging.s3.ap-southeast-1.amazonaws.com",
      "fintr-production.s3.ap-southeast-1.amazonaws.com",
      "s3.ap-southeast-1.amazonaws.com",
      "raw.githubusercontent.com"
    ],
  },
};

export default nextConfig;
NEXTCONFIG

# Backup original config
cp next.config.ts next.config.ts.backup

# Use the Capacitor config
cp next.config.capacitor.ts next.config.ts

# Build the Next.js app
pnpm build

# Restore original config
mv next.config.ts.backup next.config.ts
rm next.config.capacitor.ts

# Verify out directory exists
if [ ! -d "out" ]; then
    echo "❌ ERROR: Build did not create 'out' directory"
    exit 1
fi

echo "✅ Next.js build complete"
echo ""

# Step 4: Sync Capacitor (both platforms); app will load from PRODUCTION_WEB_URL
echo "🔄 Step 4: Syncing to Capacitor (iOS + Android)..."

export CAPACITOR_SERVER_URL="${PRODUCTION_WEB_URL}"
npx cap sync

echo "✅ Capacitor sync complete"
echo ""

# Step 5: Verify configuration (app must load from production URL, not localhost)
echo "🔍 Step 5: Verifying Capacitor configuration..."

if ! grep -qF "\"url\": \"${PRODUCTION_WEB_URL}" ios/App/App/capacitor.config.json 2>/dev/null; then
    echo "❌ ERROR: capacitor.config.json should load from ${PRODUCTION_WEB_URL}"
    echo "Generated config:"
    grep -A 2 '"server"' ios/App/App/capacitor.config.json 2>/dev/null || true
    exit 1
fi
if grep -q 'localhost' ios/App/App/capacitor.config.json 2>/dev/null; then
    echo "❌ ERROR: config contains localhost; production should use ${PRODUCTION_WEB_URL}"
    exit 1
fi

echo "✅ Capacitor config is correct (app loads from ${PRODUCTION_WEB_URL})"
echo ""

# Step 6: Open iOS project in Xcode
echo "📱 Step 6: Opening iOS project in Xcode..."
echo ""

npx cap open ios

echo ""
echo "✅ Xcode should be open with the production Capacitor iOS project."
echo ""
echo "📋 The app loads the web app from ${PRODUCTION_WEB_URL}. When you deploy updates"
echo "   to the website, users get them automatically — no app store update needed."
echo ""
echo "📋 Additional distribution options:"
echo ""
echo "📱 iOS Archive (for App Store/Ad Hoc/TestFlight):"
echo "  1. In Xcode: Product → Archive"
echo "  3. After archive: Distribute App → Ad Hoc/App Store/Development"
echo ""
echo "🤖 Android Build:"
echo "  For APK (testing): cd android && ./gradlew assembleRelease"
echo "  For AAB (Play Store): cd android && ./gradlew bundleRelease"
echo ""
