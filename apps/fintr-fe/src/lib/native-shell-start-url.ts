/**
 * Capacitor `server.appStartPath`: native shells open on the login screen instead of
 * the marketing homepage.
 *
 * Must include a leading slash. Bundled Android uses `https://localhost` without a
 * trailing slash before appStartPath is appended; `auth` becomes `https://localhostauth`.
 */
export const NATIVE_APP_START_PATH = "/auth";

/**
 * Capacitor iOS treats any URL that does not start with `server.url` as external and
 * opens it in Safari. Keep `server.url` at the bare origin root (no path, no query) so
 * redirects and full-page navigations stay inside the WebView. The trailing slash is
 * required for Android to inject the Capacitor bridge.
 */
export const toNativeServerUrl = (serverUrl: string): string => {
  try {
    return `${new URL(serverUrl).origin}/`;
  } catch {
    return serverUrl;
  }
};
