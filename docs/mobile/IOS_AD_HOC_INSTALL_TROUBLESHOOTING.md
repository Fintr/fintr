# Troubleshooting: IPA Won't Install on iPhone

## Common Issues and Solutions

### Issue 1: Device Not in Provisioning Profile (Most Common)

**Symptoms:** IPA downloads but won't install, or shows "Unable to Install" error

**Solution:**
1. Check if your device UDID is in the Ad Hoc provisioning profile:
   - Go to [Apple Developer Portal - Profiles](https://developer.apple.com/account/resources/profiles/list)
   - Find your "Fintr Ad Hoc Distribution" profile
   - Click on it to view details
   - Check if your device is listed under "Devices"
   
2. If your device is NOT listed:
   - You need to create a NEW Ad Hoc profile with your device included
   - Or edit the existing profile to add your device (if it's not full - 100 device limit)
   - Rebuild and export a new IPA with the updated profile

### Issue 2: Need to Trust Developer Certificate

**Symptoms:** App appears to install but shows "Untrusted Developer" or won't open

**Solution:**
1. On your iPhone, go to **Settings** → **General** → **VPN & Device Management** (or **Device Management** on older iOS)
2. Look for your developer certificate (your name or "Joel Paolo Paraiso")
3. Tap on it
4. Tap **Trust [Your Name]**
5. Tap **Trust** again to confirm
6. Try opening the app again

### Issue 3: iOS Blocking Installation

**Symptoms:** Nothing happens when tapping the IPA, or "Cannot connect to [server]"

**Solution:**
1. Make sure you're opening the download link in **Safari** (not Chrome, Firefox, etc.)
2. Check if iOS is blocking the installation:
   - Go to **Settings** → **Safari** → **Downloads**
   - Make sure downloads are enabled
3. Try downloading again in Safari

### Issue 4: Wrong Installation Method

**Symptoms:** IPA file appears but nothing happens

**Solution:**
The IPA file cannot be installed directly by tapping it. You need to use one of these methods:

**Method A: Via Safari Download (Recommended)**
1. Upload IPA to a web service (Diawi, your server, etc.)
2. Open the download link in **Safari** on your iPhone
3. Tap the download link
4. iOS will prompt to install
5. Go to Settings → General → VPN & Device Management → Trust certificate

**Method B: Via AirDrop**
1. On your Mac, right-click the IPA file
2. Select **Share** → **AirDrop**
3. Select your iPhone
4. On iPhone, accept the AirDrop
5. Tap the file in the AirDrop notification
6. Follow installation prompts

**Method C: Via Files App**
1. Save IPA to iCloud Drive or Files app
2. Open **Files** app on iPhone
3. Navigate to where you saved the IPA
4. Tap the IPA file
5. Follow installation prompts

### Issue 5: IPA File Corrupted or Invalid

**Symptoms:** Installation fails immediately or shows error

**Solution:**
1. Verify the IPA was exported correctly:
   - Make sure you selected "Ad Hoc" distribution method
   - Verify the provisioning profile includes your device
2. Try exporting a new IPA:
   - Archive again in Xcode
   - Export as Ad Hoc again
   - Make sure to select the correct provisioning profile

### Issue 6: iOS Version Compatibility

**Symptoms:** Installation fails or app won't run

**Solution:**
1. Check your app's minimum iOS version:
   - Your app targets iOS 14.0+
   - Make sure your iPhone is running iOS 14.0 or later
2. Check iPhone iOS version:
   - Settings → General → About → Software Version

## Step-by-Step Installation Process

### Using Safari (Most Reliable)

1. **Upload IPA to a service:**
   - Go to https://www.diawi.com (free, easy)
   - Upload your IPA file
   - Get the shareable link

2. **On your iPhone:**
   - Open **Safari** (not Chrome or other browsers)
   - Paste the download link
   - Tap the download/install button
   - iOS will show "This website is trying to download a configuration profile" - tap **Allow**

3. **Install the app:**
   - Go to **Settings** → **General** → **VPN & Device Management**
   - Find your developer certificate
   - Tap it → **Trust** → **Trust** again

4. **Open the app:**
   - The app should now appear on your home screen
   - Tap to open it

### Using AirDrop

1. **On your Mac:**
   - Right-click the IPA file
   - Select **Share** → **AirDrop**
   - Select your iPhone

2. **On your iPhone:**
   - Accept the AirDrop
   - Tap the notification
   - Follow installation prompts
   - Trust the certificate in Settings if needed

## Verification Checklist

Before trying to install, verify:

- [ ] Your device UDID is registered in Apple Developer Portal
- [ ] Your device is included in the Ad Hoc provisioning profile
- [ ] The IPA was exported with the Ad Hoc method (not App Store)
- [ ] The provisioning profile used includes your device
- [ ] Your iPhone is running iOS 14.0 or later
- [ ] You're using Safari to download (not other browsers)
- [ ] You've trusted the developer certificate in Settings

## Quick Diagnostic Commands

If you have access to the device via USB, you can check:

```bash
# Check if device is connected
xcrun devicectl list devices

# Try installing via command line (if device connected)
xcrun devicectl device install app --device [device-id] [path-to-ipa]
```

## Alternative: Install via Xcode (If Device Connected)

If your iPhone is connected to your Mac:

1. Open Xcode
2. Select **Window** → **Devices and Simulators**
3. Select your iPhone
4. Drag the IPA file into the "Installed Apps" section
5. Or click **+** and select the IPA file

This method doesn't require the device to be in the provisioning profile (uses development certificate).

## Still Not Working?

1. **Check the exact error message** - iOS usually shows a specific error
2. **Verify device is in profile** - This is the #1 cause
3. **Try a fresh export** - Sometimes the IPA gets corrupted
4. **Check iOS logs** - Connect device to Mac, open Console app, filter for your app name

## Common Error Messages

**"Unable to Install [App Name]"**
- Device not in provisioning profile → Add device and rebuild

**"Untrusted Developer"**
- Need to trust certificate → Settings → General → VPN & Device Management

**"Cannot connect to [server]"**
- Using wrong browser → Use Safari
- Network issue → Check internet connection

**"This app cannot be installed because its integrity could not be verified"**
- IPA corrupted → Export a new one
- Wrong signing → Make sure it's Ad Hoc, not App Store
