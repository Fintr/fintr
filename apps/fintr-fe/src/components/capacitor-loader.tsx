"use client";

import { useEffect } from 'react';
import { initCapacitorBridgeIfNeeded } from '@/lib/capacitor-bridge-init';
import { initCapacitorKeyboardInsetBridge } from '@/lib/capacitor-keyboard-inset';
import { syncNativeAppearanceFromStorage } from '@/lib/native-appearance';
import { initializeSafeAreas } from '@/lib/navigation-info';

export default function CapacitorLoader() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    initCapacitorKeyboardInsetBridge();

    const ua = navigator.userAgent || "";
    const uaLower = ua.toLowerCase();

    const capacitor = (window as any).Capacitor;
    const platform =
      capacitor && typeof capacitor.getPlatform === "function"
        ? capacitor.getPlatform()
        : null;

    const isFintrNativeApp = uaLower.includes("fintrnativeapp");

    const isAndroidNative =
      isFintrNativeApp
      && (uaLower.includes("android") || platform === "android");

    const isIOSNative =
      isFintrNativeApp
      && (/iPhone|iPad|iPod/i.test(ua) || platform === "ios");

    if (isAndroidNative || isIOSNative) {
      if (isAndroidNative) {
        initCapacitorBridgeIfNeeded();
      }

      void syncNativeAppearanceFromStorage();
    }

    if (isAndroidNative) {
      // Then initialize safe areas by calling the Android native plugin
      // This ensures CSS variables and classes are properly set
      initializeSafeAreas().then((result) => {
        if (result.ok) {
          console.log('[CapacitorLoader] Safe areas initialized:', result.value);
        } else {
          console.warn('[CapacitorLoader] Safe area initialization failed:', result.message);
        }
      });
    }

    if (isIOSNative) {
      document.documentElement.classList.add("fintr-native-ios");
    }

    const isLikelyCapacitor =
      window.location.protocol === 'capacitor:' ||
      window.location.href.includes('capacitor://') ||
      (window as any).Capacitor !== undefined;

    if ((window as any).Capacitor) {
      if (isAndroidNative) {
        initCapacitorBridgeIfNeeded();
      }
      return;
    }

    if (!isLikelyCapacitor) return;

  }, []);

  return null;
}
