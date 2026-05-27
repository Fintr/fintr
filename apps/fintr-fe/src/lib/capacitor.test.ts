import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasFintrNativeAppUserAgent,
  isNativeCapacitor,
  shouldRedirectHomeToAuth,
} from "./capacitor";

describe("isNativeCapacitor", () => {
  const originalNavigator = global.navigator;
  const originalWindow = global.window;

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
    global.window = originalWindow;
  });

  it("returns false for desktop Chrome", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    (global as any).window = { Capacitor: undefined };

    expect(isNativeCapacitor()).toBe(false);
  });

  it("returns false for Android mobile Chrome (not Fintr app)", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    });
    (global as any).window = { Capacitor: undefined };

    expect(isNativeCapacitor()).toBe(false);
  });

  it("returns false for generic Android WebView without FintrNativeApp", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36",
    });
    (global as any).window = { Capacitor: undefined };

    expect(isNativeCapacitor()).toBe(false);
  });

  it("returns true when FintrNativeApp is in the user agent", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1 FintrNativeApp",
    });
    (global as any).window = { Capacitor: undefined };

    expect(isNativeCapacitor()).toBe(true);
  });

  it("returns true when Capacitor reports ios platform in a native WebView", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone)" });
    (global as any).window = {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => "ios",
      },
    };

    expect(isNativeCapacitor()).toBe(true);
  });

  it("returns false when Capacitor reports android without FintrNativeApp or androidBridge", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    });
    (global as any).window = {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => "android",
      },
    };

    expect(isNativeCapacitor()).toBe(false);
  });

  it("returns true when Capacitor reports android with androidBridge", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36 FintrNativeApp",
    });
    (global as any).window = {
      androidBridge: { postMessage: () => {} },
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => "android",
      },
    };

    expect(isNativeCapacitor()).toBe(true);
  });

  it("returns false when Capacitor platform is web", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh)" });
    (global as any).window = {
      Capacitor: {
        isNativePlatform: () => false,
        getPlatform: () => "web",
      },
    };

    expect(isNativeCapacitor()).toBe(false);
  });
});

describe("shouldRedirectHomeToAuth", () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it("returns false for mobile browser without FintrNativeApp", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1",
    });

    expect(shouldRedirectHomeToAuth()).toBe(false);
    expect(hasFintrNativeAppUserAgent()).toBe(false);
  });

  it("returns true only for Fintr native app user agent", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) FintrNativeApp",
    });

    expect(shouldRedirectHomeToAuth()).toBe(true);
    expect(hasFintrNativeAppUserAgent()).toBe(true);
  });
});
