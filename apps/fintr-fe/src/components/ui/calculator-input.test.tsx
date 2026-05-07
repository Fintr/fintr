import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalculatorInput } from "./calculator-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

// Mock the Capacitor native check
vi.mock("@/lib/capacitor", () => ({
  isNativeCapacitor: () => true,
}));

// Mock the platform detection
vi.mock("@/lib/platform-detection", () => ({
  getSafeAreaInsets: () => ({ bottom: 48, top: 0, left: 0, right: 0 }),
}));

describe("CalculatorInput", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    document.documentElement.className = "";
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Keyboard visibility", () => {
    it("should NOT close keyboard when clicking a calculator button", async () => {
      const user = userEvent.setup();

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
      await user.click(input);

      // Keyboard should be open
      let keyboard = document.body.querySelector(
        '[data-calculator-keyboard]'
      );
      expect(keyboard).toBeTruthy();

      // Find and click a calculator button (e.g., button "7")
      const button7 = document.body.querySelector('[data-calculator-keyboard] button');
      expect(button7).toBeTruthy();
      await user.click(button7 as Element);

      // Keyboard should still be open after clicking a button
      keyboard = document.body.querySelector('[data-calculator-keyboard]');
      expect(keyboard).toBeTruthy();
    });

    it("should close keyboard when clicking outside", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <div>
            <CalculatorInput
              value=""
              onChange={mockOnChange}
              placeholder="0.00"
            />
            <button data-testid="outside">Outside</button>
          </div>
        );
      });

      const input = screen.getByPlaceholderText("0.00");
      await user.click(input);

      // Keyboard should be open
      let keyboard = document.body.querySelector('[data-calculator-keyboard]');
      expect(keyboard).toBeTruthy();

      // Click outside
      const outsideButton = screen.getByTestId("outside");
      await user.click(outsideButton);

      // Keyboard should be closed
      keyboard = document.body.querySelector('[data-calculator-keyboard]');
      expect(keyboard).toBeFalsy();
    });
  });

  describe("Dialog + CalculatorInput interaction", () => {
    it("should NOT close dialog or keyboard when clicking a calculator button inside a dialog", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <Dialog open={true} onOpenChange={() => {}}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Loan Payment</DialogTitle>
              </DialogHeader>
              <CalculatorInput
                value=""
                onChange={mockOnChange}
                placeholder="0.00"
              />
            </DialogContent>
          </Dialog>
        );
      });

      // Dialog should be open
      expect(screen.getByText("Record Loan Payment")).toBeInTheDocument();

      const input = screen.getByPlaceholderText("0.00");
      await user.click(input);

      // Keyboard should be open
      let keyboard = document.body.querySelector('[data-calculator-keyboard]');
      expect(keyboard).toBeTruthy();

      // Find and click a calculator button
      const button = document.body.querySelector('[data-calculator-keyboard] button');
      expect(button).toBeTruthy();
      await user.click(button as Element);

      // Dialog should still be open
      expect(screen.getByText("Record Loan Payment")).toBeInTheDocument();

      // Keyboard should still be open
      keyboard = document.body.querySelector('[data-calculator-keyboard]');
      expect(keyboard).toBeTruthy();
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
