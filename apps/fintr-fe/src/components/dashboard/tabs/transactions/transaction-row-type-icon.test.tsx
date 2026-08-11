import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionRowTypeIcon } from "./transaction-row-type-icon";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

describe("TransactionRowTypeIcon", () => {
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
});
