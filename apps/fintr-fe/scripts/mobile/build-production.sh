#!/bin/bash
set -e

# FIN-194: production Capacitor builds ship the static `out/` shell in the native
# binary (no remote https://www.fintr.ai WebView load). For live-reload / remote
# shell experiments, set CAPACITOR_SERVER_URL explicitly before sync.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Production Build & Deploy to iOS (bundled shell)"
echo "==================================================="
echo ""
echo "This script will:"
echo "  1. Clean previous builds"
echo "  2. Build production static export"
echo "  3. Sync Capacitor with CAPACITOR_SERVER_URL UNSET (bundled out/)"
echo "  4. Verify config has no remote server.url"
echo "  5. Open the iOS project in Xcode"
echo ""

echo "🧹 Step 1: Cleaning previous builds..."
rm -rf .next out
rm -rf ios/App/App/capacitor.config.json
rm -rf android/app/src/main/assets/capacitor.config.json
echo "✅ Clean complete"
echo ""

echo "⚙️  Step 2: Setting up environment..."
unset CAPACITOR_SERVER_URL
echo "✅ CAPACITOR_SERVER_URL unset (app uses bundled webDir: out/)"

# shellcheck source=scripts/mobile/load-mobile-env.sh
source "${SCRIPT_DIR}/load-mobile-env.sh"

export NEXT_PUBLIC_APP_BASE_URL="https://www.fintr.ai"
echo "✅ Environment configured"
echo ""

echo "🔨 Step 3: Building Next.js app for Capacitor..."
export NEXT_OUTPUT_MODE=export

cat > next.config.capacitor.ts << 'NEXTCONFIG'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
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

cp next.config.ts next.config.ts.backup
cp next.config.capacitor.ts next.config.ts
export NODE_ENV=production
pnpm build
mv next.config.ts.backup next.config.ts
rm next.config.capacitor.ts

if [ ! -d "out" ]; then
  echo "❌ ERROR: Build did not create 'out' directory"
  exit 1
fi

echo "✅ Next.js build complete"
echo ""

echo "🔄 Step 4: Syncing to Capacitor (iOS + Android)..."
unset CAPACITOR_SERVER_URL
npx cap sync
echo "✅ Capacitor sync complete"
echo ""

echo "🔍 Step 5: Verifying bundled shell (no remote server.url)..."
IOS_CONFIG="ios/App/App/capacitor.config.json"
ANDROID_CONFIG="android/app/src/main/assets/capacitor.config.json"

for CONFIG in "$IOS_CONFIG" "$ANDROID_CONFIG"; do
  if [ ! -f "$CONFIG" ]; then
    echo "❌ ERROR: missing $CONFIG"
    exit 1
  fi
  if grep -q '"url"' "$CONFIG"; then
    echo "❌ ERROR: $CONFIG still has server.url — bundled shell requires it unset"
    grep -A 5 '"server"' "$CONFIG" || true
    exit 1
  fi
  if grep -q 'localhost' "$CONFIG"; then
    echo "❌ ERROR: $CONFIG contains localhost"
    exit 1
  fi
done

echo "✅ Capacitor config is bundled (no remote server.url)"
echo ""

echo "📱 Step 6: Opening iOS project in Xcode..."
npx cap open ios

echo ""
echo "✅ Bundled-shell production project ready."
echo "   Cold open loads local out/ assets, not https://www.fintr.ai."
echo "   API calls still use NEXT_PUBLIC_BE_URL from .env.mobile.production."
echo ""
echo "📋 Additional distribution options:"
echo ""
echo "📱 iOS Archive (for App Store/Ad Hoc/TestFlight):"
echo "  1. In Xcode: Product → Archive"
echo "  2. After archive: Distribute App → Ad Hoc/App Store/Development"
echo ""
echo "🤖 Android Build:"
echo "  ./scripts/mobile/build-production-android.sh"
echo ""
