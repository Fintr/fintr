import { describe, expect, it } from "vitest";

import { withNativeAuthStartPath } from "./native-shell-start-url";

describe("withNativeAuthStartPath", () => {
  it("opens a root server URL on the login screen", () => {
    expect(withNativeAuthStartPath("http://10.0.2.2:5173")).toBe(
      "http://10.0.2.2:5173/auth/",
    );
  });

  it("opens a trailing-slash server URL on the login screen", () => {
    expect(withNativeAuthStartPath("http://192.168.1.20:5173/")).toBe(
      "http://192.168.1.20:5173/auth/",
    );
  });

  it("keeps a server URL that already names a path", () => {
    expect(withNativeAuthStartPath("https://www.fintr.ai/dashboard/home")).toBe(
      "https://www.fintr.ai/dashboard/home",
    );
  });
});
