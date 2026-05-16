import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVisualViewportRect } from "./useVisualViewportRect";

describe("useVisualViewportRect", () => {
  let offsetTop = 0;
  let offsetLeft = 0;
  let vvWidth = 390;
  let vvHeight = 844;

  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();

  beforeEach(() => {
    offsetTop = 0;
    offsetLeft = 0;
    vvWidth = 390;
    vvHeight = 844;
    addEventListener.mockClear();
    removeEventListener.mockClear();

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 844,
    });

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: {
        get offsetTop() {
          return offsetTop;
        },
        get offsetLeft() {
          return offsetLeft;
        },
        get width() {
          return vvWidth;
        },
        get height() {
          return vvHeight;
        },
        addEventListener,
        removeEventListener,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("when disabled, does not attach visualViewport listeners", () => {
    const { result } = renderHook(() => useVisualViewportRect(false));

    expect(result.current.width).toBe(390);
    expect(result.current.height).toBe(844);
    expect(addEventListener).not.toHaveBeenCalled();
  });

  it("reads offset and size when enabled", () => {
    offsetTop = 60;
    offsetLeft = 0;
    vvHeight = 500;

    const { result } = renderHook(() => useVisualViewportRect(true));

    expect(result.current.top).toBe(60);
    expect(result.current.left).toBe(0);
    expect(result.current.width).toBe(390);
    expect(result.current.height).toBe(500);
  });

  it("updates on visualViewport resize", async () => {
    const { result } = renderHook(() => useVisualViewportRect(true));

    expect(result.current.height).toBe(844);

    vvHeight = 420;

    const resizeHandler = addEventListener.mock.calls.find(
      (c) => c[0] === "resize",
    )?.[1] as () => void;

    await act(async () => {
      resizeHandler?.();
    });

    expect(result.current.height).toBe(420);
  });
});
