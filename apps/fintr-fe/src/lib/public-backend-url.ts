const isAndroidNativeFintrApp = (): boolean => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (!/Android/i.test(ua)) return false;
  return ua.includes("FintrNativeApp") || /; wv\)/.test(ua);
};

/**
 * Base URL for browser/API calls. On the Android emulator, `localhost` and
 * `127.0.0.1` refer to the emulator, not the host machine — map them to
 * `10.0.2.2` when running inside the native app WebView.
 *
 * Auth0 `audience` should keep using `NEXT_PUBLIC_BE_URL` as configured in Auth0;
 * only use this helper for actual HTTP/WebSocket traffic.
 */
export const getPublicBackendUrl = (): string | undefined => {
  const raw = process.env.NEXT_PUBLIC_BE_URL;
  if (!raw) return undefined;
  if (typeof window === "undefined") return raw;
  if (!isAndroidNativeFintrApp()) return raw;

  try {
    const u = new URL(raw);
    if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return raw;
    u.hostname = "10.0.2.2";
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.origin}${path}${u.search}${u.hash}`;
  } catch {
    return raw;
  }
};
