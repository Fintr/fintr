import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getMobileModalViewportHeight } from "./mobile-modal-viewport-height";

describe("getMobileModalViewportHeight", () => {
  const originalVisualViewport = window.visualViewport;

  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 800,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: originalVisualViewport,
    });
    vi.restoreAllMocks();
  });

  it("uses window.innerHeight when visualViewport is unavailable", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: null,
    });

    expect(getMobileModalViewportHeight()).toBe(800);
  });

  it("uses visualViewport.height when the soft keyboard shrinks the visible area", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 420,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    expect(getMobileModalViewportHeight()).toBe(420);
  });

  it("rounds visualViewport.height", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 419.7,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    expect(getMobileModalViewportHeight()).toBe(420);
  });

  it("falls back to innerHeight when visualViewport.height is zero", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    expect(getMobileModalViewportHeight()).toBe(800);
  });
});
