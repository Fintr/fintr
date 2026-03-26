export interface CacheControlPlugin {
  /**
   * Clears the WebView cache and reloads the app.
   * Used when admin bumps cache version so all mobile clients get fresh content.
   */
  clearCacheAndReload(): Promise<void>;
}

let CacheControl: CacheControlPlugin;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const capacitorCore = require("@capacitor/core");
  const registerPlugin = capacitorCore.registerPlugin as <T>(name: string) => T;
  CacheControl = registerPlugin<CacheControlPlugin>("CacheControl");
} catch (error) {
  console.warn("[CacheControl] Failed to register plugin:", error);
  CacheControl = {
    clearCacheAndReload: async () => {
      console.warn("[CacheControl] Plugin not available, reloading page instead");
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    },
  };
}

export { CacheControl };
