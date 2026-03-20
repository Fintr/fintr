"use client";

import { useEffect } from 'react';

/**
 * Component to ensure Capacitor is loaded in the HTML
 * This should be included in the root layout for Capacitor builds
 */
export default function CapacitorLoader() {
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    // Mark platform for platform-specific safe-area CSS rules.
    // We rely on native-injected UA marker ("FintrNativeApp") for reliable detection.
    // Important: this must run even when Capacitor is already loaded.
    const ua = navigator.userAgent || "";
    const uaLower = ua.toLowerCase();

    const capacitor = (window as any).Capacitor;
    const platform =
      capacitor && typeof capacitor.getPlatform === "function"
        ? capacitor.getPlatform()
        : null;

    // Detect Android native app
    const isAndroidNative =
      (uaLower.includes("android") && uaLower.includes("fintrnativeapp")) ||
      platform === "android" ||
      (/Android/i.test(ua) && /; wv\)/.test(ua));

    // Detect iOS native app
    const isIOSNative =
      (uaLower.includes("iphone") && uaLower.includes("fintrnativeapp")) ||
      (uaLower.includes("ipad") && uaLower.includes("fintrnativeapp")) ||
      platform === "ios" ||
      (/iPhone|iPad|iPod/i.test(ua) && /; wv\)/.test(ua));

    if (isAndroidNative) {
      document.documentElement.classList.add("fintr-native-android");
    }

    if (isIOSNative) {
      document.documentElement.classList.add("fintr-native-ios");
    }

    // Check if we're in a Capacitor environment by checking the user agent
    // or if Capacitor script should be loaded
    const isLikelyCapacitor =
      window.location.protocol === 'capacitor:' ||
      window.location.href.includes('capacitor://') ||
      (window as any).Capacitor !== undefined;

    // If Capacitor is already loaded, we're good
    if ((window as any).Capacitor) {
      console.log('✅ Capacitor is already loaded');
      return;
    }

    // If we're not in a Capacitor environment, don't try to load it
    if (!isLikelyCapacitor) {
      return;
    }

    // Try to load Capacitor script if it's not already loaded
    // In a proper Capacitor build, this should already be in the HTML
    // But we'll add a safety check
    const scriptId = 'capacitor-script';
    if (document.getElementById(scriptId)) {
      return;
    }

    console.log('⚠️ Capacitor not found - this might be expected in browser mode');
  }, []);

  return null;
}

