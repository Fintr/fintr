import type { CapacitorConfig } from '@capacitor/cli';

import {
  NATIVE_APP_START_PATH,
  toNativeServerUrl,
} from './src/lib/native-shell-start-url';

// When CAPACITOR_SERVER_URL is set, the app loads the web app from that URL.
// - Development: set to http://localhost:5173 (or your machine IP) for live reload
// - Production (FIN-194 default): leave UNSET so the native app loads bundled `out/`
//   (see scripts/mobile/build-production.sh / build-production-android.sh)
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

const serverConfig = serverUrl
  ? {
      url: toNativeServerUrl(serverUrl),
      appStartPath: NATIVE_APP_START_PATH,
      ...(serverUrl.startsWith("http://") && { cleartext: true }),
    }
  : {
      appStartPath: NATIVE_APP_START_PATH,
    };

const config: CapacitorConfig = {
  appId: 'com.fintr.app',
  appName: 'Fintr',
  webDir: 'out',
  // Server URL: dev live reload only. Production store builds leave url unset (bundled out/).
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
      launchShowDuration: 0,
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
