import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCountUp } from "./useCountUp";

describe("useCountUp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the full duration when the first frame is delayed", () => {
    let frame: FrameRequestCallback | null = null;

    vi.stubGlobal(
      "requestAnimationFrame",
      (callback: FrameRequestCallback) => {
        frame = callback;
        return 1;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { result } = renderHook(() =>
      useCountUp(1_000, { duration: 500 }),
    );

    act(() => {
      frame?.(10_000);
    });

    expect(result.current).toBe(0);

    act(() => {
      frame?.(10_500);
    });

    expect(result.current).toBe(1_000);
  });
});
