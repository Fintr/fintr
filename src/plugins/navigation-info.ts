export interface NavigationInfo {
  navMode: number;
  is3ButtonNavigation: boolean;
  isGestureNavigation: boolean;
  platform: string;
}

export interface NavigationInfoPlugin {
  getNavigationInfo(): Promise<NavigationInfo>;
  applySafeAreaClasses(): Promise<void>;
}

const webFallback: NavigationInfoPlugin = {
  getNavigationInfo: async () => ({
    navMode: -1,
    is3ButtonNavigation: false,
    isGestureNavigation: false,
    platform: 'web'
  }),
  applySafeAreaClasses: async () => {
    console.log('[NavigationInfo] Web shim - no native classes to apply');
  }
};

let NavigationInfoExport: NavigationInfoPlugin;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const capacitorCore = require('@capacitor/core');
  const registerPlugin = capacitorCore.registerPlugin as <T>(name: string, opts?: object) => T;
  NavigationInfoExport = registerPlugin<NavigationInfoPlugin>('NavigationInfo', {
    web: () => Promise.resolve(webFallback)
  });
} catch (error) {
  console.warn('[NavigationInfo] Failed to register plugin:', error);
  NavigationInfoExport = webFallback;
}

export { NavigationInfoExport as NavigationInfo };
