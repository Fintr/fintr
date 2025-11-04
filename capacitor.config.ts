import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fintr.app',
  appName: 'Fintr',
  webDir: 'out',
  // Server configuration for development
  // For iOS Simulator: use 'localhost'
  // For physical iOS device: use your Mac's IP address (find with: ifconfig | grep "inet ")
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'http://localhost:5173',
    cleartext: true, // Allow HTTP (required for localhost)
  },
  ios: {
    scheme: 'fintrapp',
    contentInset: 'automatic'
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
