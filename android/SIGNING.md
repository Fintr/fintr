# Android App Signing Configuration

This guide explains how to configure signing for your Android app builds.

## Do I Need to Register as an Android Developer?

**Short answer**: It depends on what you want to do.

### ✅ **Signing the App** (No Registration Required)
- You can create a keystore and sign your APK/AAB **without** any registration
- Signing is just a technical step to verify the app's authenticity
- You can distribute signed APKs directly (sideloading) without registering

### 📱 **Publishing to Google Play Store** (Registration Required)
- To publish your app on Google Play Store, you need a **Google Play Developer account**
- One-time registration fee: **$25 USD**
- Registration: https://play.google.com/console/signup
- After registration, you can publish unlimited apps

### Summary
- **Signing**: No registration needed ✅
- **Testing/Direct Distribution**: No registration needed ✅
- **Google Play Store**: Registration required ($25) 📱

## Quick Start

1. **Generate a keystore** (one-time setup):
   ```bash
   cd android
   ./create-keystore.sh
   ```

2. **Build signed APK/AAB**:
   ```bash
   ./gradlew assembleRelease  # For APK
   ./gradlew bundleRelease    # For AAB (Play Store)
   ```

## Detailed Steps

### Step 1: Create a Keystore

Run the keystore creation script:

```bash
cd android
./create-keystore.sh
```

This script will:
- Prompt you for keystore details (passwords, certificate info)
- Create `app/fintr-release-key.jks` (your keystore file)
- Create `keystore.properties` (configuration file)

**Important**: Keep your keystore and passwords safe! If you lose them, you cannot update your app on Google Play Store.

### Step 2: Verify Configuration

The `build.gradle` file is already configured to automatically use your keystore when `keystore.properties` exists. The configuration:

- Loads keystore properties from `android/keystore.properties`
- Applies signing to release builds automatically
- Works for both APK (`assembleRelease`) and AAB (`bundleRelease`) builds

### Step 3: Build Signed Apps

Once the keystore is set up, all release builds will be automatically signed:

```bash
# Build signed APK
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk

# Build signed AAB (for Google Play Store)
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

## Manual Configuration (Alternative)

If you prefer to configure signing manually:

1. **Create `keystore.properties`** in the `android` directory:
   ```properties
   storeFile=app/fintr-release-key.jks
   storePassword=your-keystore-password
   keyAlias=fintr-key
   keyPassword=your-key-password
   ```

2. **Create the keystore manually**:
   ```bash
   keytool -genkeypair \
       -v \
       -storetype PKCS12 \
       -keystore app/fintr-release-key.jks \
       -alias fintr-key \
       -keyalg RSA \
       -keysize 2048 \
       -validity 10000
   ```

## Security Best Practices

1. **Never commit**:
   - `keystore.properties` (already in `.gitignore`)
   - `*.jks` files (already in `.gitignore`)
   - Any keystore files

2. **Backup your keystore**:
   - Store a secure backup in a password manager or secure vault
   - Google Play requires the same keystore for all app updates

3. **Use strong passwords**:
   - Use a strong, unique password for your keystore
   - Consider using a password manager

## Troubleshooting

### "Keystore file not found"
- Ensure `keystore.properties` exists in the `android` directory
- Check that `storeFile` path in `keystore.properties` is correct

### "Wrong password"
- Verify your passwords in `keystore.properties`
- Make sure there are no extra spaces or special characters

### "Key alias not found"
- Check that `keyAlias` in `keystore.properties` matches the alias used when creating the keystore

## Publishing to Google Play Store

If you want to publish your app to Google Play Store:

1. **Register for Google Play Developer Account**:
   - Go to https://play.google.com/console/signup
   - Pay the one-time $25 registration fee
   - Complete your developer profile

2. **Build a signed AAB** (not APK):
   ```bash
   ./gradlew bundleRelease
   ```
   - Output: `android/app/build/outputs/bundle/release/app-release.aab`

3. **Upload to Play Console**:
   - Go to https://play.google.com/console
   - Create a new app
   - Upload your `.aab` file
   - Complete store listing, content rating, etc.
   - Submit for review

**Note**: Google Play Store requires AAB (Android App Bundle) format, not APK. The AAB format allows Google to optimize the app for different device configurations.

## Distribution Options

### Option 1: Direct Distribution (No Registration)
- Build signed APK: `./gradlew assembleRelease`
- Share the APK file directly with users
- Users install by enabling "Install from unknown sources"
- **No registration needed**

### Option 2: Google Play Store (Registration Required)
- Build signed AAB: `./gradlew bundleRelease`
- Register for Google Play Developer account ($25)
- Upload to Play Console
- Users install from Play Store

### Option 3: Other App Stores
- Some alternative app stores may have different requirements
- Check each store's documentation

## Files

- `create-keystore.sh` - Script to generate keystore and properties file
- `keystore.properties.example` - Template for keystore configuration
- `app/build.gradle` - Contains signing configuration
- `app/fintr-release-key.jks` - Your keystore file (created by script, gitignored)


