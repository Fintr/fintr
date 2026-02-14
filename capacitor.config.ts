import type { CapacitorConfig } from '@capacitor/cli';

// Only use server URL in development (when CAPACITOR_SERVER_URL is explicitly set)
// For production/staging builds, omit server config to use bundled app
const serverConfig = process.env.CAPACITOR_SERVER_URL
  ? {
      url: process.env.CAPACITOR_SERVER_URL,
      cleartext: true, // Allow HTTP (required for localhost)
    }
  : undefined;

const config: CapacitorConfig = {
  appId: 'com.fintr.app',
  appName: 'Fintr',
  webDir: 'out',
  // Server configuration for development only
  // For iOS Simulator: use 'localhost'
  // For physical iOS device: use your Mac's IP address (find with: ifconfig | grep "inet ")
  // For production/staging: leave CAPACITOR_SERVER_URL unset to use bundled app
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
