import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";

import type { ExpenseCostShareValue } from "./ExpenseCostShareFields";

import ExpenseCostShareFields, {
  shouldShowExpenseCostShare,
} from "./ExpenseCostShareFields";

vi.mock("./LoanEntityField", () => ({
  default: ({
    value,
    onChange,
    excludeNames,
  }: {
    value: string;
    onChange: (value: string) => void;
    excludeNames?: string[];
  }) => (
    <label>
      Borrower
      <input
        aria-label="Borrower"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {excludeNames?.length ? (
        <span>{`Excluded ${excludeNames.join(", ")}`}</span>
      ) : null}
    </label>
  ),
}));

vi.mock("@/components/ui/calculator-input", () => ({
  CalculatorInput: ({
    id,
    value,
    onChange,
  }: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

describe("shouldShowExpenseCostShare", () => {
  it("is only available for one-time create", () => {
    expect(
      shouldShowExpenseCostShare({
        isEditMode: false,
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      }),
    ).toBe(true);
    expect(
      shouldShowExpenseCostShare({
        isEditMode: true,
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      }),
    ).toBe(false);
    expect(
      shouldShowExpenseCostShare({
        isEditMode: false,
        scheduleType: ScheduleTypeEnum.REPEAT,
      }),
    ).toBe(false);
    expect(
      shouldShowExpenseCostShare({
        isEditMode: false,
        scheduleType: ScheduleTypeEnum.INSTALLMENT,
      }),
    ).toBe(false);
  });
});

describe("ExpenseCostShareFields", () => {
  it("expands, adds a borrower, and previews an equal split", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ExpenseCostShareFields
        totalAmount={1000}
        currency="PHP"
        value={{
          enabled: false,
          mode: "equal",
          participants: [],
        }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /split with people/i }));

    expect(onChange).toHaveBeenCalledWith({
      enabled: true,
      mode: "equal",
      participants: [{ entityName: "" }],
    });
  });

  it("shows your expense and what the other person owes", async () => {
    render(
      <ExpenseCostShareFields
        totalAmount={1000}
        currency="PHP"
        value={{
          enabled: true,
          mode: "equal",
          participants: [{ entityName: "Entity A" }],
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/your expense/i)).toHaveTextContent("500");
    expect(screen.getByText(/entity a owes you/i)).toHaveTextContent("500");
  });

  it("lets you add another person and keeps the first borrower selectable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ExpenseCostShareFields
        totalAmount={1000}
        currency="PHP"
        value={{
          enabled: true,
          mode: "equal",
          participants: [{ entityName: "Miko2" }],
        }}
        onChange={onChange}
      />,
    );

    expect(screen.getAllByLabelText("Borrower")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /add another person/i }));
    expect(onChange).toHaveBeenCalledWith({
      enabled: true,
      mode: "equal",
      participants: [{ entityName: "Miko2" }, { entityName: "" }],
    });
  });

  it("labels the share field Amount or Percentage and keeps NaN editable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <ExpenseCostShareFields
        totalAmount={300}
        currency="GBP"
        value={{
          enabled: true,
          mode: "amount",
          participants: [{ entityName: "Miko2", amount: Number.NaN }],
        }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("Amount")).toHaveValue("");
    await user.type(screen.getByLabelText("Amount"), "150");
    expect(onChange).toHaveBeenLastCalledWith({
      enabled: true,
      mode: "amount",
      participants: [{ entityName: "Miko2", amount: 150 }],
    });

    rerender(
      <ExpenseCostShareFields
        totalAmount={300}
        currency="GBP"
        value={{
          enabled: true,
          mode: "percent",
          participants: [{ entityName: "Miko2", percent: Number.NaN }],
        }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("Percentage")).toHaveValue("");
    await user.type(screen.getByLabelText("Percentage"), "40");
    expect(onChange).toHaveBeenLastCalledWith({
      enabled: true,
      mode: "percent",
      participants: [{ entityName: "Miko2", percent: 40 }],
    });
  });

  it("excludes already chosen people from the next borrower picker", () => {
    render(
      <ExpenseCostShareFields
        totalAmount={1000}
        currency="PHP"
        value={{
          enabled: true,
          mode: "equal",
          participants: [{ entityName: "Miko2" }, { entityName: "" }],
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Excluded Miko2")).toBeInTheDocument();
  });

  it("keeps an in-progress decimal editable in the calculator field", async () => {
    const user = userEvent.setup();

    const StatefulFields = () => {
      const [value, setValue] = useState<ExpenseCostShareValue>({
        enabled: true,
        mode: "amount",
        participants: [{ entityName: "Miko2" }],
      });

      return (
        <ExpenseCostShareFields
          totalAmount={300}
          currency="GBP"
          value={value}
          onChange={setValue}
        />
      );
    };

    render(<StatefulFields />);

    const amountField = screen.getByLabelText("Amount");
    await user.type(amountField, "1.5");
    expect(amountField).toHaveValue("1.5");
  });
});
