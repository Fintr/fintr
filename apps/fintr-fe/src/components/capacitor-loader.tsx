"use client";

import { useEffect } from 'react';
import { initCapacitorBridgeIfNeeded } from '@/lib/capacitor-bridge-init';
import { initializeSafeAreas } from '@/lib/navigation-info';

export default function CapacitorLoader() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent || "";
    const uaLower = ua.toLowerCase();

    const capacitor = (window as any).Capacitor;
    const platform =
      capacitor && typeof capacitor.getPlatform === "function"
        ? capacitor.getPlatform()
        : null;

    const isAndroidNative =
      (uaLower.includes("android") && uaLower.includes("fintrnativeapp")) ||
      platform === "android" ||
      (/Android/i.test(ua) && /; wv\)/.test(ua));

    const isIOSNative =
      (uaLower.includes("iphone") && uaLower.includes("fintrnativeapp")) ||
      (uaLower.includes("ipad") && uaLower.includes("fintrnativeapp")) ||
      platform === "ios" ||
      (/iPhone|iPad|iPod/i.test(ua) && /; wv\)/.test(ua));

    if (isAndroidNative) {
      // Initialize the Capacitor bridge first (needed for manual bridge mode)
      initCapacitorBridgeIfNeeded();
      
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
