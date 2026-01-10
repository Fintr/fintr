# Apple Sign In Setup Guide

This guide will help you set up Apple Sign In through Auth0 to comply with Apple's App Store requirements.

## Why Apple Sign In is Required

Apple requires apps that offer third-party sign-in options (like Google, Facebook, etc.) to also provide Apple Sign In as an option. This is a requirement for App Store approval.

Reference: [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple)

## Prerequisites

1. **Apple Developer Account** - You need an active Apple Developer Program membership
2. **Auth0 Account** - Your Auth0 tenant should be set up
3. **App ID configured** - Your app's bundle identifier (`com.fintr.app`) should be registered in Apple Developer portal

## Step 1: Enable Sign in with Apple in Apple Developer Portal

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list)
2. Select your App ID: `com.fintr.app`
3. Click **Edit**
4. Under **Capabilities**, check **Sign In with Apple**
5. Click **Save**

## Step 2: Configure Apple Sign In in Auth0

### 2.1 Create Apple Social Connection in Auth0

1. Log in to your [Auth0 Dashboard](https://manage.auth0.com)
2. Go to **Authentication** → **Social**
3. Click **+ Create Connection**
4. Select **Apple**
5. Fill in the required information:
   - **Connection Name**: `apple` (this is important - must match the connection name in code)
   - **Apple Team ID**: Your Apple Developer Team ID (found in Apple Developer portal)
   - **Key ID**: Create a Service ID key in Apple Developer portal
   - **Private Key**: Download the `.p8` key file from Apple Developer portal

### 2.2 Get Apple Service ID Credentials

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list)
2. Click **+** to create a new identifier
3. Select **Services IDs** → **Continue**
4. Enter:
   - **Description**: `Fintr Auth0 Service`
   - **Identifier**: `com.fintr.app.service` (or similar)
5. Click **Continue** → **Register**
6. Edit the Service ID and enable **Sign In with Apple**
7. Click **Configure** next to Sign In with Apple
8. Add:
   - **Primary App ID**: `com.fintr.app`
   - **Website URLs**:
     - **Domains**: `fintr.jp.auth0.com`
     - **Return URLs**: `https://fintr.jp.auth0.com/login/callback`
9. Click **Save** → **Continue** → **Save**

### 2.3 Create Apple Key (THIS IS THE KEY FILE YOU NEED!)

**This is the most important step - this is where you get the key file for Auth0!**

1. Go to [Apple Developer Portal - Keys](https://developer.apple.com/account/resources/authkeys/list)
2. Click the **+** button in the top right to create a new key
3. Enter a **Key Name**: `Auth0 Apple Sign In Key` (or any name you prefer)
4. **IMPORTANT**: Check the box next to **Sign In with Apple**
5. Click **Configure** next to "Sign In with Apple"
6. Select your **Primary App ID**: `com.fintr.app`
7. Click **Save** in the popup
8. Click **Continue** at the bottom
9. Click **Register** to create the key
10. **CRITICAL**: You'll see a page with your **Key ID** - **DOWNLOAD THE KEY FILE NOW!**
    - Click the **Download** button to download the `.p8` file
    - **⚠️ WARNING**: You can only download this file ONCE! Save it securely.
    - The file will be named something like `AuthKey_XXXXXXXXXX.p8`
11. **Note the Key ID** - it looks like: `XXXXXXXXXX` (10 characters)
12. **Save the .p8 file** - you'll need to open it and copy its contents for Auth0

### 2.4 Configure Auth0 Apple Connection

1. In Auth0 Dashboard, go to **Authentication** → **Social** → **Apple**
2. You need to fill in **FOUR fields**:

   **a. Client ID (Service ID):**
   - This is the **Service ID** you created in step 2.2
   - It should be: `com.fintr.app.service` (or whatever you named it)
   - **This is critical** - this must match the Service ID in Apple Developer Portal!
   - Paste it into Auth0's "Client ID" field

   **b. Team ID:**
   - Go to [Apple Developer Portal](https://developer.apple.com/account)
   - Look at the top right corner - you'll see your name and a **Team ID** (looks like: `2D7JCZ3SVD`)
   - Copy this Team ID and paste it into Auth0's "Team ID" field

   **c. Key ID:**
   - This is the Key ID you noted in step 2.3 (the 10-character ID)
   - It should look like: `XXXXXXXXXX`
   - Paste it into Auth0's "Key ID" field

   **d. Client Secret Signing Key (Private Key):**
   - Open the `.p8` file you downloaded in step 2.3
   - You can open it with any text editor (TextEdit on Mac, Notepad on Windows)
   - **Copy the ENTIRE contents** of the file, including:
     - The line that says `-----BEGIN PRIVATE KEY-----`
     - All the text in between
     - The line that says `-----END PRIVATE KEY-----`
   - It should look something like this:
     ```
     -----BEGIN PRIVATE KEY-----
     MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
     (many lines of text)
     ...xyz123
     -----END PRIVATE KEY-----
     ```
   - Paste the ENTIRE thing (including BEGIN/END lines) into Auth0's "Client Secret Signing Key" field

3. **Scopes**: Leave default (name, email)
4. Click **Save**

### 2.5 Enable Apple Connection for Your Application

1. In Auth0 Dashboard, go to **Applications** → Select your application
2. Go to **Connections** tab
3. Enable the **Apple** connection
4. Click **Save**

## Step 3: Enable Sign in with Apple Capability in Xcode

1. Open your project in Xcode: `fintr-fe/ios/App/App.xcworkspace`
2. Select your project in the navigator
3. Select the **App** target
4. Go to **Signing & Capabilities** tab
5. Click **+ Capability**
6. Search for and add **Sign In with Apple**
7. Xcode will automatically configure the entitlements

## Step 4: Test Apple Sign In

1. Build and run your app on a physical iOS device (simulator may not work properly)
2. Navigate to the login/signup page
3. Click **Continue with Apple**
4. You should see the Apple Sign In dialog
5. Complete the sign-in flow

## Troubleshooting

### "Invalid client" error
- Verify the Apple connection name in Auth0 is exactly `apple` (lowercase)
- Check that the connection is enabled for your Auth0 application

### "Invalid redirect URI" error
- Ensure the redirect URI in your code matches what's configured in Auth0
- Default redirect URI: `https://your-domain/auth-callback` or `com.fintr.app://auth-callback`

### Apple Sign In button doesn't appear
- Make sure you're testing on iOS 13+ device
- Verify the capability is enabled in Xcode
- Check that the bundle identifier matches your App ID

### "Sign in with Apple is not available"
- Verify Sign in with Apple is enabled for your App ID in Apple Developer portal
- Check that you're using the correct Team ID and Key ID in Auth0
- Ensure the `.p8` key file is correctly pasted in Auth0 (include the full key including headers)

## Code Implementation

The Apple Sign In implementation is already in place:

- **Service**: `src/services/auth/apple-signin.ts`
- **UI**: `src/components/auth/unified-auth-page.tsx`
- **Connection name**: `apple` (must match Auth0 connection name)

## Additional Resources

- [Auth0 Apple Social Connection Documentation](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/apple)
- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

## Notes

- Apple Sign In is required for App Store approval if you offer other third-party sign-in options
- The connection name in Auth0 must be exactly `apple` (lowercase) to match the code
- Always test on a physical device for best results
- Keep your `.p8` key file secure - you can only download it once from Apple Developer portal

