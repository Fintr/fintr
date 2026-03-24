import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useKeyboardDetector } from "./useKeyboardDetector";

describe("useKeyboardDetector", () => {
  let visualViewportMock: {
    get height(): number;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  let mockVvHeight = 800;
  let mockWindowHeight = 800;

  beforeEach(() => {
    mockVvHeight = 800;
    mockWindowHeight = 800;
    
    visualViewportMock = {
      get height() {
        return mockVvHeight;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Mock window.visualViewport with getter
    Object.defineProperty(window, "visualViewport", {
      get: () => visualViewportMock,
      configurable: true,
    });

    // Mock window.innerHeight with getter
    Object.defineProperty(window, "innerHeight", {
      get: () => mockWindowHeight,
      configurable: true,
    });

    // Mock window events
    vi.spyOn(window, "addEventListener").mockImplementation(() => {});
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns initial state with keyboard closed", () => {
    const { result } = renderHook(() => useKeyboardDetector());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.visualViewportHeight).toBe(800);
    expect(result.current.layoutViewportHeight).toBe(800);
    expect(result.current.heightDifference).toBe(0);
  });

  it("detects keyboard open when visual viewport is smaller", async () => {
    // Simulate keyboard opening (visual viewport shrinks)
    mockVvHeight = 400;
    mockWindowHeight = 800;

    const { result } = renderHook(() => useKeyboardDetector());

    // Trigger resize
    const resizeCallback = (visualViewportMock.addEventListener.mock.calls as Array<[string, (...args: unknown[]) => void]>).find(
      (call) => call[0] === "resize"
    )?.[1];

    if (resizeCallback) {
      act(() => {
        resizeCallback();
      });
    }

    // Wait for state update
    await waitFor(() => {
      expect(result.current.isOpen).toBe(true);
    });

    expect(result.current.visualViewportHeight).toBe(400);
    expect(result.current.layoutViewportHeight).toBe(800);
    expect(result.current.heightDifference).toBe(400);
  });

  it("detects keyboard open when visual viewport is very small", async () => {
    // Simulate keyboard taking up most of the screen
    mockVvHeight = 250;
    mockWindowHeight = 700;

    const { result } = renderHook(() => useKeyboardDetector());

    // Trigger resize
    const resizeCallback = (visualViewportMock.addEventListener.mock.calls as Array<[string, (...args: unknown[]) => void]>).find(
      (call) => call[0] === "resize"
    )?.[1];

    if (resizeCallback) {
      act(() => {
        resizeCallback();
      });
    }

    // Wait for state update
    await waitFor(() => {
      expect(result.current.isOpen).toBe(true);
    });

    expect(result.current.visualViewportHeight).toBe(250);
  });

  it("does not detect keyboard when viewport difference is small", () => {
    // Small difference (e.g., just UI chrome, not keyboard)
    mockVvHeight = 750;
    mockWindowHeight = 800;

    const { result } = renderHook(() => useKeyboardDetector());

    // Should NOT detect keyboard (50px difference < 150px threshold)
    expect(result.current.isOpen).toBe(false);
    expect(result.current.heightDifference).toBe(50);
  });

  it("handles missing visual viewport API gracefully", () => {
    // Remove visualViewport
    Object.defineProperty(window, "visualViewport", {
      value: null,
      configurable: true,
    });

    const { result } = renderHook(() => useKeyboardDetector());

    // Should fall back to window.innerHeight
    expect(result.current.isOpen).toBe(false);
    expect(result.current.visualViewportHeight).toBe(800);
    expect(result.current.layoutViewportHeight).toBe(800);
  });

  it("cleans up event listeners on unmount", () => {
    const { unmount } = renderHook(() => useKeyboardDetector());

    unmount();

    // Should remove event listeners
    expect(visualViewportMock.removeEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function)
    );
  });

  it("handles orientation change events", () => {
    renderHook(() => useKeyboardDetector());

    // Should listen for orientationchange
    expect(window.addEventListener).toHaveBeenCalledWith(
      "orientationchange",
      expect.any(Function)
    );
  });
});
