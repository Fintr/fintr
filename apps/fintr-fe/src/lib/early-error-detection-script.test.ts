import { describe, expect, it } from "vitest";

import {
  buildEarlyErrorDetectionScript,
  shouldRedirectNativeHomeToAuth,
} from "./early-error-detection-script";

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
