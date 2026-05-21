# Fintr Frontend

## Product scope

Dedicated **Goals** and **Investments** experiences are **not** part of the default app today; they are behind `NEXT_PUBLIC_SHOW_V2` (`shouldShowV2Features()` in `src/lib/utils.ts`). In-app weekly pulse chips do **not** list those areas. See the monorepo **[docs/CURRENT_PRODUCT_SCOPE.md](../../docs/CURRENT_PRODUCT_SCOPE.md)**.

## Project Structure

**⚠️ Important:** This folder contains both web and mobile-responsive versions of the app.

- The `../fintr-mobile/` folder is **DEPRECATED** and should not be used.
- All mobile functionality has been consolidated into this Next.js app with responsive design.

## Installation

1. Install pnpm if you haven't already: `npm install -g pnpm`
2. Install dependencies: `pnpm install`
3. Get the .env credentials from `miko@fintr.ai`.
4. Run `pnpm dev`

## Running the App (Web)

The simplest way to run the app for development:

```bash
pnpm dev
```

This will start the Next.js development server on `http://localhost:5173`.

## Mobile Development

For iOS and Android development, you'll need additional setup. The app uses Capacitor to build native mobile apps.

### Prerequisites

**For iOS Development:**

- **macOS** (required for iOS development)
- **Node.js** >= 20.0.0 (LTS version recommended)
- **Xcode** (latest version from App Store)
- **CocoaPods** (`sudo gem install cocoapods`)
- **iOS Simulator** (comes with Xcode)

**For Android Development:**

- **Node.js** >= 20.0.0 (LTS version recommended)
- **Android Studio** (latest version)
- **Java Development Kit (JDK)** 17 or later
- **Android SDK** (installed via Android Studio)
- **Android Emulator** (set up via Android Studio)

### iOS Simulator

1. **Build the Next.js app**:
  ```bash
   pnpm build
  ```
2. **Set up Capacitor server URL** (for development with live reload):
  ```bash
   # For iOS Simulator
   export CAPACITOR_SERVER_URL=http://localhost:5173

   # For physical iOS device, use your Mac's IP address
   # Find it with: ifconfig | grep "inet "
   # Example: export CAPACITOR_SERVER_URL=http://192.168.1.100:5173
  ```
3. **Sync Capacitor**:
  ```bash
   npx cap sync ios
  ```
4. **Open in Xcode**:
  ```bash
   pnpm ios
   # or
   npx cap open ios
  ```
5. **Run in Simulator**:
  - In Xcode, select a simulator from the device dropdown (top toolbar)
  - Click the Run button (▶️) or press `Cmd + R`
  - The app will build and launch in the iOS Simulator

**Note**: Make sure your Next.js dev server (`pnpm dev`) is running if you set `CAPACITOR_SERVER_URL` for live reload.

### Android Emulator

1. **Start Android Studio** and ensure an Android emulator is running:
  - Open Android Studio
  - Go to **Tools → Device Manager**
  - Start an emulator (or create one if needed)
2. **Build the Next.js app**:
  ```bash
   pnpm build
  ```
3. **Set up Capacitor server URL** (for development with live reload):
  ```bash
   # For Android Emulator
   export CAPACITOR_SERVER_URL=http://10.0.2.2:5173

   # For physical Android device, use your computer's IP address
   # Find it with: ifconfig | grep "inet " (Mac/Linux) or ipconfig (Windows)
   # Example: export CAPACITOR_SERVER_URL=http://192.168.1.100:5173
  ```
4. **Sync Capacitor**:
  ```bash
   npx cap sync android
  ```
5. **Run on Android**:
  ```bash
   pnpm android
   # or
   npx cap run android
  ```
   Alternatively, open Android Studio:
   Then click Run (▶️) in Android Studio.

**Note**: Make sure your Next.js dev server (`pnpm dev`) is running if you set `CAPACITOR_SERVER_URL` for live reload.

## Available Scripts

- `pnpm dev` - Start Next.js development server (port 5173)
- `pnpm build` - Build the Next.js app for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm build:ios` - Build Next.js app and sync with iOS
- `pnpm build:android` - Build Next.js app and sync with Android
- `pnpm ios` - Open iOS project in Xcode
- `pnpm android` - Run app on Android emulator/device
- `pnpm android:open` - Open Android project in Android Studio

## Testing production build (Android)

To test the app as it will run in production (production API, bundled assets, no live reload):

1. **One command** (from `fintr-fe`):
  ```bash
   ./scripts/mobile/build-production-android.sh
  ```
   This cleans the build, loads `.env.production` (so the app uses `https://api.fintr.ai`), builds the static export, syncs to Android, and runs the app on the emulator. Start an AVD in Device Manager first if none is running.
2. **Install a release APK on a device**: After running the script once (so `out/` and Android assets are up to date), build and install the signed APK:
  ```bash
   cd android && ./gradlew assembleRelease
  ```
   Then install `android/app/build/outputs/apk/release/app-release.apk` on your device (or use **Build → Build Bundle(s) / APK(s) → Build APK(s)** in Android Studio).
3. **Build AAB for Play Store**: Use `./scripts/mobile/build-android-aab.sh` (after a production build + sync as above).

**View logs and network on device without USB:** The app can show an in-app devtools panel (Console, Network, etc.) on the phone. It appears automatically when running a **dev** build in the Capacitor app. For a **production** build, set `NEXT_PUBLIC_ERUDA=true` in `.env.production` (or in the env when running the build script), then rebuild. A small floating button appears on screen; tap it to open the panel. No USB or ADB required.

## Troubleshooting

### iOS Issues

**"Scheme not found" error:**

- Open Xcode manually: `npx cap open ios`
- Select the "App" scheme from the scheme dropdown
- Run from Xcode

**"Cannot connect to server" in simulator:**

- Ensure `CAPACITOR_SERVER_URL` is set correctly
- For simulator: use `http://localhost:5173`
- For physical device: use your Mac's IP address
- Ensure your dev server is running: `pnpm dev`
- Ensure Mac and device are on the same network

**Capacitor not loading:**

- Run `npx cap sync ios` to sync native plugins
- Clean build in Xcode: `Product → Clean Build Folder` (Shift + Cmd + K)
- Rebuild: `Product → Build` (Cmd + B)

**Simulator shows a blank white screen after `make ios-dev`:**

- The bundled app loads from `out/` (static export). Run a full `**pnpm build`** before `**pnpm cap sync ios**` so `public/` assets (e.g. `fintr-logo.svg`) are copied into the iOS app. `make ios-dev` already runs build → sync → run; if you skip build or use a stale `out/`, the WebView can fail to paint.
- In **Safari → Develop → [Simulator]**, connect to the WebView and check the console for red errors.
- Tap **Reload app** if you see the in-app error screen (React error boundary).
- **Cold boot** the simulator: Device → Erase All Content and Settings, or try another simulator device.

### Android Issues

`**net::ERR_CONNECTION_REFUSED` when calling the backend (localhost:3000):**  
In the Android emulator, **localhost** is the emulator itself, not your Mac, so the app never reaches your Rails server. Use the emulator’s special host alias:

1. **Point the app at your Mac’s backend**
  In `fintr-fe`, set the backend URL to the host loopback:
2. **Rebuild and sync** so the new URL is baked in:
  ```bash
   pnpm build && npx cap sync android
  ```
   Then run the app again on the emulator.  
   For a **physical device**, use your computer’s LAN IP instead, e.g. `http://192.168.50.203:3000`, and ensure the backend CORS allows it (see backend README).

**"Cannot connect to server" in emulator (frontend dev server):**

- For emulator: use `http://10.0.2.2:5173` (not localhost) for `CAPACITOR_SERVER_URL`
- For physical device: use your computer's IP address
- Ensure your dev server is running: `pnpm dev`
- Ensure computer and device are on the same network

**Build errors:**

- Ensure Android SDK is properly installed
- Run `npx cap sync android` to sync native plugins
- Clean build in Android Studio: `Build → Clean Project`
- Rebuild: `Build → Rebuild Project`

**Gradle sync issues:**

- Open Android Studio
- Go to `File → Sync Project with Gradle Files`
- If issues persist, try `File → Invalidate Caches / Restart`

**App opens but the screen is blank (no content in WebView):**

- **Check emulator network**: In the emulator, open the **Browser** app and go to `https://www.fintr.ai`. If that page is also blank or doesn't load, the emulator has no internet or DNS. Fix: In Android Studio Device Manager, use **Cold Boot Now** for the AVD.
- **Inspect the WebView**: On your computer, open Chrome and go to **chrome://inspect**. Find your app's WebView and click **Inspect** to see console and network errors (e.g. ERR_NAME_NOT_RESOLVED).

**Viewing console logs on the Android emulator:**

- **JavaScript (e.g. `console.log`)**: WebView debugging is enabled. With the app running on the emulator, open Chrome on your computer, go to `chrome://inspect`, find your app’s WebView, and click **inspect** to open DevTools and see the JS console.
- **Native / system logs**: Run `adb logcat` in a terminal (with the emulator or device connected). Filter by tag if needed, e.g. `adb logcat | grep -i fintr` or `adb logcat *:V` for verbose.

`**adb: device offline` or "ADB is unresponsive" when running `pnpm android`:**

- The emulator may still be booting, or ADB is in a bad state. Try in order:
  1. **Restart ADB**: Run `adb kill-server` then `adb start-server`. Wait a few seconds, then run `pnpm android` again.
  2. **Start the emulator first**: Open Android Studio → Device Manager → start an AVD. Wait until the home screen is fully visible, then run `pnpm android` (or `npx cap run android`) from the project.
  3. **Cold boot**: In Device Manager, use the dropdown on the AVD → **Cold Boot Now**. When it finishes booting, run `pnpm android` again.
  4. If the device stays offline, **Wipe Data** for that AVD in Device Manager, or create a new virtual device.

### Live view auth (iOS/Android loading from website)

When the app loads from the live website (e.g. `https://www.fintr.ai`), the token exchange is a `fetch()` from that origin to your backend. If you see **"Authentication Failed"** or **"Load failed"** / **"Could not reach the server"**:

1. **Backend CORS** – The backend must allow the app’s origin. Set `CORS_ORIGINS` (or equivalent) to include:
  - `https://www.fintr.ai`
  - `https://fintr.ai`
  - (Optional) `capacitor://localhost` if you test with a bundled build
2. **Auth0** – In the Auth0 application, **Allowed Callback URLs** must include:
  - `fintrapp://auth-callback` (for the native app OAuth redirect)

After changing CORS or Auth0, redeploy the backend / Auth0 config and try sign-in again.

### General Issues

**Dependencies not installing:**

- Delete `node_modules` and `pnpm-lock.yaml`
- Run `pnpm install` again

**Capacitor plugins not working:**

- Run `npx cap sync` (for the platform you're using)
- Rebuild the native app

**Port already in use:**

- Change the port in `package.json`: `pnpm dev -- -p 3000`
- Or kill the process using the port

## Development Tips

1. **Live Reload**: Set `CAPACITOR_SERVER_URL` to your dev server URL to see changes instantly in the mobile app
2. **Hot Reload**: Changes to React components will hot-reload automatically in the browser
3. **Native Changes**: After modifying native code or Capacitor config, run `npx cap sync`
4. **Rebuild**: After adding new Capacitor plugins, run `npx cap sync` and rebuild the native app

## Environment Variables

Required environment variables (get from `miko@fintr.ai`):

- `NEXT_PUBLIC_AUTH0_DOMAIN`
- `NEXT_PUBLIC_AUTH0_CLIENT_ID`
- `NEXT_PUBLIC_AUTH0_AUDIENCE`
- `NEXT_PUBLIC_APP_BASE_URL`
- And others as needed

For Capacitor development:

- `CAPACITOR_SERVER_URL` - Set this to enable live reload (optional, for development only)



sample deploy