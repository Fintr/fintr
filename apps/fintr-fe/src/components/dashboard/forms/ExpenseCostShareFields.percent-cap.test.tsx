import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ExpenseCostShareValue } from "./ExpenseCostShareFields";
import ExpenseCostShareFields from "./ExpenseCostShareFields";

vi.mock("@/hooks/async/useProAccess", () => ({
  useProAccess: () => ({
    data: { pro: true, source: "subscription", trialDaysRemaining: 0 },
    isPending: false,
    isPaused: false,
  }),
}));

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

vi.mock("./LoanEntityField", () => ({
  default: ({ value }: { value: string }) => (
    <input aria-label="Borrower" value={value} readOnly />
  ),
}));

const pressKey = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) => {
  const buttons = document.body.querySelectorAll(
    "[data-calculator-keyboard-button]",
  );
  const button = Array.from(buttons).find(
    (entry) => entry.textContent === label,
  );
  if (!button) {
    throw new Error(`Missing calculator key ${label}`);
  }
  await user.click(button);
};

describe("percent split keypad cap", () => {
  it("stops the second borrower so the percentages total 100", async () => {
    const user = userEvent.setup();

    const Stateful = () => {
      const [value, setValue] = useState<ExpenseCostShareValue>({
        enabled: true,
        mode: "percent",
        participants: [{ entityName: "A" }, { entityName: "B" }],
      });

      return (
        <ExpenseCostShareFields
          totalAmount={3000}
          currency="PHP"
          value={value}
          onChange={setValue}
        />
      );
    };

    render(<Stateful />);

    const [first, second] = screen.getAllByLabelText("Percentage");
    await user.click(first);
    await pressKey(user, "6");
    await pressKey(user, "0");
    expect(first).toHaveValue("60");

    await user.click(second);
    await pressKey(user, "8");
    await pressKey(user, "0");

    expect(first).toHaveValue("60");
    expect(second).toHaveValue("40");
  });

  it("lowers the first borrower when raising it would push the total over 100", async () => {
    const user = userEvent.setup();

    const Stateful = () => {
      const [value, setValue] = useState<ExpenseCostShareValue>({
        enabled: true,
        mode: "percent",
        participants: [
          { entityName: "A", percent: 40 },
          { entityName: "B", percent: 40 },
        ],
      });

      return (
        <ExpenseCostShareFields
          totalAmount={3000}
          currency="PHP"
          value={value}
          onChange={setValue}
        />
      );
    };

    render(<Stateful />);

    const [first, second] = screen.getAllByLabelText("Percentage");
    await user.click(first);
    await pressKey(user, "9");
    await pressKey(user, "0");

    expect(second).toHaveValue("40");
    expect(first).toHaveValue("60");
  });

  it("lowers percentages that already total more than 100", async () => {
    render(
      <ExpenseCostShareFields
        totalAmount={3000}
        currency="PHP"
        value={{
          enabled: true,
          mode: "percent",
          participants: [
            { entityName: "A", percent: 90 },
            { entityName: "B", percent: 90 },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    await screen.findByDisplayValue("10");
    const [first, second] = screen.getAllByLabelText("Percentage");
    expect(first).toHaveValue("90");
    expect(second).toHaveValue("10");
  });
});
