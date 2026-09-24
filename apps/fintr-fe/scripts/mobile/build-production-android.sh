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
  echo "  2. Load .env.mobile.production (production API URLs)"
  echo "  3. Build Next.js static export for Capacitor"
  echo "  4. Sync to Android"
  echo "  5. Build release ${ANDROID_ARTIFACT:-apk} (Gradle; ANDROID_ARTIFACT=apk|aab)"
  echo ""
else
  echo "This script will:"
  echo "  1. Clean previous builds"
  echo "  2. Load .env.mobile.production (production API URLs)"
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

# FIN-194: bundled shell — cold open uses local out/, not remote fintr.ai
PRODUCTION_WEB_URL="https://www.fintr.ai"
unset CAPACITOR_SERVER_URL
echo "App will use bundled webDir (CAPACITOR_SERVER_URL unset)"

# shellcheck source=scripts/mobile/load-mobile-env.sh
source "${SCRIPT_DIR}/load-mobile-env.sh"

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

# Local .env often sets NODE_ENV=development for `pnpm dev`. If that value is picked up
# during `next build`, static export fails (PageNotFoundError: Cannot find module /_document).
export NODE_ENV=production
pnpm build
mv next.config.ts.backup next.config.ts
rm next.config.capacitor.ts

if [ ! -d "out" ]; then
  echo "ERROR: Build did not create 'out' directory"
  exit 1
fi
echo "Next.js build complete"
echo ""

# Step 4: Sync to Android (bundled out/ shell)
echo "Step 4: Syncing to Android..."
unset CAPACITOR_SERVER_URL
mkdir -p android/app/src/main/assets
npx cap sync android
echo "Capacitor sync complete"
echo ""

# Step 5: Verify bundled shell (no remote server.url)
ANDROID_CONFIG="android/app/src/main/assets/capacitor.config.json"
if [ ! -f "$ANDROID_CONFIG" ]; then
  echo "ERROR: missing $ANDROID_CONFIG"
  exit 1
fi
if grep -q '"url"' "$ANDROID_CONFIG"; then
  echo "ERROR: capacitor.config.json still has server.url — bundled shell requires it unset"
  grep -A 5 '"server"' "$ANDROID_CONFIG" || true
  exit 1
fi
if grep -q 'localhost' "$ANDROID_CONFIG"; then
  echo "ERROR: config contains localhost"
  exit 1
fi
echo "Capacitor config OK (bundled shell, no remote server.url)"
echo ""

# Step 6: Release artifact (no emulator) or run on emulator
if [ "${SKIP_EMULATOR:-}" = "1" ]; then
  echo "Step 6: Building Android release (emulator skipped)..."
  echo ""

  KEYSTORE_PROPERTIES="${PROJECT_ROOT}/android/keystore.properties"
  if [ ! -f "$KEYSTORE_PROPERTIES" ]; then
    echo "ERROR: Release builds must be signed to install on a device or upload to Play Store."
    echo ""
    echo "   android/keystore.properties is missing."
    echo ""
    echo "   One-time setup:"
    echo "     cd android"
    echo "     ./create-keystore.sh"
    echo ""
    echo "   Then re-run: make android-prod-apk"
    echo ""
    echo "   See android/SIGNING.md for details."
    exit 1
  fi

  # keystore.properties points at the .jks file; both are required (neither is in git)
  STORE_FILE="$(grep '^storeFile=' "$KEYSTORE_PROPERTIES" | cut -d= -f2- | tr -d '\r' | xargs)"
  if [ -z "$STORE_FILE" ]; then
    echo "ERROR: android/keystore.properties must set storeFile=..."
    exit 1
  fi
  if [[ "$STORE_FILE" = /* ]]; then
    KEYSTORE_JKS="$STORE_FILE"
  elif [[ "$STORE_FILE" == app/* ]]; then
    KEYSTORE_JKS="${PROJECT_ROOT}/android/${STORE_FILE}"
  else
    KEYSTORE_JKS="${PROJECT_ROOT}/android/app/${STORE_FILE}"
  fi
  if [ ! -f "$KEYSTORE_JKS" ]; then
    echo "ERROR: Keystore file not found:"
    echo "   ${KEYSTORE_JKS}"
    echo ""
    echo "   keystore.properties only tells Gradle where to look."
    echo "   Copy your existing .jks from backup to that path (do not run create-keystore.sh"
    echo "   if you already published to Play — use the original keystore file)."
    echo ""
    echo "   Expected with your current storeFile=${STORE_FILE}:"
    echo "     android/app/fintr-release-key.jks"
    exit 1
  fi

  ARTIFACT="${ANDROID_ARTIFACT:-apk}"
  case "$ARTIFACT" in
    apk)
      cd android
      ./gradlew assembleRelease
      RELEASE_APK_DIR="app/build/outputs/apk/release"
      SIGNED_APK="${RELEASE_APK_DIR}/app-release.apk"
      UNSIGNED_APK="${RELEASE_APK_DIR}/app-release-unsigned.apk"
      echo ""
      if [ -f "$SIGNED_APK" ]; then
        echo "✅ Signed release APK (install this on your phone):"
        echo "   android/${SIGNED_APK}"
      elif [ -f "$UNSIGNED_APK" ]; then
        echo "ERROR: Gradle produced an unsigned APK. Check android/keystore.properties and android/SIGNING.md"
        exit 1
      else
        echo "ERROR: No release APK found in android/${RELEASE_APK_DIR}/"
        exit 1
      fi
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
