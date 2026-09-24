import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import { useHydrationSafeValue } from "./useHydrationSafeValue";

describe("useHydrationSafeValue", () => {
  it("starts with the server snapshot, then reads the client value", () => {
    const { result } = renderHook(() =>
      useHydrationSafeValue(() => "client", "server"),
    );

    expect(result.current).toBe("client");
  });
});
