#!/bin/bash
set -e

# Run from repo root (fintr-fe): ./scripts/mobile/build-production-android.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Script is in fintr-fe/scripts/mobile, so project root is two levels up
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Production Build (Android)"
echo "============================="
echo ""
echo "This script will:"
echo "  1. Clean previous builds"
echo "  2. Load .env.production (production API URLs)"
echo "  3. Build Next.js static export for Capacitor"
echo "  4. Sync to Android"
echo "  5. Run on Android emulator (or show APK/AAB instructions)"
echo ""

# Step 1: Clean previous builds
echo "🧹 Step 1: Cleaning previous builds..."
rm -rf .next out
rm -f ios/App/App/capacitor.config.json
rm -f android/app/src/main/assets/capacitor.config.json
echo "✅ Clean complete"
echo ""

# Step 2: Set up environment
echo "⚙️  Step 2: Setting up environment..."

export CAPACITOR_SERVER_URL=""
unset CAPACITOR_SERVER_URL

if [ -n "${CAPACITOR_SERVER_URL}" ]; then
  echo "❌ ERROR: CAPACITOR_SERVER_URL is still set: ${CAPACITOR_SERVER_URL}"
  exit 1
fi
echo "✅ CAPACITOR_SERVER_URL is unset"

if [ -f .env.production ]; then
  echo "Loading .env.production..."
  set -a
  source .env.production
  set +a
else
  echo "⚠️  .env.production not found"
fi

export NEXT_PUBLIC_APP_BASE_URL="https://www.fintr.ai"
echo "✅ Environment configured (NEXT_PUBLIC_BE_URL=${NEXT_PUBLIC_BE_URL:-not set})"
echo ""

# Step 3: Build Next.js app
echo "🔨 Step 3: Building Next.js app for Capacitor..."

export NEXT_OUTPUT_MODE=export

cat > next.config.capacitor.ts << 'NEXTCONFIG'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typescript: { ignoreBuildErrors: true },
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
pnpm build
mv next.config.ts.backup next.config.ts
rm next.config.capacitor.ts

if [ ! -d "out" ]; then
  echo "❌ ERROR: Build did not create 'out' directory"
  exit 1
fi
echo "✅ Next.js build complete"
echo ""

# Step 4: Sync to Android
echo "🔄 Step 4: Syncing to Android..."
export CAPACITOR_SERVER_URL=""
unset CAPACITOR_SERVER_URL
npx cap sync android
echo "✅ Capacitor sync complete"
echo ""

# Step 5: Verify no dev server in config
if grep -q '"server"' android/app/src/main/assets/capacitor.config.json 2>/dev/null; then
  echo "❌ ERROR: capacitor.config.json contains 'server' (would load from localhost)"
  exit 1
fi
echo "✅ Capacitor config OK (bundled app)"
echo ""

# Step 6: Run on emulator
echo "📱 Step 6: Running on Android emulator..."
echo "   (Start an AVD in Device Manager first if none is running.)"
echo ""
npx cap run android

echo ""
echo "✅ Production build is running on the emulator."
echo ""
echo "📋 Other options:"
echo "  • APK (install on device): cd android && ./gradlew assembleRelease"
echo "  • AAB (Play Store):        ./scripts/mobile/build-android-aab.sh"
echo ""
