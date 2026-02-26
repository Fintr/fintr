import type { CapacitorConfig } from '@capacitor/cli';

// When CAPACITOR_SERVER_URL is set, the app loads the web app from that URL.
// - Development: set to http://localhost:5173 (or your machine IP) for live reload
// - Production: set to https://www.fintr.ai so the app always loads the latest website
//   (no app store update needed when you deploy web changes)
const serverUrl = process.env.CAPACITOR_SERVER_URL;

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
      ...(serverUrl.startsWith("http://") && { cleartext: true }),
    }
  : undefined;

const config: CapacitorConfig = {
  appId: 'com.fintr.app',
  appName: 'Fintr',
  webDir: 'out',
  // Server URL: app loads web content from this URL (dev: localhost, prod: https://www.fintr.ai)
  ...(serverConfig && { server: serverConfig }),
  // FintrNativeApp is appended to the WebView user-agent so that JavaScript running inside
  // the WebView (including code served from https://www.fintr.ai) can reliably detect it is
  // running inside the native Capacitor app, independently of the Capacitor bridge injection
  // timing. Checked in isNativeCapacitor() in src/lib/capacitor.ts.
  ios: {
    scheme: 'fintrapp',
    contentInset: 'never',
    appendUserAgent: 'FintrNativeApp',
  },
  android: {
    scheme: 'fintrapp', // Same as iOS for consistent Origin (fintrapp://) and CORS
    appendUserAgent: 'FintrNativeApp',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#000000"
    },
    Browser: {
      presentationStyle: 'popover',
      toolbarColor: '#ffffff',
      showTitle: true
    }
  }
};

export default config;
