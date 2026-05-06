import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMobileModalViewportHeight } from "./useMobileModalViewportHeight";

describe("useMobileModalViewportHeight", () => {
  const listeners: Record<string, Set<EventListener>> = {};

  const addEventListener = vi.fn(
    (type: string, listener: EventListener) => {
      if (!listeners[type]) {
        listeners[type] = new Set();
      }

      listeners[type].add(listener);
    },
  );

  const removeEventListener = vi.fn(
    (type: string, listener: EventListener) => {
      listeners[type]?.delete(listener);
    },
  );

  const dispatch = (type: string) => {
    listeners[type]?.forEach((fn) => {
      fn(new Event(type));
    });
  };

  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 800,
    });

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: {
        height: 800,
        addEventListener,
        removeEventListener,
      },
    });
  });

  afterEach(() => {
    Object.keys(listeners).forEach((k) => delete listeners[k]);
    vi.clearAllMocks();
  });

  it("returns null when the modal is closed", () => {
    const { result } = renderHook(() => useMobileModalViewportHeight(false));

    expect(result.current).toBeNull();
  });

  it("syncs height when visualViewport resize fires after keyboard dismiss", async () => {
    Object.defineProperty(window.visualViewport!, "height", {
      configurable: true,
      value: 400,
    });

    const { result } = renderHook(() => useMobileModalViewportHeight(true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(400);

    Object.defineProperty(window.visualViewport!, "height", {
      configurable: true,
      value: 780,
    });

    await act(async () => {
      dispatch("resize");
      await Promise.resolve();
    });

    expect(result.current).toBe(780);
  });

  it("updates on window resize when falling back to innerHeight", async () => {
    Object.defineProperty(window.visualViewport!, "height", {
      configurable: true,
      value: 0,
    });

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 640,
    });

    const { result } = renderHook(() => useMobileModalViewportHeight(true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(640);

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 900,
    });

    await act(async () => {
      window.dispatchEvent(new Event("resize"));
      await Promise.resolve();
    });

    expect(result.current).toBe(900);
  });
});
