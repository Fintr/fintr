import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetNativeCheckoutGateForTests,
  useNativeCheckoutGate,
} from "./useNativeCheckoutGate";

const capacitor = vi.hoisted(() => ({
  isNative: false,
  asyncIsNative: false,
}));

vi.mock("@/lib/capacitor", () => ({
  isNativeCapacitor: () => capacitor.isNative,
  isNativeCapacitorAsync: async () => capacitor.asyncIsNative,
}));

describe("useNativeCheckoutGate", () => {
  beforeEach(() => {
    capacitor.isNative = false;
    capacitor.asyncIsNative = false;
    resetNativeCheckoutGateForTests();
  });

  it("uses RevenueCat when the iOS or Android app is already detected", () => {
    capacitor.isNative = true;
    capacitor.asyncIsNative = true;

    const { result } = renderHook(() => useNativeCheckoutGate());

    expect(result.current).toBe("native");
  });

  it("uses Xendit after the browser check finishes", async () => {
    const { result } = renderHook(() => useNativeCheckoutGate());

    expect(result.current).toBe("unknown");
    await waitFor(() => {
      expect(result.current).toBe("web");
    });
  });
});
