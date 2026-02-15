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

# App loads web from live URL so website updates apply without app store release
PRODUCTION_WEB_URL="https://fintr.ai"
export CAPACITOR_SERVER_URL="${PRODUCTION_WEB_URL}"
echo "🔧 App will load web app from: ${PRODUCTION_WEB_URL}"

if [ -f .env.production ]; then
  echo "Loading .env.production..."
  set -a
  source .env.production
  set +a
else
  echo "⚠️  .env.production not found"
fi

export NEXT_PUBLIC_APP_BASE_URL="${PRODUCTION_WEB_URL}"
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

# Step 4: Sync to Android (app will load from PRODUCTION_WEB_URL)
echo "🔄 Step 4: Syncing to Android..."
export CAPACITOR_SERVER_URL="${PRODUCTION_WEB_URL}"
npx cap sync android
echo "✅ Capacitor sync complete"
echo ""

# Step 5: Verify app loads from production URL
if ! grep -q "\"url\": \"${PRODUCTION_WEB_URL}\"" android/app/src/main/assets/capacitor.config.json 2>/dev/null; then
  echo "❌ ERROR: capacitor.config.json should load from ${PRODUCTION_WEB_URL}"
  grep -A 2 '"server"' android/app/src/main/assets/capacitor.config.json 2>/dev/null || true
  exit 1
fi
if grep -q 'localhost' android/app/src/main/assets/capacitor.config.json 2>/dev/null; then
  echo "❌ ERROR: config contains localhost; production should use ${PRODUCTION_WEB_URL}"
  exit 1
fi
echo "✅ Capacitor config OK (app loads from ${PRODUCTION_WEB_URL})"
echo ""

# Step 6: Run on emulator
echo "📱 Step 6: Running on Android emulator..."
echo "   (Start an AVD in Device Manager first if none is running.)"
echo ""
npx cap run android

echo ""
echo "✅ Production build is running on the emulator."
echo ""
echo "📋 The app loads from ${PRODUCTION_WEB_URL}; website updates apply without app store release."
echo ""
echo "📋 Other options:"
echo "  • APK (install on device): cd android && ./gradlew assembleRelease"
echo "  • AAB (Play Store):        ./scripts/mobile/build-android-aab.sh"
echo ""
