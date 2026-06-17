import type { CapacitorConfig } from '@capacitor/cli';

// When CAPACITOR_SERVER_URL is set, the app loads the web app from that URL.
// - Development: set to http://localhost:5173 (or your machine IP) for live reload
// - Production: set to https://www.fintr.ai so the app always loads the latest website
//   (no app store update needed when you deploy web changes)
//
// 10.0.2.2 is the Android emulator alias for the host machine. It does not work on
// iOS Simulator — if it gets baked into ios/App/App/capacitor.config.json, the WebView
// stays blank. Ignore it when the CLI targets iOS only (e.g. cap sync ios).
const rawCapacitorServerUrl = process.env.CAPACITOR_SERVER_URL;
const isIosCapacitorCliInvocation =
  process.argv.includes("ios") &&
  (process.argv.includes("sync") ||
    process.argv.includes("run") ||
    process.argv.includes("copy") ||
    process.argv.includes("open") ||
    process.argv.includes("update"));

const serverUrl =
  rawCapacitorServerUrl &&
  rawCapacitorServerUrl.includes("10.0.2.2") &&
  isIosCapacitorCliInvocation
    ? (() => {
        console.warn(
          "[capacitor.config] Ignoring CAPACITOR_SERVER_URL with 10.0.2.2 for iOS (Android emulator only). " +
            "Use http://localhost:5173 for iOS Simulator live reload, or unset for bundled out/."
        );
        return undefined;
      })()
    : rawCapacitorServerUrl;

// Cache-busting version - change this value to force all apps to refresh their cache
// This can be updated via admin panel to trigger cache refresh across all devices
const CACHE_VERSION = process.env.CAPACITOR_CACHE_VERSION || Date.now().toString();

const buildServerUrl = (baseUrl: string | undefined): string | undefined => {
  if (!baseUrl) return undefined;

  // Ensure the URL has a path component (trailing slash) before the query string.
  // Capacitor's WebViewLocalServer registers handlers for "https://host/" and
  // "https://host/**". A bare URL like "https://www.fintr.ai?cv=123" has an
  // empty path (""), which does NOT match either pattern, so
  // shouldInterceptRequest returns null and the Capacitor bridge JS
  // (PluginHeaders, nativeCallback, etc.) is never injected into the page.
  // Adding the slash ensures path="/" which DOES match, triggering injection.
  const [origin, existingQuery] = baseUrl.split('?');
  const base = origin.endsWith('/') ? origin : `${origin}/`;
  const withSlash = existingQuery ? `${base}?${existingQuery}` : base;

  const separator = withSlash.includes('?') ? '&' : '?';
  return `${withSlash}${separator}cv=${CACHE_VERSION}`;
};

const serverConfig = serverUrl
  ? {
      url: buildServerUrl(serverUrl),
      errorPath: 'offline.html',
      ...(serverUrl.startsWith("http://") && { cleartext: true }),
    }
  : {
      errorPath: 'offline.html',
    };

const config: CapacitorConfig = {
  appId: 'com.fintr.app',
  appName: 'Fintr',
  webDir: 'out',
  // Server URL: app loads web content from this URL (dev: localhost, prod: https://www.fintr.ai)
  // errorPath: bundled offline.html shown when the remote server cannot be reached
  server: serverConfig,
  // FintrNativeApp is appended to the WebView user-agent so that JavaScript running inside
  // the WebView (including code served from https://www.fintr.ai) can reliably detect it is
  // running inside the native Capacitor app, independently of the Capacitor bridge injection
  // timing. Checked in isNativeCapacitor() in src/lib/capacitor.ts.
  ios: {
    scheme: 'fintrapp',
    contentInset: 'never',
    appendUserAgent: 'FintrNativeApp',
    backgroundColor: '#FAFAF8',
  },
  android: {
    // Same as iOS for consistent Origin (fintrapp://) and CORS.
    // Capacitor's TS types don't currently model android.scheme, so we cast to preserve runtime behavior.
    scheme: 'fintrapp',
    appendUserAgent: 'FintrNativeApp',
  } as any,
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#FAFAF8",
      showSpinner: false,
    },
    // Inject reliable safe-area CSS variables on Android WebView.
    // See https://capacitorjs.com/docs/apis/system-bars
    SystemBars: {
      insetsHandling: "css",
      style: "LIGHT",
      hidden: false,
      animation: "NONE",
    },
    StatusBar: {
      style: "light",
      backgroundColor: "#151921",
    },
    Browser: {
      presentationStyle: 'fullscreen',
      toolbarColor: '#151921',
      showTitle: true
    },
    // Keep WebView layout full-screen on iOS; keyboard overlays. JS uses keyboardHeight
    // from this plugin when visualViewport does not shrink (WKWebView + custom frame).
    Keyboard: {
      resize: 'none',
    },
  }
};

export default config;
