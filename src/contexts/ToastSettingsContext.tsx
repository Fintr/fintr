"use client";

import React, { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface ToastSettings {
  /** Distance from bottom in px. Use a small value (e.g. 24) for bottom-most; larger (e.g. 88) to sit above mobile nav. */
  offsetBottom: number;
}

const defaultSettings: ToastSettings = {
  offsetBottom: 24,
};

const ToastSettingsContext = createContext<{
  settings: ToastSettings;
  setSettings: (settings: Partial<ToastSettings>) => void;
}>({
  settings: defaultSettings,
  setSettings: () => {},
});

export function ToastSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<ToastSettings>(defaultSettings);
  const setSettings = useCallback((next: Partial<ToastSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...next }));
  }, []);
  return (
    <ToastSettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </ToastSettingsContext.Provider>
  );
}

export function useToastSettings() {
  return useContext(ToastSettingsContext);
}
