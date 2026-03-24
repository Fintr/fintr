import { registerPlugin } from '@capacitor/core';

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

export const NavigationInfo = registerPlugin<NavigationInfoPlugin>('NavigationInfo', {
  web: () => Promise.resolve({
    getNavigationInfo: async () => ({
      navMode: -1,
      is3ButtonNavigation: false,
      isGestureNavigation: false,
      platform: 'web'
    }),
    applySafeAreaClasses: async () => {
      console.log('[NavigationInfo] Web shim - no native classes to apply');
    }
  } as NavigationInfoPlugin)
});
