import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { TransactionRowTypeIcon } from "./transaction-row-type-icon";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

const { mockExpenseCategoryOptions, mockIncomeCategoryOptions } = vi.hoisted(() => ({
  mockExpenseCategoryOptions: vi.fn(() => [] as Array<{
    label: string;
    value: string;
    icon?: string;
    color?: string;
    children?: unknown[];
  }>),
  mockIncomeCategoryOptions: vi.fn(() => [] as Array<{
    label: string;
    value: string;
    icon?: string;
    color?: string;
    children?: unknown[];
  }>),
}));

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => ({
    expenseCategoryOptions: mockExpenseCategoryOptions(),
    incomeCategoryOptions: mockIncomeCategoryOptions(),
  }),
}));

describe("TransactionRowTypeIcon", () => {
  beforeEach(() => {
    mockExpenseCategoryOptions.mockReturnValue([]);
    mockIncomeCategoryOptions.mockReturnValue([]);
  });
  it("renders a blue transfer icon for transfers", () => {
    const { container } = render(
      <TransactionRowTypeIcon
        row={{
          id: "1",
          date: "2026-08-08",
          description: "Move cash",
          amount: 100,
          categoryName: "Transfer",
          fromAccountName: "Cash",
          toAccountName: "Bank",
          type: CombinedTransactionTypeEnum.TRANSFER,
          inSeries: false,
          hasImage: false,
        }}
      />,
    );

    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.firstChild).toHaveClass("text-blue-900");
  });

  it("renders the same loan icon for loan disbursement and payment", () => {
    const baseRow = {
      id: "1",
      date: "2026-08-08",
      description: "Loan",
      amount: 100,
      categoryName: "Loan",
      fromAccountName: "Cash",
      toAccountName: "",
      inSeries: false,
      hasImage: false,
      isLoanActivity: true,
      loanId: "loan-1",
    };

    const { container: disbursement } = render(
      <TransactionRowTypeIcon
        row={{
          ...baseRow,
          type: CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
        }}
      />,
    );

    const { container: payment } = render(
      <TransactionRowTypeIcon
        row={{
          ...baseRow,
          categoryName: "Loan payment",
          type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
        }}
      />,
    );

    expect(disbursement.firstChild).toHaveAttribute(
      "style",
      expect.stringContaining("color: rgb(57, 73, 171)"),
    );
    expect(payment.firstChild).toHaveAttribute(
      "style",
      expect.stringContaining("color: rgb(57, 73, 171)"),
    );
  });

  it("renders a category icon for regular expenses instead of arrows", () => {
    const { container } = render(
      <TransactionRowTypeIcon
        row={{
          id: "1",
          date: "2026-08-08",
          description: "Groceries",
          amount: 100,
          categoryName: "Food & Groceries",
          fromAccountName: "Cash",
          toAccountName: "",
          type: CombinedTransactionTypeEnum.EXPENSE,
          inSeries: false,
          hasImage: false,
        }}
      />,
    );

    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.firstChild).toHaveAttribute(
      "style",
      expect.stringContaining("color: rgb(67, 160, 71)"),
    );
  });

  it("renders a compact icon when size is sm", () => {
    const { container } = render(
      <TransactionRowTypeIcon
        size="sm"
        row={{
          id: "1",
          date: "2026-08-08",
          description: "Move cash",
          amount: 100,
          categoryName: "Transfer",
          fromAccountName: "Cash",
          toAccountName: "Bank",
          type: CombinedTransactionTypeEnum.TRANSFER,
          inSeries: false,
          hasImage: false,
        }}
      />,
    );

    expect(container.firstChild).toHaveClass("h-5", "w-5");
  });

  it("uses the saved category icon and color for custom categories", () => {
    mockExpenseCategoryOptions.mockReturnValue([
      {
        label: "Church1",
        value: "Church1",
        icon: "church",
        color: "#1E88E5",
        children: [],
      },
    ]);

    const { container } = render(
      <TransactionRowTypeIcon
        row={{
          id: "1",
          date: "2026-08-10",
          description: "TEST1",
          amount: 8207.42,
          categoryName: "Church1",
          fromAccountName: "GCash",
          toAccountName: "",
          type: CombinedTransactionTypeEnum.EXPENSE,
          inSeries: false,
          hasImage: false,
        }}
      />,
    );

    expect(container.firstChild).toHaveAttribute(
      "style",
      expect.stringContaining("color: rgb(30, 136, 229)"),
    );
    expect(container.querySelector("svg")).toHaveClass("lucide-church");
  });
});
