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

  // Append cache version as query parameter for cache busting
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}cv=${CACHE_VERSION}`;
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
