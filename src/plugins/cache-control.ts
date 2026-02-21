import { registerPlugin } from "@capacitor/core";

export interface CacheControlPlugin {
  /**
   * Clears the WebView cache and reloads the app.
   * Used when admin bumps cache version so all mobile clients get fresh content.
   */
  clearCacheAndReload(): Promise<void>;
}

const CacheControl = registerPlugin<CacheControlPlugin>("CacheControl");

export { CacheControl };
