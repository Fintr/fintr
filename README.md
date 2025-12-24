# Fintr Frontend

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
   ```bash
   pnpm android:open
   # or
   npx cap open android
   ```
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

### Android Issues

**"Cannot connect to server" in emulator:**
- For emulator: use `http://10.0.2.2:5173` (not localhost)
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
