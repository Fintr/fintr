import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { rememberDetailHref } from "@/utils/detailSearchParam";

const mockSearchParamGet = vi.fn<(key: string) => string | null>();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParamGet(key),
  }),
}));

vi.mock("@/components/dashboard/loan-detail-content", () => ({
  default: ({ loanId }: { loanId: string }) => <div>Loan {loanId}</div>,
}));

import LoanDetailPage from "./page";

describe("LoanDetailPage", () => {
  afterEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("shows guidance when no loan is selected", () => {
    mockSearchParamGet.mockReturnValue(null);
    render(<LoanDetailPage />);

    expect(screen.getByText(/no loan selected/i)).toBeInTheDocument();
  });

  it("recovers the id remembered before an offline navigation stripped the query", () => {
    mockSearchParamGet.mockReturnValue(null);
    rememberDetailHref("/dashboard/loans/detail?loanId=loan-stored");
    window.history.replaceState({}, "", "/dashboard/loans/detail");
    render(<LoanDetailPage />);

    expect(screen.getByText("Loan loan-stored")).toBeInTheDocument();
  });
});
