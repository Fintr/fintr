import type { CapacitorConfig } from '@capacitor/cli';

// When CAPACITOR_SERVER_URL is set, the app loads the web app from that URL.
// - Development: set to http://localhost:5173 (or your machine IP) for live reload
// - Production: set to https://www.fintr.ai so the app always loads the latest website
//   (no app store update needed when you deploy web changes)
const serverUrl = process.env.CAPACITOR_SERVER_URL;
const serverConfig = serverUrl
  ? {
      url: serverUrl,
      ...(serverUrl.startsWith("http://") && { cleartext: true }),
    }
  : undefined;

const config: CapacitorConfig = {
  appId: 'com.fintr.app',
  appName: 'Fintr',
  webDir: 'out',
  // Server URL: app loads web content from this URL (dev: localhost, prod: https://www.fintr.ai)
  ...(serverConfig && { server: serverConfig }),
  ios: {
    scheme: 'fintrapp',
    contentInset: 'never'
  },
  android: {
    scheme: 'fintrapp', // Same as iOS for consistent Origin (fintrapp://) and CORS
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
