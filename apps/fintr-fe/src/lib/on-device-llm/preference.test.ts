import { describe, expect, it } from "vitest";

import {
  resolveAiLlmRoute,
  shouldFallbackToCloudAfterLocalFailure,
  shouldFallbackToOnDeviceLlm,
} from "./preference";
import { isNetworkError } from "./types";

describe("AI LLM priority routing", () => {
  it("routes local-first when user prefers on-device and hardware is ready", () => {
    expect(
      resolveAiLlmRoute({
        priority: "local",
        isNative: true,
        isOnline: true,
        readiness: "ready",
      }),
    ).toBe("local");

    expect(
      resolveAiLlmRoute({
        priority: "local",
        isNative: true,
        isOnline: false,
        readiness: "ready",
      }),
    ).toBe("local");
  });

  it("routes cloud when user prefers cloud and is online", () => {
    expect(
      resolveAiLlmRoute({
        priority: "cloud",
        isNative: true,
        isOnline: true,
        readiness: "ready",
      }),
    ).toBe("cloud");
  });

  it("uses on-device when cloud is preferred but the device is offline", () => {
    expect(
      resolveAiLlmRoute({
        priority: "cloud",
        isNative: true,
        isOnline: false,
        readiness: "ready",
      }),
    ).toBe("local");
  });

  it("falls back to cloud after local failure only for local priority while online", () => {
    expect(
      shouldFallbackToCloudAfterLocalFailure({
        priority: "local",
        isOnline: true,
      }),
    ).toBe(true);

    expect(
      shouldFallbackToCloudAfterLocalFailure({
        priority: "local",
        isOnline: false,
      }),
    ).toBe(false);
  });

  it("falls back to on-device after cloud network errors when cloud is preferred", () => {
    expect(
      shouldFallbackToOnDeviceLlm({
        isNative: true,
        readiness: "ready",
        priority: "cloud",
        error: { code: "ERR_NETWORK", message: "Network Error" },
      }),
    ).toBe(true);

    expect(
      shouldFallbackToOnDeviceLlm({
        isNative: true,
        readiness: "ready",
        priority: "local",
        error: { code: "ERR_NETWORK", message: "Network Error" },
      }),
    ).toBe(false);
  });

  it("detects axios-style network errors", () => {
    expect(isNetworkError({ code: "ERR_NETWORK" })).toBe(true);
    expect(isNetworkError(new Error("Network Error"))).toBe(true);
    expect(isNetworkError({ code: "ERR_BAD_REQUEST" })).toBe(false);
  });
});
