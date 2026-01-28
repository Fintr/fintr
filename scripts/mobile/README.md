# Mobile Build Scripts

## 🎯 Quick Start

### Production Build & Test
```bash
cd fintr-fe
./scripts/mobile/build-production.sh
```

**That's it!** This one script does everything:
- ✅ Cleans previous builds
- ✅ Builds production app
- ✅ Syncs to Capacitor
- ✅ Verifies configuration
- ✅ Runs on iOS simulator

### Development with Live Reload
```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Run with live reload
export CAPACITOR_SERVER_URL=http://localhost:5173
npx cap sync ios
npx cap run ios
```

## 📋 Main Script: `build-production.sh`

This is your **all-in-one production workflow script**.

```bash
./scripts/mobile/build-production.sh
```

### What It Does:

1. **🧹 Cleans**: Removes `.next`, `out`, and old Capacitor configs
2. **⚙️  Sets Up**: 
   - Unsets `CAPACITOR_SERVER_URL` (uses bundled files)
   - Loads `.env.production`
   - Overrides `NEXT_PUBLIC_APP_BASE_URL` to `https://www.fintr.ai`
3. **🔨 Builds**: Creates static Next.js export in `out/` directory
4. **🔄 Syncs**: Copies built files to iOS/Android native projects
5. **🔍 Verifies**: Checks that config is correct (no server URL)
6. **📱 Runs**: Launches app on iOS simulator

### When To Use:

- ✅ Testing production build
- ✅ Before creating App Store archive
- ✅ Before building Android APK/AAB
- ✅ Verifying bundled app works correctly
- ✅ Any time you need a production build

## 🔑 Key Concepts

### Bundled App vs Live Reload

**Bundled App (Production):**
```bash
./scripts/mobile/build-production.sh
```
- App uses files built into the package
- No dev server needed
- This is what App Store users get
- **CAPACITOR_SERVER_URL is UNSET**

**Live Reload (Development):**
```bash
export CAPACITOR_SERVER_URL=http://localhost:5173
npx cap run ios
```
- App loads from localhost dev server
- Changes appear immediately
- Faster development
- **CAPACITOR_SERVER_URL is SET**

### Environment Variables

**`CAPACITOR_SERVER_URL`:**
- **Unset (production):** App uses bundled files ✅
- **Set to localhost (dev):** App loads from dev server

**`NEXT_PUBLIC_APP_BASE_URL`:**
- Must be `https://www.fintr.ai` during build
- Used for API calls, OAuth redirects
- **NOT** the custom URL scheme (`fintrapp://`)

**Custom URL Scheme (`fintrapp://`):**
- Only used at **runtime** for deep linking
- Configured in `capacitor.config.ts` and `Info.plist`
- Not used during build time

## 📱 Distribution Workflows

### App Store / TestFlight / Ad Hoc

```bash
# 1. Build production app
./scripts/mobile/build-production.sh

# 2. Open Xcode
npx cap open ios

# 3. In Xcode: Product → Archive
# 4. After archive: Distribute App → [choose distribution method]
```

### Android APK (Testing)

```bash
# 1. Build production app
./scripts/mobile/build-production.sh

# 2. Build APK
cd android
./gradlew assembleRelease

# APK location: android/app/build/outputs/apk/release/app-release.apk
```

### Android AAB (Play Store)

```bash
# 1. Build production app
./scripts/mobile/build-production.sh

# 2. Build AAB
cd android
./gradlew bundleRelease

# AAB location: android/app/build/outputs/bundle/release/app-release.aab
```

## ⚠️ Troubleshooting

### White Screen After Build

**Cause:** `CAPACITOR_SERVER_URL` is set in your shell environment

**Fix:**
```bash
# 1. Unset in current terminal
unset CAPACITOR_SERVER_URL

# 2. Check your shell profile
cat ~/.zshrc | grep CAPACITOR

# 3. Remove/comment out any CAPACITOR_SERVER_URL exports
nano ~/.zshrc

# 4. Reload shell
source ~/.zshrc

# 5. Run build again
./scripts/mobile/build-production.sh
```

### Config Has Server URL

**Symptom:** Script shows error:
```
❌ ERROR: capacitor.config.json contains 'server' configuration!
```

**Fix:** Your shell has `CAPACITOR_SERVER_URL` set. Follow steps above.

### App Tries to Connect to Localhost

**Symptom:** App shows connection errors or blank screen

**Fix:**
```bash
# Verify CAPACITOR_SERVER_URL is unset
env | grep CAPACITOR
# Should show nothing

# Rebuild
./scripts/mobile/build-production.sh
```

### Build Fails

**Check:**
1. Is `pnpm` installed? (`pnpm --version`)
2. Are dependencies installed? (`pnpm install`)
3. Does `.env.production` exist?
4. Is Capacitor CLI installed? (`npx cap --version`)

## 💡 Pro Tips

1. **Always use the script** - Don't run commands manually
2. **Check your shell** - Make sure no permanent `CAPACITOR_SERVER_URL` export
3. **Clean builds** - Script now cleans automatically
4. **Test before archiving** - Always test production build on simulator first
5. **Development vs Production** - Use live reload for dev, bundled for production

## 🆘 Still Having Issues?

1. **Check environment:**
   ```bash
   env | grep -E '(CAPACITOR|NEXT_PUBLIC)'
   ```

2. **Verify config:**
   ```bash
   cat ios/App/App/capacitor.config.json
   ```

3. **Check build output:**
   ```bash
   ls -la out/
   ```

4. **See documentation:**
   - `docs/PRODUCTION_BUILD_CHECKLIST.md`
   - `docs/CAPACITOR_WHITE_SCREEN_FIX.md`

5. **Try clean build:**
   ```bash
   # Remove everything and rebuild
   rm -rf .next out node_modules
   pnpm install
   ./scripts/mobile/build-production.sh
   ```

## 📚 Additional Resources

- **Capacitor Docs:** https://capacitorjs.com
- **Next.js Static Export:** https://nextjs.org/docs/app/building-your-application/deploying/static-exports
- **iOS Distribution:** `docs/mobile/IOS_AD_HOC_DISTRIBUTION.md`
