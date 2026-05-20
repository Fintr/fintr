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

    it("uses bottom-sheet layout inside a modal with a value display", async () => {
      await act(async () => {
        render(
          <div data-modal-content>
            <CalculatorInput
              value="250"
              onChange={mockOnChange}
              placeholder="0.00"
            />
          </div>,
        );
      });

      const input = screen.getByPlaceholderText("0.00");
      fireEvent.focus(input);

      const keyboard = document.body.querySelector("[data-calculator-keyboard]");
      expect(keyboard).toBeTruthy();
      expect(keyboard?.className).toContain("rounded-t-xl");
      expect(keyboard?.textContent).toContain("250");
    });

    it("displays thousand separators for plain amounts", () => {
      render(
        <CalculatorInput
          value="12345.67"
          onChange={mockOnChange}
          placeholder="0.00"
        />,
      );

      expect(screen.getByDisplayValue("12,345.67")).toBeInTheDocument();
    });

    it("always reserves the preview line to avoid layout shift", async () => {
      await act(async () => {
        render(
          <CalculatorInput
            value=""
            onChange={mockOnChange}
            placeholder="0.00"
          />,
        );
      });

      fireEvent.focus(screen.getByPlaceholderText("0.00"));

      const keyboard = document.body.querySelector("[data-calculator-keyboard]");
      const previewLines = keyboard?.querySelectorAll(
        "p.text-muted-foreground",
      );

      expect(previewLines?.length).toBe(1);
      expect(previewLines?.[0]?.textContent).toBe("= 0.00");
    });

    it("shows a live total for plain numbers without a formula", async () => {
      await act(async () => {
        render(
          <CalculatorInput
            value="5000"
            onChange={mockOnChange}
            placeholder="0.00"
          />,
        );
      });

      fireEvent.focus(screen.getByPlaceholderText("0.00"));

      const keyboard = document.body.querySelector("[data-calculator-keyboard]");
      expect(keyboard?.textContent).toContain("= 5,000");
    });

    it("formats calculator expressions with delimiters on the keyboard display", async () => {
      await act(async () => {
        render(
          <CalculatorInput
            value=""
            onChange={mockOnChange}
            placeholder="0.00"
          />,
        );
      });

      const input = screen.getByPlaceholderText("0.00");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "10000+500" } });

      const keyboard = document.body.querySelector("[data-calculator-keyboard]");
      expect(keyboard?.textContent).toContain("10,000+500");
      expect(keyboard?.textContent).toContain("= 10,500");
    });

    it("passes unformatted values to onChange", () => {
      render(
        <CalculatorInput
          value=""
          onChange={mockOnChange}
          placeholder="0.00"
        />,
      );

      const input = screen.getByPlaceholderText("0.00");
      fireEvent.change(input, { target: { value: "12,345" } });

      expect(mockOnChange).toHaveBeenCalledWith("12345");
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
