import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";

const proAccess = vi.hoisted(() => ({
  pro: true,
  source: "subscription" as "trial" | "none" | "subscription",
  isPending: false,
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  useProAccess: () => ({
    data: proAccess.isPending
      ? undefined
      : {
          pro: proAccess.pro,
          source: proAccess.source,
          trialDaysRemaining: proAccess.source === "trial" ? 4 : 0,
        },
    isPending: proAccess.isPending,
    isPaused: false,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

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
  beforeEach(() => {
    proAccess.pro = true;
    proAccess.source = "subscription";
    proAccess.isPending = false;
  });

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

  it("shows each percentage share amount beside the percentage field", () => {
    render(
      <ExpenseCostShareFields
        totalAmount={1000}
        currency="PHP"
        value={{
          enabled: true,
          mode: "percent",
          participants: [
            { entityName: "", percent: 50 },
            { entityName: "Miko2", percent: 25 },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    const shareAmounts = screen.getAllByLabelText("Share amount");
    expect(shareAmounts).toHaveLength(2);
    expect(shareAmounts[0]).toHaveTextContent("500");
    expect(shareAmounts[1]).toHaveTextContent("250");

    const percentageField = screen.getAllByLabelText("Percentage")[0];
    expect(shareAmounts[0].parentElement).toContainElement(percentageField);
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

  it("caps each percentage between 0.01 and 100", () => {
    const onChange = vi.fn();

    const { rerender } = render(
      <ExpenseCostShareFields
        totalAmount={3000}
        currency="PHP"
        value={{
          enabled: true,
          mode: "percent",
          participants: [{ entityName: "Miko2", percent: 50 }],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Percentage"), {
      target: { value: "150" },
    });
    expect(screen.getByLabelText("Percentage")).toHaveValue("100");
    expect(onChange).toHaveBeenLastCalledWith({
      enabled: true,
      mode: "percent",
      participants: [{ entityName: "Miko2", percent: 100 }],
    });

    rerender(
      <ExpenseCostShareFields
        totalAmount={3000}
        currency="PHP"
        value={{
          enabled: true,
          mode: "percent",
          participants: [{ entityName: "Miko2" }],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Percentage"), {
      target: { value: "0.001" },
    });
    expect(screen.getByLabelText("Percentage")).toHaveValue("0.01");
    expect(onChange).toHaveBeenLastCalledWith({
      enabled: true,
      mode: "percent",
      participants: [{ entityName: "Miko2", percent: 0.01 }],
    });
  });

  it("pulls percentages that already total more than 100 back down", async () => {
    const onChange = vi.fn();

    render(
      <ExpenseCostShareFields
        totalAmount={3000}
        currency="PHP"
        value={{
          enabled: true,
          mode: "percent",
          participants: [
            { entityName: "Entity A", percent: 80 },
            { entityName: "Entity B", percent: 80 },
          ],
        }}
        onChange={onChange}
      />,
    );

    await waitFor(() => {
      const fields = screen.getAllByLabelText("Percentage");
      expect(fields[0]).toHaveValue("80");
      expect(fields[1]).toHaveValue("20");
    });
    expect(onChange).toHaveBeenCalledWith({
      enabled: true,
      mode: "percent",
      participants: [
        { entityName: "Entity A", percent: 80 },
        { entityName: "Entity B", percent: 20 },
      ],
    });
  });

  it("keeps combined percentages from going over 100", () => {
    const onChange = vi.fn();

    render(
      <ExpenseCostShareFields
        totalAmount={1000}
        currency="PHP"
        value={{
          enabled: true,
          mode: "percent",
          participants: [
            { entityName: "Entity A", percent: 60 },
            { entityName: "Entity B", percent: 10 },
          ],
        }}
        onChange={onChange}
      />,
    );

    const fields = screen.getAllByLabelText("Percentage");
    fireEvent.change(fields[1], { target: { value: "50" } });

    expect(fields[1]).toHaveValue("40");
    expect(onChange).toHaveBeenLastCalledWith({
      enabled: true,
      mode: "percent",
      participants: [
        { entityName: "Entity A", percent: 60 },
        { entityName: "Entity B", percent: 40 },
      ],
    });
  });

  it("caps split amounts so they cannot exceed the bill", () => {
    const onChange = vi.fn();

    render(
      <ExpenseCostShareFields
        totalAmount={1000}
        currency="PHP"
        value={{
          enabled: true,
          mode: "amount",
          participants: [
            { entityName: "Entity A", amount: 600 },
            { entityName: "Entity B", amount: 100 },
          ],
        }}
        onChange={onChange}
      />,
    );

    const fields = screen.getAllByLabelText("Amount");
    fireEvent.change(fields[1], { target: { value: "900" } });

    expect(fields[1]).toHaveValue("400");
    expect(onChange).toHaveBeenLastCalledWith({
      enabled: true,
      mode: "amount",
      participants: [
        { entityName: "Entity A", amount: 600 },
        { entityName: "Entity B", amount: 400 },
      ],
    });
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

  it("badges Split with people during a trial and still opens the split", async () => {
    proAccess.source = "trial";
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

    const button = screen.getByRole("button", { name: /split with people/i });
    expect(button).toHaveTextContent("Pro");
    await user.click(button);
    expect(onChange).toHaveBeenCalledWith({
      enabled: true,
      mode: "equal",
      participants: [{ entityName: "" }],
    });
  });

  it("does not open the split without Fintr Pro", async () => {
    proAccess.pro = false;
    proAccess.source = "none";
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <ExpenseCostShareFields
        totalAmount={1000}
        currency="PHP"
        value={{
          enabled: true,
          mode: "equal",
          participants: [{ entityName: "Entity A" }],
        }}
        onChange={onChange}
      />,
    );

    expect(screen.queryByLabelText("Borrower")).not.toBeInTheDocument();
    expect(
      screen.getByText("Fintr Pro is required for Split with people"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /split with people/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
