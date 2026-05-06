#!/bin/bash

echo "🔍 Checking iOS Signing Configuration"
echo "======================================"
echo ""

cd ios/App

echo "1. Checking Xcode accounts..."
security find-identity -v -p codesigning | grep "Apple" || echo "   ⚠️  No Apple signing identities found"
echo ""

echo "2. Checking for provisioning profiles..."
ls -la ~/Library/MobileDevice/Provisioning\ Profiles/ 2>/dev/null | wc -l | xargs -I {} echo "   Found {} provisioning profiles"
echo ""

echo "3. Checking App ID in project..."
grep -A 5 "PRODUCT_BUNDLE_IDENTIFIER" App.xcodeproj/project.pbxproj | grep "com.fintr.app" && echo "   ✅ Bundle ID found: com.fintr.app" || echo "   ❌ Bundle ID not found"
echo ""

echo "4. Checking team configuration..."
grep "DEVELOPMENT_TEAM" App.xcodeproj/project.pbxproj | head -1 && echo "   ✅ Team configured" || echo "   ❌ No team configured"
echo ""

echo "5. Testing Xcode connection to Apple..."
echo "   Attempting to list available teams..."
xcodebuild -showBuildSettings -workspace App.xcworkspace -scheme App -configuration Release 2>&1 | grep -i "DEVELOPMENT_TEAM\|CODE_SIGN" | head -5 || echo "   ⚠️  Could not read build settings"
echo ""

echo "📝 Next steps if issues found:"
echo "   1. Open Xcode → Settings → Accounts"
echo "   2. Select your Apple ID"
echo "   3. Click 'Download Manual Profiles'"
echo "   4. Try signing again in Xcode"
echo ""

