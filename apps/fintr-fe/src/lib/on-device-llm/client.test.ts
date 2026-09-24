import { afterEach, describe, expect, it, vi } from "vitest";

const getReadiness = vi.fn();

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => "android",
  },
}));

vi.mock("@/lib/capacitor", () => ({
  isNativeCapacitor: () => true,
  waitForCapacitor: async () => true,
}));

vi.mock("@/lib/capacitor-bridge-init", () => ({
  initCapacitorBridgeIfNeeded: () => {},
}));

vi.mock("@capgo/capacitor-llm", () => ({
  CapgoLLM: {
    getReadiness,
  },
}));

import {
  __resetOnDeviceLlmForTests,
  initializeOnDeviceLlm,
} from "./client";

describe("initializeOnDeviceLlm", () => {
  afterEach(() => {
    __resetOnDeviceLlmForTests();
    getReadiness.mockReset();
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  it("does not call CapgoLLM when the installed native shell has no plugin", async () => {
    (window as { Capacitor?: unknown }).Capacitor = {
      getPlatform: () => "android",
      PluginHeaders: [{ name: "Browser", methods: [] }],
    };

    await expect(initializeOnDeviceLlm()).resolves.toBe("unsupported");
    expect(getReadiness).not.toHaveBeenCalled();
  });
});
