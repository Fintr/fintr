#!/bin/bash
set -e

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

# For Capacitor, we need static export, not standalone
# Temporarily modify next.config.ts or use environment variable
echo "Building Next.js app for Capacitor (static export)..."
export NEXT_OUTPUT_MODE=export

# Build with static export for Capacitor
# We'll need to temporarily change the output mode
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
    echo "Error: Build did not create 'out' directory"
    exit 1
fi

# Sync Capacitor
echo "Syncing Capacitor..."
npx cap sync

echo "Build and sync complete!"
echo ""
echo "Note: This syncs web assets to native projects."
echo ""
echo "To create distributable apps:"
echo ""
echo "📱 iOS (IPA file):"
echo "  1. Open Xcode: npx cap open ios"
echo "  2. In Xcode: Product → Archive"
echo "  3. After archive: Distribute App → Ad Hoc/App Store/Development"
echo ""
echo "🤖 Android (APK/AAB):"
echo "  For APK (testing): cd android && ./gradlew assembleRelease"
echo "  For AAB (Play Store): cd android && ./gradlew bundleRelease"
echo "  APK location: android/app/build/outputs/apk/release/app-release.apk"
echo "  AAB location: android/app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "💡 For testing (simulator/emulator):"
echo "  iOS: npx cap run ios"
echo "  Android: npx cap run android"
