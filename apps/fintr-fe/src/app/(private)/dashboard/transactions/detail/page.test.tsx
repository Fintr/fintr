import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { rememberDetailHref } from "@/utils/detailSearchParam";

const mockSearchParamGet = vi.fn<(key: string) => string | null>();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamGet(key),
  }),
}));

vi.mock("@/components/dashboard/transactions/transaction-detail-content", () => ({
  TransactionDetailContent: ({ transactionId }: { transactionId: string }) => (
    <div>Detail for {transactionId}</div>
  ),
}));

import TransactionDetailPage from "./page";

describe("TransactionDetailPage", () => {
  afterEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("shows guidance when no transaction is selected", () => {
    mockSearchParamGet.mockReturnValue(null);
    render(<TransactionDetailPage />);

    expect(screen.getByText(/no transaction selected/i)).toBeInTheDocument();
  });

  it("renders the selected transaction", () => {
    mockSearchParamGet.mockReturnValue("tx-1");
    render(<TransactionDetailPage />);

    expect(screen.getByText("Detail for tx-1")).toBeInTheDocument();
  });

  it("recovers the id from the browser URL when Next search params are empty", () => {
    mockSearchParamGet.mockReturnValue(null);
    window.history.replaceState(
      {},
      "",
      "/dashboard/transactions/detail?transactionId=tx-location",
    );
    render(<TransactionDetailPage />);

    expect(screen.getByText("Detail for tx-location")).toBeInTheDocument();
  });

  it("recovers the id remembered before an offline navigation stripped the query", () => {
    mockSearchParamGet.mockReturnValue(null);
    rememberDetailHref("/dashboard/transactions/detail?transactionId=tx-stored");
    window.history.replaceState({}, "", "/dashboard/transactions/detail");
    render(<TransactionDetailPage />);

    expect(screen.getByText("Detail for tx-stored")).toBeInTheDocument();
  });
});
