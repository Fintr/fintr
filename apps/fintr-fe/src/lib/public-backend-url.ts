import { hasFintrNativeAppUserAgent } from "@/lib/capacitor";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

const isAndroidNativeFintrApp = (): boolean => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (!/Android/i.test(ua)) return false;
  return ua.includes("FintrNativeApp") || /; wv\)/.test(ua);
};

const formatBackendUrl = (url: URL): string => {
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.origin}${path}${url.search}${url.hash}`;
};

const usesDevSameOriginProxy = (): boolean => {
  if (process.env.NODE_ENV !== "development") return false;

  const host = window.location.hostname;
  return (
    LOCAL_HOSTNAMES.has(host) ||
    host.startsWith("192.168.") ||
    host === "10.0.2.2"
  );
};

const remapLocalhostHostname = (
  raw: string,
  hostname: string,
): string | undefined => {
  try {
    const url = new URL(raw);
    if (!LOCAL_HOSTNAMES.has(url.hostname)) return undefined;
    url.hostname = hostname;
    return formatBackendUrl(url);
  } catch {
    return undefined;
  }
};

/**
 * Base URL for browser/API calls. On the Android emulator, `localhost` and
 * `127.0.0.1` refer to the emulator, not the host machine — map them to
 * `10.0.2.2` when running inside the native app WebView.
 *
 * In local development, HTTP traffic uses the Next.js dev server origin so
 * `/api/v1/*` is proxied to Rails (see `next.config.ts` rewrites). That avoids
 * cross-origin failures in iOS Simulator WKWebView and browser CORS edge cases.
 *
 * On a physical iOS/Android device loading live reload from your Mac's LAN IP,
 * remap `localhost` in `NEXT_PUBLIC_BE_URL` to that same IP when not using the
 * dev proxy (production / static bundles).
 *
 * Auth0 `audience` should keep using `NEXT_PUBLIC_BE_URL` as configured in Auth0;
 * only use this helper for actual HTTP/WebSocket traffic.
 */
export const getPublicBackendUrl = (): string | undefined => {
  const raw = process.env.NEXT_PUBLIC_BE_URL;
  if (!raw) return undefined;
  if (typeof window === "undefined") return raw;

  if (usesDevSameOriginProxy()) {
    return window.location.origin;
  }

  if (isAndroidNativeFintrApp()) {
    return remapLocalhostHostname(raw, "10.0.2.2") ?? raw;
  }

  if (hasFintrNativeAppUserAgent()) {
    const pageHost = window.location.hostname;
    if (!LOCAL_HOSTNAMES.has(pageHost)) {
      return remapLocalhostHostname(raw, pageHost) ?? raw;
    }
  }

  return raw;
};

/**
 * Base URL for ActionCable WebSockets. Must hit Rails directly — Next.js
 * rewrites only proxy `/api/v1/*` and do not upgrade `/cable` WebSockets.
 * Still remaps emulator/device localhost like {@link getPublicBackendUrl}.
 */
export const getActionCableBackendUrl = (): string => {
  const raw =
    process.env.NEXT_PUBLIC_BE_URL?.replace(/\/$/, "") ||
    "http://localhost:3001";

  if (typeof window === "undefined") {
    return raw;
  }

  if (isAndroidNativeFintrApp()) {
    return remapLocalhostHostname(raw, "10.0.2.2") ?? raw;
  }

  if (hasFintrNativeAppUserAgent()) {
    const pageHost = window.location.hostname;
    if (!LOCAL_HOSTNAMES.has(pageHost)) {
      return remapLocalhostHostname(raw, pageHost) ?? raw;
    }
  }

  return raw;
};
