import { afterEach, describe, expect, it, vi } from "vitest";

import {
  pushDashboardDetail,
  rememberDetailHref,
  resolveDetailSearchParam,
} from "./detailSearchParam";

const emptyParams = { get: () => null };

describe("resolveDetailSearchParam", () => {
  afterEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("prefers Next search params", () => {
    expect(
      resolveDetailSearchParam("transactionId", { get: () => "from-next" }),
    ).toBe("from-next");
  });

  it("falls back to the browser URL when Next search params are empty", () => {
    window.history.replaceState(
      {},
      "",
      "/dashboard/transactions/detail?transactionId=from-location",
    );

    expect(resolveDetailSearchParam("transactionId", emptyParams)).toBe(
      "from-location",
    );
  });

  it("falls back to the remembered href when the URL query was stripped", () => {
    rememberDetailHref("/dashboard/transactions/detail?transactionId=tx-99");
    window.history.replaceState({}, "", "/dashboard/transactions/detail");

    expect(resolveDetailSearchParam("transactionId", emptyParams)).toBe("tx-99");
  });
});

describe("pushDashboardDetail", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("remembers the detail id before navigating", () => {
    const push = vi.fn();

    pushDashboardDetail(
      { push },
      "/dashboard/loans/detail?loanId=loan-1",
    );

    expect(push).toHaveBeenCalledWith("/dashboard/loans/detail?loanId=loan-1");
    window.history.replaceState({}, "", "/dashboard/loans/detail");
    expect(resolveDetailSearchParam("loanId", emptyParams)).toBe("loan-1");
  });
});
