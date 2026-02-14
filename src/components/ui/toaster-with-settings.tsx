"use client";

import { useToastSettings } from "@/contexts/ToastSettingsContext";
import { Toaster } from "@/components/ui/sonner";

/**
 * Renders the Sonner Toaster with position controlled by ToastSettingsContext.
 * Use this so onboarding (mobile) can show toasts at the bottom-most position
 * without relying on global CSS.
 */
export function ToasterWithSettings() {
  const { settings } = useToastSettings();
  return (
    <Toaster
      position="bottom-center"
      style={{
        bottom: `${settings.offsetBottom}px`,
      }}
    />
  );
}
