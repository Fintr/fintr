# iOS Ad Hoc Distribution Guide

This guide shows you how to distribute your iOS app to testers without using TestFlight.

## What is Ad Hoc Distribution?

Ad Hoc distribution allows you to:
- Install the app on up to **100 specific devices**
- Share the app directly with testers
- No App Store or TestFlight required
- Devices must be registered in your Apple Developer account

## Prerequisites

1. **Apple Developer Account** (paid membership required)
2. **Device UDIDs** of all test devices
3. **Xcode** installed on your Mac

## Step 1: Register Test Devices

### Get Device UDIDs

**Method 1: From the Device (Easiest)**
1. Connect the iOS device to your Mac
2. Open **Finder** (or iTunes on older macOS)
3. Select the device
4. Click on the device name/identifier area - it will show the UDID
5. Copy the UDID (it's a long string like: `00008030-001A2D1234567890`)

**Method 2: From Settings App**
1. On the iOS device, go to **Settings** → **General** → **About**
2. Scroll down to find the identifier
3. Tap and hold to copy

**Method 3: Using Terminal (if device is connected)**
```bash
system_profiler SPUSBDataType | grep -A 11 "iPhone\|iPad"
```

### Register Devices in Apple Developer Portal

1. Go to [Apple Developer Portal - Devices](https://developer.apple.com/account/resources/devices/list)
2. Click **+** to register a new device
3. Enter:
   - **Name**: A friendly name (e.g., "John's iPhone 15")
   - **UDID**: Paste the UDID you copied
   - **Platform**: iOS
4. Click **Continue** → **Register**
5. Repeat for all test devices (up to 100)

## Step 2: Create Ad Hoc Provisioning Profile

### Option A: Using Xcode (Easiest)

1. Open your project in Xcode: `fintr-fe/ios/App/App.xcworkspace`
2. Select your project → **App** target → **Signing & Capabilities**
3. Under **Provisioning Profile**, click the dropdown
4. If you see "Xcode Managed Profile", Xcode will create it automatically
5. If not, you'll need to create it manually (see Option B)

### Option B: Manual Creation in Apple Developer Portal

1. Go to [Apple Developer Portal - Profiles](https://developer.apple.com/account/resources/profiles/list)
2. Click **+** to create a new profile
3. Select **Ad Hoc** under **Distribution** → **Continue**
4. Select your **App ID**: `com.fintr.app` → **Continue**
5. Select your **Distribution Certificate** (Apple Distribution) → **Continue**
6. **Select all the devices** you want to include → **Continue**
7. Enter a **Profile Name**: `Fintr Ad Hoc Distribution`
8. Click **Generate**
9. **Download** the `.mobileprovision` file
10. **Double-click** it to install in Xcode

## Step 3: Build and Archive the App

### Using Xcode

1. Open your project: `fintr-fe/ios/App/App.xcworkspace`
2. Select **Product** → **Destination** → **Any iOS Device** (or a connected device)
3. Select **Product** → **Archive**
4. Wait for the archive to complete
5. The **Organizer** window will open automatically

### Using Command Line

```bash
cd fintr-fe/ios/App
xcodebuild archive \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath ~/Desktop/Fintr-AdHoc.xcarchive \
  CODE_SIGN_STYLE=Manual \
  PROVISIONING_PROFILE_SPECIFIER="Fintr Ad Hoc Distribution" \
  DEVELOPMENT_TEAM="2D7JCZ3SVD"
```

## Step 4: Export IPA for Ad Hoc Distribution

### Using Xcode Organizer

1. In Xcode, go to **Window** → **Organizer** (or press `Shift+Cmd+O`)
2. Select your archive
3. Click **Distribute App**
4. Select **Ad Hoc** → **Next**
5. Select your **Distribution Certificate** → **Next**
6. Select your **Ad Hoc Provisioning Profile** → **Next**
7. Review the summary → **Next**
8. Choose where to save the IPA file
9. Click **Export**

The IPA file will be saved to your chosen location.

### Using Command Line (Advanced)

```bash
# Export IPA from archive
xcodebuild -exportArchive \
  -archivePath ~/Desktop/Fintr-AdHoc.xcarchive \
  -exportPath ~/Desktop/Fintr-AdHoc-IPA \
  -exportOptionsPlist exportOptions.plist
```

You'll need to create an `exportOptions.plist` file:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>ad-hoc</string>
    <key>teamID</key>
    <string>2D7JCZ3SVD</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.fintr.app</key>
        <string>Fintr Ad Hoc Distribution</string>
    </dict>
</dict>
</plist>
```

## Step 5: Distribute the IPA to Testers

### Method 1: Direct File Sharing

1. Upload the IPA file to a file sharing service:
   - Google Drive
   - Dropbox
   - iCloud Drive
   - Your own server
2. Share the download link with testers
3. Testers download and install via:
   - **AirDrop** (if on Mac)
   - **Email** (if file is small enough)
   - **Safari** on their iOS device (see Method 2)

### Method 2: Install via Safari (Recommended)

1. Upload the IPA to a web server (or use a service like Diawi - see Method 3)
2. Create a simple HTML page with a download link
3. Testers open the link in Safari on their iOS device
4. Tap the download link
5. iOS will prompt to install the app
6. Go to **Settings** → **General** → **VPN & Device Management**
7. Trust your developer certificate
8. The app will install

### Method 3: Using Third-Party Services

**Diawi** (Free, Easy):
1. Go to https://www.diawi.com
2. Upload your IPA file
3. Get a shareable link
4. Testers open the link in Safari on their iOS device
5. Follow the installation prompts

**Firebase App Distribution** (Free):
1. Set up Firebase App Distribution
2. Upload IPA through Firebase console
3. Invite testers via email
4. They get a link to install

**AppCenter** (Free):
1. Sign up at https://appcenter.ms
2. Create a new app
3. Upload the IPA
4. Distribute to testers

## Step 6: Testers Install the App

### On iOS Device:

1. Open the download link in **Safari** (not Chrome or other browsers)
2. Tap **Download** or the IPA file
3. iOS will show "Cannot verify app" - this is normal
4. Go to **Settings** → **General** → **VPN & Device Management** (or **Device Management**)
5. Find your developer certificate (your name or team name)
6. Tap it → **Trust** → **Trust** again
7. Return to Safari and tap the download again
8. The app will install on the home screen

## Important Notes

### Limitations:
- **100 device limit** per year (resets annually)
- Devices must be registered before creating the provisioning profile
- If you add new devices, you need to create a new provisioning profile
- The app expires after 1 year (need to rebuild with new profile)

### Troubleshooting:

**"Untrusted Developer" error:**
- Go to Settings → General → VPN & Device Management
- Trust your developer certificate

**"App cannot be installed" error:**
- Device UDID might not be in the provisioning profile
- Create a new Ad Hoc profile with the device included

**"Invalid signature" error:**
- Make sure you're using the Ad Hoc provisioning profile
- Verify the certificate is valid

## Alternative: Development Build (For Quick Testing)

If you just need to test on a few devices quickly:

1. Connect device via USB
2. In Xcode, select the device from the device dropdown
3. Click **Run** (▶️)
4. Xcode will install the app directly

This uses a Development certificate and doesn't require device registration, but the device must be connected to your Mac.

## Summary

1. ✅ Register device UDIDs in Apple Developer Portal
2. ✅ Create Ad Hoc provisioning profile (include all devices)
3. ✅ Archive the app in Xcode
4. ✅ Export as Ad Hoc IPA
5. ✅ Share IPA via file sharing or third-party service
6. ✅ Testers install via Safari and trust the certificate

The IPA file can be shared with up to 100 registered devices without TestFlight!
