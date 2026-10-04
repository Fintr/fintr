import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("CapacitorLoader", () => {
  it("does not load the on-device model before the login screen", () => {
    const source = readFileSync(
      resolve(__dirname, "./capacitor-loader.tsx"),
      "utf8",
    );

    expect(source).not.toContain("initializeOnDeviceLlm");
  });
});
