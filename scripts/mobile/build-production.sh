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
echo "  5. Run on iOS simulator"
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

# CRITICAL: Unset CAPACITOR_SERVER_URL to use bundled files instead of localhost
# This ensures the production build uses the static files in the app bundle
echo "🔧 Unsetting CAPACITOR_SERVER_URL to use bundled app..."
export CAPACITOR_SERVER_URL=""
unset CAPACITOR_SERVER_URL

# Verify it's unset
if [ ! -z "${CAPACITOR_SERVER_URL}" ]; then
    echo "❌ ERROR: CAPACITOR_SERVER_URL is still set!"
    echo "Value: ${CAPACITOR_SERVER_URL}"
    exit 1
fi
echo "✅ CAPACITOR_SERVER_URL is unset"

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

# Step 4: Sync Capacitor
echo "🔄 Step 4: Syncing to Capacitor..."

# Double-check CAPACITOR_SERVER_URL is still unset before sync
export CAPACITOR_SERVER_URL=""
unset CAPACITOR_SERVER_URL

npx cap sync ios

echo "✅ Capacitor sync complete"
echo ""

# Step 5: Verify configuration
echo "🔍 Step 5: Verifying Capacitor configuration..."

if grep -q '"server"' ios/App/App/capacitor.config.json 2>/dev/null; then
    echo "❌ ERROR: capacitor.config.json contains 'server' configuration!"
    echo "This will cause the app to try loading from localhost instead of bundled files."
    echo ""
    echo "Generated config contains:"
    grep -A 3 '"server"' ios/App/App/capacitor.config.json
    echo ""
    echo "Your shell environment might have CAPACITOR_SERVER_URL set."
    echo ""
    echo "To fix, run these commands in your terminal:"
    echo "  unset CAPACITOR_SERVER_URL"
    echo "  echo 'export CAPACITOR_SERVER_URL=\"\"' >> ~/.zshrc"
    echo "  source ~/.zshrc"
    echo ""
    exit 1
fi

echo "✅ Capacitor config is correct (no server URL)"
echo ""

# Step 6: Run on iOS simulator
echo "📱 Step 6: Running on iOS simulator..."
echo ""

npx cap run ios

echo ""
echo "✅ Production build is now running on iOS simulator!"
echo ""
echo "📋 Additional distribution options:"
echo ""
echo "📱 iOS Archive (for App Store/Ad Hoc/TestFlight):"
echo "  1. Open Xcode: npx cap open ios"
echo "  2. In Xcode: Product → Archive"
echo "  3. After archive: Distribute App → Ad Hoc/App Store/Development"
echo ""
echo "🤖 Android Build:"
echo "  For APK (testing): cd android && ./gradlew assembleRelease"
echo "  For AAB (Play Store): cd android && ./gradlew bundleRelease"
echo ""
