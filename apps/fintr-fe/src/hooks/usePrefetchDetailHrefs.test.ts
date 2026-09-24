import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const prefetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch }),
}));

describe("usePrefetchDetailHrefs", () => {
  beforeEach(() => {
    prefetch.mockReset();
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("prefetches each detail href while online", async () => {
    const { usePrefetchDetailHrefs } = await import("./usePrefetchDetailHrefs");

    renderHook(() =>
      usePrefetchDetailHrefs([
        "/dashboard/transactions/detail?transactionId=tx-1",
        "/dashboard/loans/detail?loanId=loan-1",
      ]),
    );

    expect(prefetch).toHaveBeenCalledWith(
      "/dashboard/transactions/detail?transactionId=tx-1",
    );
    expect(prefetch).toHaveBeenCalledWith(
      "/dashboard/loans/detail?loanId=loan-1",
    );
  });

  it("skips prefetch while offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { usePrefetchDetailHrefs } = await import("./usePrefetchDetailHrefs");

    renderHook(() =>
      usePrefetchDetailHrefs(["/dashboard/loans/detail?loanId=loan-1"]),
    );

    expect(prefetch).not.toHaveBeenCalled();
  });
});
