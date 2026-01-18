# Create Ad Hoc Provisioning Profile

## Quick Steps

### 1. Register Devices First (Required!)

Before creating the profile, you need to register your test devices:

1. Get device UDIDs:
   - **From Mac**: Connect device → Finder → Click device name → UDID appears
   - **From Device**: Settings → General → About → Tap identifier to copy

2. Register in Apple Developer Portal:
   - Go to: https://developer.apple.com/account/resources/devices/list
   - Click **+** button
   - Enter:
     - **Name**: Friendly name (e.g., "John's iPhone 15")
     - **UDID**: Paste the UDID
     - **Platform**: iOS
   - Click **Continue** → **Register**
   - Repeat for all test devices

### 2. Create Ad Hoc Provisioning Profile

1. Go to: https://developer.apple.com/account/resources/profiles/list
2. Click **+** button (top left)
3. Under **Distribution**, select **Ad Hoc** → Click **Continue**
4. Select your **App ID**: `com.fintr.app` → Click **Continue**
5. Select your **Distribution Certificate** (Apple Distribution) → Click **Continue**
6. **Select all the devices** you want to include (check the boxes) → Click **Continue**
7. Enter **Profile Name**: `Fintr Ad Hoc Distribution`
8. Click **Generate**
9. **Download** the `.mobileprovision` file

### 3. Install Profile in Xcode

**Method 1: Double-click (Easiest)**
- Double-click the downloaded `.mobileprovision` file
- It will automatically install in Xcode

**Method 2: Drag and Drop**
- Open Xcode
- Drag the `.mobileprovision` file into Xcode
- It will install automatically

**Method 3: Manual Install**
- Open Xcode → Preferences → Accounts
- Select your Apple ID → Click **Download Manual Profiles**
- The profile should appear

### 4. Verify Profile is Installed

1. In Xcode, go to **Preferences** → **Accounts**
2. Select your Apple ID
3. Click **Download Manual Profiles**
4. You should see "Fintr Ad Hoc Distribution" in the list

### 5. Use Profile in Export Dialog

1. Go back to your export dialog in Xcode
2. Click the dropdown next to `fintrapp.app`
3. You should now see "Fintr Ad Hoc Distribution"
4. Select it
5. Click **Next**

## Troubleshooting

### Profile doesn't appear in dropdown

**Solution 1: Refresh Xcode**
1. Close the export dialog
2. In Xcode: **Preferences** → **Accounts** → Select your Apple ID
3. Click **Download Manual Profiles**
4. Wait for it to complete
5. Try the export again

**Solution 2: Check Profile Name**
- Make sure the profile name exactly matches what you're looking for
- Case-sensitive: `Fintr Ad Hoc Distribution` ≠ `fintr ad hoc distribution`

**Solution 3: Verify Profile is for Correct App**
- In Apple Developer Portal, check that the profile is for App ID: `com.fintr.app`
- Check that it's an **Ad Hoc** profile (not App Store or Development)

**Solution 4: Re-download Profile**
1. Go back to Apple Developer Portal
2. Find your profile
3. Click **Download** again
4. Double-click to install
5. Try export again

### "No devices selected" error

- Make sure you selected at least one device when creating the profile
- You can edit the profile later to add more devices

### Profile expired

- Ad Hoc profiles expire after 1 year
- Create a new profile with the same settings
- Download and install the new one

## Important Notes

- **Device Limit**: You can register up to 100 devices per year
- **Profile Updates**: If you add new devices, you need to create a new profile
- **Profile Expiry**: Profiles expire after 1 year - rebuild with new profile
- **Certificate**: Make sure your Distribution Certificate is valid

## Quick Checklist

Before exporting:
- [ ] Test devices registered in Apple Developer Portal
- [ ] Ad Hoc provisioning profile created
- [ ] Profile includes all test devices
- [ ] Profile downloaded and installed in Xcode
- [ ] Profile appears in Xcode export dialog
- [ ] Distribution certificate is valid
