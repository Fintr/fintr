# Android Native Bridge & Auth Redirect Troubleshooting

This document records the full debugging journey and final solutions for the
Capacitor Android native bridge issues encountered when the app loads from a
remote URL (`https://www.fintr.ai`).

---

## Problem Overview

When the production Android Capacitor app (loading from `https://www.fintr.ai`)
was tested, three distinct problems appeared:

1. **Auth0 redirect going to the browser app instead of the Capacitor app** — after
   completing login in the in-app browser, the redirect landed on the Chrome
   browser version of the site rather than returning to the Capacitor app.
2. **"Login with Google" loading forever** — clicking the button opened nothing and
   the app appeared frozen.
3. **App crashing to the home screen / showing a black screen on startup** — the
   app launched, displayed the splash screen, then immediately died.

---

## Root Causes & Fixes

### 1. Auth redirect going to Chrome instead of the Capacitor app

**Root cause**: The `isNativeCapacitor()` detection relied solely on
`window.Capacitor.isNativePlatform()`, which returns `false` on Android in
remote-URL mode until the bridge JavaScript has fully loaded. By the time the
sign-in button is rendered, the bridge might not have initialised yet.

**Fix**: Added an async helper `isNativeCapacitorAsync()` in
`src/lib/capacitor.ts` that:
- Waits up to 3 seconds for `window.Capacitor` to become available.
- Falls back to detecting the user-agent string `FintrNativeApp` (set via
  `android.appendUserAgent` in `capacitor.config.ts`) as a synchronous
  signal that is always present, regardless of bridge timing.

The sign-in functions were updated to use the async version so they wait for
the bridge before deciding whether to use the in-app browser.

---

### 2. "Login with Google" loading forever

**Root cause A — Local emulator**: The callback page at `/auth-callback` made a
request to `http://localhost:3000` (the backend). From within the Android
emulator, `localhost` resolves to the emulator itself, not the host machine. Use
`10.0.2.2` for Android emulator → host machine networking.

**Root cause B — Production device**: The `@capacitor/browser` plugin was falling
back to its web shim, which calls `window.open()`. On an Android WebView,
`window.open()` is a no-op, so the auth browser never opened.

This happened because `window.Capacitor.PluginHeaders` was never populated, so
`registerPlugin('Browser', …)` permanently cached the web fallback.

`PluginHeaders` is populated by Capacitor's `native-bridge.js`, which
`WebViewLocalServer` injects into the proxied HTML response. The injection was
failing silently for two reasons:

**Root cause C — Missing trailing slash in `server.url`**: The URL was
`https://www.fintr.ai?cv=123` (no `/` before `?`). Capacitor's `UriMatcher`
registers handlers for `https://host/` and `https://host/**`. A bare URL with
an empty path (`""`) matches neither pattern, so `shouldInterceptRequest` returns
`null` and the bridge JS is never injected.

**Fix C**: Updated `buildServerUrl()` in `capacitor.config.ts` to always insert
a trailing slash before any query parameters:
```
https://www.fintr.ai/?cv=1234567890
```

**Root cause D — `window.Capacitor.fromNative` missing**: Even when bridge
injection succeeded, every `nativePromise` call hung forever. Android's
`Bridge.java` delivers results back to JavaScript by calling:
```
evaluateJavascript("window.Capacitor.fromNative({…})")
```
Without `cap.fromNative` defined, all responses were silently dropped and every
promise stayed pending forever.

**Fix D**: Created `src/lib/capacitor-bridge-init.ts` — a manual bridge
initialiser that runs before any `@capacitor/…` import and:
- Detects `window.androidBridge` / `window.AndroidBridge` (the Java interface).
- Bails out early if `PluginHeaders` is already set (automatic injection worked).
- Defines `cap.fromNative` as the primary response delivery path.
- Defines `cap.toNative` / `cap.nativePromise` / `cap.nativeCallback` backed by
  `androidBridge.postMessage`.
- Sets `cap.PluginHeaders` for `Browser`, `App`, `CacheControl`, `NavigationInfo`, `Appearance`, `Filesystem`, and `FileShare`
  so `registerPlugin()` chooses the native path.
- Sets `win.androidBridge.onmessage` as a secondary response path.

`initCapacitorBridgeIfNeeded()` is called immediately before every dynamic
`import('@capacitor/…')` across the codebase.

---

### 3. App crashing to home screen / black screen on startup

**Root cause**: `CacheControlPlugin.java` called WebView methods directly on the
`CapacitorPlugins` background thread:

```java
// BROKEN — WebView methods must run on the main UI thread
webView.clearCache(true);
webView.clearSslPreferences();
webView.reload();
```

`CacheVersionChecker` (mounted in the root layout) calls
`CacheControl.clearCacheAndReload()` on every launch when the backend cache
version has changed. Because the plugin ran on the wrong thread, Android threw a
fatal `RuntimeException`, crashing the app instantly. After the crash, Android
restarted the app automatically, which triggered the same crash again — producing
a crash loop that showed up as:
- **Emulator**: app dies to the home screen repeatedly.
- **Real device**: black screen (crash happens before any content renders).

**Fix**: Wrapped all WebView calls in `getActivity().runOnUiThread(…)`:

```java
// FIXED — all WebView calls on the main UI thread
@PluginMethod
public void clearCacheAndReload(PluginCall call) {
  WebView webView = getBridge().getWebView();
  if (webView == null) {
    call.resolve();
    return;
  }
  getActivity().runOnUiThread(() -> {
    webView.clearCache(true);
    webView.clearSslPreferences();
    webView.reload();
    call.resolve();
  });
}
```

**File**: `android/app/src/main/java/com/fintr/app/CacheControlPlugin.java`

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/capacitor.ts` | Added `isNativeCapacitorAsync()` with UA fallback |
| `capacitor.config.ts` | `buildServerUrl()` always adds trailing slash before `?` |
| `src/lib/capacitor-bridge-init.ts` | **New** — manual Capacitor bridge for Android remote-URL mode |
| `src/services/auth/modal-google-signin.ts` | Call `initCapacitorBridgeIfNeeded()` before plugin import |
| `src/services/auth/in-app-apple-signin.ts` | Call `initCapacitorBridgeIfNeeded()` before plugin import |
| `src/components/deep-link-handler.tsx` | Call `initCapacitorBridgeIfNeeded()` before plugin import |
| `android/.../FintrAppearanceBridge.java` | Direct `window.FintrAppearance.setTheme()` for status bar on release APK |
| `src/lib/native-appearance.ts` | Prefers `FintrAppearance` JS bridge, then Capacitor `Appearance` plugin |
| `src/components/auth/unified-auth-page.tsx` | Call `initCapacitorBridgeIfNeeded()` before plugin import |
| `src/app/auth-callback/page.tsx` | Call `initCapacitorBridgeIfNeeded()` before plugin import |
| `android/app/src/main/java/com/fintr/app/CacheControlPlugin.java` | Wrap WebView calls in `runOnUiThread` |
| `src/plugins/cache-control.ts` | `CacheControl` plugin registration |

---

## Debugging Tips

### Check logcat for crashes

```bash
adb logcat -d -s "AndroidRuntime,WebView" | grep -E "FATAL|CacheControl|fintr"
```

### Check if the bridge initialised correctly

Open Chrome DevTools (`chrome://inspect`) while the emulator is running and
check the console for:

```
[CapacitorBridgeInit] Initializing Capacitor bridge manually (Android remote-URL mode)
[CapacitorBridgeInit] Bridge ready – PluginHeaders: Browser, App, CacheControl
```

If you see this, the automatic injection failed and the manual fallback took
over. Both paths should work correctly after these fixes.

If you don't see it, the automatic injection succeeded (expected behaviour).

### Confirm the server URL has a trailing slash

After `npx cap sync android`, check:

```bash
cat android/app/src/main/assets/capacitor.config.json | grep url
```

The URL must be `https://www.fintr.ai/?cv=…`, not `https://www.fintr.ai?cv=…`.

### Android emulator host machine address

| Use case | Address |
|---|---|
| Backend API from emulator | `http://10.0.2.2:3000` |
| Frontend dev server from emulator | `http://10.0.2.2:5173` |
| From host browser | `http://localhost:PORT` |

---

## How the Production Remote-URL Mode Works

```
Android app starts
  └─ WebView loads  https://www.fintr.ai/?cv=TIMESTAMP
       └─ Capacitor WebViewLocalServer intercepts the request
            └─ Fetches HTML from https://www.fintr.ai
            └─ Injects native-bridge.js into <head>
                 └─ native-bridge.js sets window.Capacitor.PluginHeaders
                 └─ registerPlugin('Browser') → uses native path ✅

  If injection fails (UriMatcher miss, network error, etc.):
       └─ initCapacitorBridgeIfNeeded() runs (manual fallback)
            └─ Detects window.androidBridge
            └─ Sets up cap.fromNative, cap.toNative, PluginHeaders
            └─ registerPlugin('Browser') → uses native path ✅
```
