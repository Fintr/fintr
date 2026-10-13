import { afterEach, describe, expect, it } from "vitest";

import { getAuthSessionStorageKeys } from "./auth-storage";
import {
  buildEarlyErrorDetectionScript,
  buildRestoringSessionScript,
  RESTORING_SESSION_CLASS,
  shouldRedirectNativeHomeToAuth,
} from "./early-error-detection-script";

describe("buildRestoringSessionScript", () => {
  const storeSession = (expiresAt: number) => {
    const keys = getAuthSessionStorageKeys();
    localStorage.setItem(keys.accessToken, "access");
    localStorage.setItem(keys.idToken, "id");
    localStorage.setItem(keys.user, JSON.stringify({ sub: "auth0|1" }));
    localStorage.setItem(keys.expiresAt, String(expiresAt));
  };

  const runAt = (path: string) => {
    window.history.replaceState({}, "", path);
    new Function(buildRestoringSessionScript())();
  };

  const isHidden = () =>
    document.documentElement.classList.contains(RESTORING_SESSION_CLASS);

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(RESTORING_SESSION_CLASS);
    window.history.replaceState({}, "", "/");
  });

  it("hides the login form before paint when a valid session is stored", () => {
    storeSession(Date.now() + 60_000);

    runAt("/auth");

    expect(isHidden()).toBe(true);
  });

  it("covers the trailing-slash auth path and the login and signup pages", () => {
    storeSession(Date.now() + 60_000);

    for (const path of ["/auth/", "/login", "/signup"]) {
      document.documentElement.classList.remove(RESTORING_SESSION_CLASS);
      runAt(path);
      expect(isHidden()).toBe(true);
    }
  });

  it("shows the login form when the stored session has expired", () => {
    storeSession(Date.now() - 1_000);

    runAt("/auth");

    expect(isHidden()).toBe(false);
  });

  it("shows the login form when nothing is stored", () => {
    runAt("/auth");

    expect(isHidden()).toBe(false);
  });

  it("ignores pages that are not the login screen", () => {
    storeSession(Date.now() + 60_000);

    runAt("/dashboard/home");

    expect(isHidden()).toBe(false);
  });

  it("is part of the inline bootstrap", () => {
    expect(buildEarlyErrorDetectionScript()).toContain(
      buildRestoringSessionScript(),
    );
  });
});

describe("buildEarlyErrorDetectionScript", () => {
  it("initializes the early error buffer", () => {
    const script = buildEarlyErrorDetectionScript();

    expect(script).toContain("window.__earlyErrors = []");
  });

  it("skips chunk auto-reload while offline", () => {
    const script = buildEarlyErrorDetectionScript();

    expect(script).toContain("navigator.onLine === false");
    expect(script).toContain("fintr_chunk_reload_at");
  });

  it("sets a named sourceURL so the browser does not fetch the page path as a .txt source map", () => {
    const script = buildEarlyErrorDetectionScript();

    expect(script).toContain("//# sourceURL=fintr-early-error-detection.js");
  });

  it("strips accidental .txt page paths so a source-map 404 cannot reload-loop", () => {
    const script = buildEarlyErrorDetectionScript();

    expect(script).toContain('location.pathname.slice(-4) === ".txt"');
    expect(script).toContain("location.replace");
  });

  it("sends the native shell from the marketing home straight to login", () => {
    const script = buildEarlyErrorDetectionScript();

    expect(script).toContain('navigator.userAgent.indexOf("FintrNativeApp")');
    expect(script).toContain('location.replace("/auth"');
    expect(shouldRedirectNativeHomeToAuth("FintrNativeApp", "/")).toBe(true);
    expect(
      shouldRedirectNativeHomeToAuth(
        "Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile",
        "/",
      ),
    ).toBe(false);
    expect(
      shouldRedirectNativeHomeToAuth("FintrNativeApp", "/dashboard/home"),
    ).toBe(false);
  });
});
