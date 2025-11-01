import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fintr.app',
  appName: 'Fintr',
  webDir: 'public',
  server: {
    url: 'http://localhost:5173',
    cleartext: true
  },
  ios: {
    scheme: 'App',
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
