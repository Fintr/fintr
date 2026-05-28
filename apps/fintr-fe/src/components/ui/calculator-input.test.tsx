import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalculatorInput } from "./calculator-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

vi.mock("@/hooks/usePlatformDetection", () => ({
  usePlatformDetection: () => ({
    isAndroidNative: false,
    isIOSNative: false,
    isNative: false,
    isMobileBrowser: false,
    isAndroidBrowser: false,
    isIOSBrowser: false,
    safeAreaInsetBottom: 0,
    safeAreaInsetTop: 0,
    hasAndroid3ButtonNav: false,
  }),
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

  describe("Switching between calculator fields", () => {
    it("shows the keyboard on every focus when moving between fields", async () => {
      const user = userEvent.setup();

      await act(async () => {
        render(
          <div>
            <CalculatorInput
              value=""
              onChange={mockOnChange}
              placeholder="Amount A"
            />
            <CalculatorInput
              value=""
              onChange={mockOnChange}
              placeholder="Amount B"
            />
            <CalculatorInput
              value=""
              onChange={mockOnChange}
              placeholder="Amount C"
            />
          </div>,
        );
      });

      const inputA = screen.getByPlaceholderText("Amount A");
      const inputB = screen.getByPlaceholderText("Amount B");
      const inputC = screen.getByPlaceholderText("Amount C");

      await user.click(inputA);
      expect(document.body.querySelector("[data-calculator-keyboard]")).toBeTruthy();

      await user.click(inputB);
      expect(document.body.querySelector("[data-calculator-keyboard]")).toBeTruthy();

      await user.click(inputC);
      expect(document.body.querySelector("[data-calculator-keyboard]")).toBeTruthy();

      await user.click(inputA);
      expect(document.body.querySelector("[data-calculator-keyboard]")).toBeTruthy();
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

    it("uses a compact floating layout inside a modal on desktop", async () => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 1280,
      });

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
      expect(keyboard?.className).not.toContain("rounded-t-xl");
      expect(keyboard?.className).toContain("rounded-xl");
      expect(keyboard?.textContent).toContain("250");
    });

    it("uses bottom-sheet layout inside a modal on mobile", async () => {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 390,
      });

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

    it("evaluates expressions when Enter is pressed (same as =)", async () => {
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
      fireEvent.change(input, { target: { value: "100+50" } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

      expect(mockOnChange).toHaveBeenCalledWith("150");
    });

    it("prevents parent form submit when Enter is pressed with keyboard open", async () => {
      const onSubmit = vi.fn((event: SubmitEvent) => {
        event.preventDefault();
      });

      await act(async () => {
        render(
          <form
            onSubmit={(event) => {
              onSubmit(event.nativeEvent);
            }}
          >
            <CalculatorInput
              value=""
              onChange={mockOnChange}
              placeholder="0.00"
            />
            <button type="submit">Save</button>
          </form>,
        );
      });

      const input = screen.getByPlaceholderText("0.00");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "10+5" } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

      expect(onSubmit).not.toHaveBeenCalled();
      expect(mockOnChange).toHaveBeenCalledWith("15");
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
