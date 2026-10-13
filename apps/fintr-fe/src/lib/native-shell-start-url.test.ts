import { describe, expect, it } from "vitest";

import {
  NATIVE_APP_START_PATH,
  toNativeServerUrl,
} from "./native-shell-start-url";

describe("toNativeServerUrl", () => {
  it("adds the root slash to a bare origin", () => {
    expect(toNativeServerUrl("http://10.0.2.2:5173")).toBe(
      "http://10.0.2.2:5173/",
    );
  });

  it("drops paths and query strings so every same-origin URL stays in-app", () => {
    expect(toNativeServerUrl("http://localhost:5173/auth/?cv=123")).toBe(
      "http://localhost:5173/",
    );
  });

  it("returns an unparseable URL unchanged", () => {
    expect(toNativeServerUrl("not a url")).toBe("not a url");
  });
});

describe("NATIVE_APP_START_PATH", () => {
  it("starts on the login screen without a leading slash", () => {
    expect(NATIVE_APP_START_PATH).toBe("auth");
  });
});
