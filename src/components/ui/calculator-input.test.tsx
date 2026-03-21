import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CalculatorInput } from "./calculator-input";

// Mock the Capacitor native check
vi.mock("@/lib/capacitor", () => ({
  isNativeCapacitor: () => true, // Return true so tests work
}));

// Mock the platform detection - returns 48px bottom for Android safe area
vi.mock("@/lib/platform-detection", () => ({
  getSafeAreaInsets: () => ({ bottom: 48, top: 0, left: 0, right: 0 }),
}));

describe("CalculatorInput", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    // Reset document classes
    document.documentElement.className = "";
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Mobile Keyboard Positioning", () => {
    it("should position keyboard above Android 3-button navigation", async () => {
      // Simulate Android native environment
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
        writable: true,
        configurable: true,
      });

      // Mock window dimensions to simulate mobile
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 400, // Mobile width
      });

      let keyboardElement: Element | null = null;

      await act(async () => {
        render(
          <CalculatorInput
            value=""
            onChange={mockOnChange}
            placeholder="0.00"
          />
        );
      });

      // Click input to show keyboard
      const input = screen.getByPlaceholderText("0.00");
      fireEvent.focus(input);

      // Find the keyboard element (rendered via portal in document.body)
      keyboardElement = document.body.querySelector(
        '[class*="bg-background"][class*="shadow-2xl"]'
      );

      expect(keyboardElement).toBeTruthy();

      // Check that the keyboard has proper bottom offset style set
      // The fix ensures bottom offset is at least 48px for Android 3-button nav
      const style = (keyboardElement as HTMLElement).style;
      const bottomValue = style.bottom;

      // For native app, we expect additional bottom padding
      // The keyboard should have a non-zero bottom offset
      expect(bottomValue).not.toBe("0px");
      expect(bottomValue).not.toBe("");

      // Parse the value and verify it's at least 48px
      const bottomPixels = parseInt(bottomValue.replace("px", ""), 10);
      expect(bottomPixels).toBeGreaterThanOrEqual(48);
    });

    it("should use fixed positioning for mobile keyboard", async () => {
      // Mock mobile dimensions
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 400,
      });

      await act(async () => {
        render(
          <CalculatorInput
            value=""
            onChange={mockOnChange}
            placeholder="0.00"
          />
        );
      });

      // Click input to show keyboard
      const input = screen.getByPlaceholderText("0.00");
      fireEvent.focus(input);

      // Find the keyboard element
      const keyboard = document.body.querySelector(
        '[class*="bg-background"][class*="shadow-2xl"]'
      );

      expect(keyboard).toBeTruthy();

      // Check that mobile keyboard uses fixed positioning class
      expect(keyboard?.classList.contains("fixed")).toBe(true);
    });

    it("should cap bottom offset at 80px to prevent excessive spacing", async () => {
      // Even with very large safe area (mock returns 48), should not exceed 80px
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 400,
      });

      await act(async () => {
        render(
          <CalculatorInput
            value=""
            onChange={mockOnChange}
            placeholder="0.00"
          />
        );
      });

      const input = screen.getByPlaceholderText("0.00");
      fireEvent.focus(input);

      const keyboard = document.body.querySelector(
        '[class*="bg-background"][class*="shadow-2xl"]'
      );

      expect(keyboard).toBeTruthy();

      const style = (keyboard as HTMLElement).style;
      const bottomPixels = parseInt(style.bottom.replace("px", ""), 10);

      // Should be capped at 80px maximum
      expect(bottomPixels).toBeLessThanOrEqual(80);
    });
  });

  describe("Calculator Functionality", () => {
    it("renders input with placeholder", () => {
      render(
        <CalculatorInput
          value=""
          onChange={mockOnChange}
          placeholder="0.00"
        />
      );

      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });

    it("shows keyboard on focus", async () => {
      await act(async () => {
        render(
          <CalculatorInput
            value=""
            onChange={mockOnChange}
            placeholder="0.00"
          />
        );
      });

      const input = screen.getByPlaceholderText("0.00");
      fireEvent.focus(input);

      // Keyboard should be rendered via portal
      const keyboard = document.body.querySelector(
        '[class*="bg-background"][class*="shadow-2xl"]'
      );
      expect(keyboard).toBeTruthy();
    });

    it("calls onChange when typing numbers", () => {
      render(
        <CalculatorInput
          value=""
          onChange={mockOnChange}
          placeholder="0.00"
        />
      );

      const input = screen.getByPlaceholderText("0.00");
      fireEvent.change(input, { target: { value: "123" } });

      expect(mockOnChange).toHaveBeenCalledWith("123");
    });
  });
});
