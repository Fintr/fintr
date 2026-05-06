#!/bin/bash
set -e

echo "📱 Building iOS Archive for App Store"
echo "======================================"
echo ""

# Navigate to iOS directory
cd ios/App

# Get the workspace name
WORKSPACE="App.xcworkspace"
SCHEME="App"

# Check if workspace exists
if [ ! -d "$WORKSPACE" ]; then
    echo "❌ Error: $WORKSPACE not found"
    echo "   Make sure you've run: pod install"
    exit 1
fi

# Create archive directory
ARCHIVE_DIR="$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)"
mkdir -p "$ARCHIVE_DIR"

ARCHIVE_PATH="$ARCHIVE_DIR/${SCHEME}-$(date +%Y-%m-%d-%H%M%S).xcarchive"

echo "🔨 Building archive..."
echo "   Workspace: $WORKSPACE"
echo "   Scheme: $SCHEME"
echo "   Archive: $ARCHIVE_PATH"
echo ""

# Build archive using xcodebuild
xcodebuild archive \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -archivePath "$ARCHIVE_PATH" \
    -allowProvisioningUpdates \
    CODE_SIGN_STYLE=Automatic \
    CODE_SIGN_IDENTITY="Apple Distribution" \
    DEVELOPMENT_TEAM="2D7JCZ3SVD" \
    || {
        echo ""
        echo "❌ Archive failed!"
        echo ""
        echo "Common issues:"
        echo "1. App ID 'com.fintr.app' doesn't exist in Apple Developer portal"
        echo "   → Create it at: https://developer.apple.com/account/resources/identifiers/list"
        echo ""
        echo "2. Signing certificate not found"
        echo "   → Check Xcode → Preferences → Accounts → Download Manual Profiles"
        echo ""
        echo "3. Team not selected"
        echo "   → Open project in Xcode → Signing & Capabilities → Select your team"
        exit 1
    }

echo ""
echo "✅ Archive created successfully!"
echo "   Location: $ARCHIVE_PATH"
echo ""
echo "📦 Next steps:"
echo "   1. Open Xcode → Window → Organizer"
echo "   2. Select your archive"
echo "   3. Click 'Distribute App'"
echo "   4. Choose 'App Store Connect'"
echo "   5. Follow the prompts to upload"
echo ""

