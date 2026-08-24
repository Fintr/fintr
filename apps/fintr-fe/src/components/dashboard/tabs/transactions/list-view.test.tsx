import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListView } from "./list-view";
import {
  CombinedTransactionTypeEnum,
  IndexTransaction,
  TransactionsPage,
} from "@/types/transactionTypes";
import { InfiniteData } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: null }),
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => ["space-1"],
}));

vi.mock("@/hooks/useOfflineReadMode", () => ({
  useSkipCachedNetworkFetch: () => false,
  usePreferLocalTransactionReads: () => false,
}));

vi.mock("@/hooks/useSpaceContext", () => ({
  useSpaceContext: () => ({ currentSpace: { currency: "PHP" } }),
}));

vi.mock("@/hooks/useAnchorTransactionsListToToday", () => ({
  TRANSACTION_DAY_DATA_ATTR: "data-transaction-day",
  useAnchorTransactionsListToToday: () => undefined,
}));

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => ({
    expenseCategoryOptions: [],
    incomeCategoryOptions: [],
  }),
}));

const buildTransaction = (
  overrides: Partial<IndexTransaction> = {},
): IndexTransaction => ({
  id: "tx-1",
  date: "2026-08-11",
  description: "",
  amount: 16414.84,
  amountCurrency: "PHP",
  categoryName: "Medicine",
  fromAccountName: "Cash - Ella",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  entityName: "Jollibee",
  ...overrides,
});

const buildData = (
  transactions: IndexTransaction[],
): InfiniteData<TransactionsPage> => ({
  pages: [
    {
      transactions,
      page: 1,
      totalPages: 1,
      totalCount: transactions.length,
    },
  ],
  pageParams: [1],
});

describe("ListView merchant layout", () => {
  it("shows merchant name on its own row, separate from the date metadata row", () => {
    const transaction = buildTransaction();

    render(
      <ListView
        isPending={false}
        isError={false}
        error={null}
        isSuccess={true}
        data={buildData([transaction])}
        isFetchingNextPage={false}
        hasNextPage={false}
        onRowEdit={vi.fn()}
        onRowDelete={vi.fn()}
        loadMoreRef={{ current: null }}
      />,
    );

    const merchant = screen.getByText("Jollibee");
    const date = screen.getByText("8/11/2026");

    expect(merchant).toBeInTheDocument();
    expect(date).toBeInTheDocument();
    expect(merchant.parentElement).not.toBe(date.parentElement);
  });

  it("shows category between date and account when there is no merchant", () => {
    const transaction = buildTransaction({
      description: "T44",
      categoryName: "SSS Contributions",
      fromAccountName: "Grab",
      entityName: "",
    });

    render(
      <ListView
        isPending={false}
        isError={false}
        error={null}
        isSuccess={true}
        data={buildData([transaction])}
        isFetchingNextPage={false}
        hasNextPage={false}
        onRowEdit={vi.fn()}
        onRowDelete={vi.fn()}
        loadMoreRef={{ current: null }}
      />,
    );

    const metadataRow = screen.getByText("8/11/2026").parentElement;
    expect(metadataRow).toHaveTextContent("8/11/2026");
    expect(metadataRow).toHaveTextContent("SSS Contributions");
    expect(metadataRow).toHaveTextContent("Grab");
    expect(metadataRow?.textContent).toMatch(
      /8\/11\/2026.*SSS Contributions.*Grab/,
    );
  });

  it("shows merchant and subcategory category on the same row", () => {
    const transaction = buildTransaction({
      description: "Lunch",
      subcategoryName: "Pharmacy",
    });

    render(
      <ListView
        isPending={false}
        isError={false}
        error={null}
        isSuccess={true}
        data={buildData([transaction])}
        isFetchingNextPage={false}
        hasNextPage={false}
        onRowEdit={vi.fn()}
        onRowDelete={vi.fn()}
        loadMoreRef={{ current: null }}
      />,
    );

    const merchant = screen.getByText("Jollibee");
    const category = screen.getByText("Medicine › Pharmacy");

    expect(merchant.parentElement).toBe(category.parentElement);
    expect(merchant.parentElement).not.toBe(
      screen.getByText("8/11/2026").parentElement,
    );
  });

  it("shows loan contact under the title and keeps metadata uncluttered", () => {
    const transaction = buildTransaction({
      description: "Loan payment — Jerry Oquendo",
      entityName: "Jerry Oquendo",
      categoryName: "Loan payment",
      type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
      isLoanActivity: true,
      loanId: "loan-1",
      calculated: true,
    });

    render(
      <ListView
        isPending={false}
        isError={false}
        error={null}
        isSuccess={true}
        data={buildData([transaction])}
        isFetchingNextPage={false}
        hasNextPage={false}
        onRowEdit={vi.fn()}
        onRowDelete={vi.fn()}
        loadMoreRef={{ current: null }}
      />,
    );

    expect(screen.getByText("Loan payment")).toBeInTheDocument();
    const contact = screen.getByText("Jerry Oquendo");
    const date = screen.getByText("8/11/2026");

    expect(contact.parentElement).not.toBe(date.parentElement);
    expect(screen.queryByText("Loan payment — Jerry Oquendo")).not.toBeInTheDocument();
    expect(screen.getAllByText("Loan payment")).toHaveLength(1);
  });

  it("includes the loan purpose with the contact on loan payments", () => {
    const transaction = buildTransaction({
      description: "Loan payment — Car loan",
      entityName: "Jerry Oquendo",
      categoryName: "Loan payment",
      type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
      isLoanActivity: true,
      loanId: "loan-1",
      calculated: true,
    });

    render(
      <ListView
        isPending={false}
        isError={false}
        error={null}
        isSuccess={true}
        data={buildData([transaction])}
        isFetchingNextPage={false}
        hasNextPage={false}
        onRowEdit={vi.fn()}
        onRowDelete={vi.fn()}
        loadMoreRef={{ current: null }}
      />,
    );

    expect(screen.getByText("Loan payment")).toBeInTheDocument();
    expect(screen.getByText("Jerry Oquendo · Car loan")).toBeInTheDocument();
    expect(screen.queryByText("Loan payment — Car loan")).not.toBeInTheDocument();
  });
});
