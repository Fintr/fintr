#!/bin/bash
set -e

# Run from repo root (fintr-fe): ./scripts/mobile/build-production-android.sh
#
# No emulator / store artifacts: SKIP_EMULATOR=1 ANDROID_ARTIFACT=apk|aab
#   (make android-prod-apk | make android-prod-aab)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Script is in fintr-fe/scripts/mobile, so project root is two levels up
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "Production Build (Android)"
echo "==========================="
echo ""
if [ "${SKIP_EMULATOR:-}" = "1" ]; then
  echo "This script will (SKIP_EMULATOR=1 — no emulator):"
  echo "  1. Clean previous builds"
  echo "  2. Load .env.production (production API URLs)"
  echo "  3. Build Next.js static export for Capacitor"
  echo "  4. Sync to Android"
  echo "  5. Build release ${ANDROID_ARTIFACT:-apk} (Gradle; ANDROID_ARTIFACT=apk|aab)"
  echo ""
else
  echo "This script will:"
  echo "  1. Clean previous builds"
  echo "  2. Load .env.production (production API URLs)"
  echo "  3. Build Next.js static export for Capacitor"
  echo "  4. Sync to Android"
  echo "  5. Run on Android emulator (or show APK/AAB instructions)"
  echo ""
fi

# Step 1: Clean previous builds
echo "Step 1: Cleaning previous builds..."
rm -rf .next out
rm -f ios/App/App/capacitor.config.json
rm -f android/app/src/main/assets/capacitor.config.json
echo "Clean complete"
echo ""

# Step 2: Set up environment
echo "Step 2: Setting up environment..."

# App loads web from live URL so website updates apply without app store release
# Use www so the app hits the same origin as the live site (avoids redirect/blank in WebView)
PRODUCTION_WEB_URL="https://www.fintr.ai"
export CAPACITOR_SERVER_URL="${PRODUCTION_WEB_URL}"
echo "App will load web app from: ${PRODUCTION_WEB_URL}"

if [ -f .env.production ]; then
  echo "Loading .env.production..."
  set -a
  source .env.production
  set +a
else
  echo "Warning: .env.production not found"
fi

export NEXT_PUBLIC_APP_BASE_URL="${PRODUCTION_WEB_URL}"
echo "Environment configured (NEXT_PUBLIC_BE_URL=${NEXT_PUBLIC_BE_URL:-not set})"
echo ""

# Step 3: Build Next.js app
echo "Step 3: Building Next.js app for Capacitor..."

export NEXT_OUTPUT_MODE=export

cat > next.config.capacitor.ts << 'NEXTCONFIG'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typescript: { ignoreBuildErrors: true },
  experimental: {
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
    staticGenerationRetryCount: 3,
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
pnpm build
mv next.config.ts.backup next.config.ts
rm next.config.capacitor.ts

if [ ! -d "out" ]; then
  echo "ERROR: Build did not create 'out' directory"
  exit 1
fi
echo "Next.js build complete"
echo ""

# Step 4: Sync to Android (app will load from PRODUCTION_WEB_URL)
echo "Step 4: Syncing to Android..."
export CAPACITOR_SERVER_URL="${PRODUCTION_WEB_URL}"
mkdir -p android/app/src/main/assets
npx cap sync android
echo "Capacitor sync complete"
echo ""

# Step 5: Verify app loads from production URL (config may include ?cv=...)
if ! grep -qF "\"url\": \"${PRODUCTION_WEB_URL}" android/app/src/main/assets/capacitor.config.json 2>/dev/null; then
  echo "ERROR: capacitor.config.json should load from ${PRODUCTION_WEB_URL}"
  grep -A 2 '"server"' android/app/src/main/assets/capacitor.config.json 2>/dev/null || true
  exit 1
fi
if grep -q 'localhost' android/app/src/main/assets/capacitor.config.json 2>/dev/null; then
  echo "ERROR: config contains localhost; production should use ${PRODUCTION_WEB_URL}"
  exit 1
fi
echo "Capacitor config OK (app loads from ${PRODUCTION_WEB_URL})"
echo ""

# Step 6: Release artifact (no emulator) or run on emulator
if [ "${SKIP_EMULATOR:-}" = "1" ]; then
  echo "Step 6: Building Android release (emulator skipped)..."
  echo ""
  ARTIFACT="${ANDROID_ARTIFACT:-apk}"
  case "$ARTIFACT" in
    apk)
      cd android
      ./gradlew assembleRelease
      echo ""
      echo "✅ Release APK: android/app/build/outputs/apk/release/app-release-unsigned.apk"
      echo ""
      ;;
    aab)
      cd android
      ./gradlew bundleRelease
      echo ""
      echo "✅ Release AAB: android/app/build/outputs/bundle/release/app-release.aab"
      echo ""
      ;;
    *)
      echo "ERROR: ANDROID_ARTIFACT must be apk or aab (got: ${ARTIFACT})"
      exit 1
      ;;
  esac
  echo "The app loads from ${PRODUCTION_WEB_URL}; website updates apply without app store release."
  echo ""
else
  echo "Step 6: Running on Android emulator..."
  echo ""

  # Auto-launch emulator with correct DNS if none is running
  RUNNING_EMULATOR=$(/Users/mikodagatan/Library/Android/sdk/platform-tools/adb devices 2>/dev/null | grep "^emulator" | head -1 | cut -f1)

  if [ -z "$RUNNING_EMULATOR" ]; then
    AVD_NAME=$(/Users/mikodagatan/Library/Android/sdk/emulator/emulator -list-avds 2>/dev/null | head -1)
    if [ -n "$AVD_NAME" ]; then
      echo "Launching emulator: $AVD_NAME (with DNS 8.8.8.8)..."
      # Remove stale lock files
      AVD_DIR=$(find ~/.android/avd -name "*.avd" -maxdepth 1 -type d 2>/dev/null | head -1)
      [ -n "$AVD_DIR" ] && rm -f "${AVD_DIR}/multiinstance.lock"
      nohup /Users/mikodagatan/Library/Android/sdk/emulator/emulator \
        -avd "$AVD_NAME" \
        -dns-server 8.8.8.8,8.8.4.4 \
        -no-snapshot-load \
        > /tmp/android-emulator.log 2>&1 &
      echo "   Waiting for emulator to boot (~60s)..."
      sleep 10
      /Users/mikodagatan/Library/Android/sdk/platform-tools/adb wait-for-device
      until [ "$(/Users/mikodagatan/Library/Android/sdk/platform-tools/adb shell getprop sys.boot_completed 2>/dev/null)" = "1" ]; do
        sleep 3
      done
      echo "Emulator booted"
    else
      echo "Warning: No AVD found. Create one in Android Studio Device Manager first."
      exit 1
    fi
  else
    echo "Using running emulator: $RUNNING_EMULATOR"
  fi
  echo ""
  npx cap run android
  echo ""
  echo "Production build is running on the emulator."
  echo ""
  echo "The app loads from ${PRODUCTION_WEB_URL}; website updates apply without app store release."
  echo ""
  echo "If the app opens but the screen is blank:"
  echo "  - Close this emulator and re-run this script (it auto-launches a fresh one with DNS 8.8.8.8)."
  echo "  - On your computer, open Chrome -> chrome://inspect -> find your app WebView -> Inspect to see console/network errors."
  echo "  - Quick local test (no DNS needed):"
  echo "      Terminal 1: pnpm dev"
  echo "      Terminal 2: export CAPACITOR_SERVER_URL=http://10.0.2.2:5173 && npx cap sync android && npx cap run android"
  echo ""
  echo "Other options:"
  echo "  - APK only (no emulator): SKIP_EMULATOR=1 ./scripts/mobile/build-production-android.sh"
  echo "  - AAB (Play Store):       SKIP_EMULATOR=1 ANDROID_ARTIFACT=aab ./scripts/mobile/build-production-android.sh"
  echo ""
fi
