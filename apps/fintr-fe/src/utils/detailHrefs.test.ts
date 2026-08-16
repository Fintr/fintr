import {
  buildAccountDetailHref,
  buildEntityDetailHref,
  buildInsightsTagFilterHref,
  buildLoanDetailHref,
  buildTagsPageHref,
  buildTransactionDetailHref,
  buildTransactionsTagFilterHref,
  transactionViewHref,
} from "./detailHrefs";

describe("detailHrefs", () => {
  it("builds entity, account, transaction, and loan paths", () => {
    expect(buildEntityDetailHref("abc")).toBe(
      "/dashboard/space_settings/entities/detail?entityId=abc",
    );
    expect(buildAccountDetailHref("acc")).toBe(
      "/dashboard/space_settings/accounts/detail?accountId=acc",
    );
    expect(buildTransactionDetailHref("tx")).toBe(
      "/dashboard/transactions/detail?transactionId=tx",
    );
    expect(buildLoanDetailHref("loan")).toBe(
      "/dashboard/loans/detail?loanId=loan",
    );
  });

  it("builds tag destinations for transactions, dashboard, and tags", () => {
    expect(buildTransactionsTagFilterHref("tag-1")).toBe(
      "/dashboard/?tag=tag-1",
    );
    expect(buildInsightsTagFilterHref("tag-1")).toBe(
      "/dashboard/insights?tag=tag-1",
    );
    expect(buildTagsPageHref("tag/1")).toBe(
      "/dashboard/space_settings/tags?tagId=tag%2F1",
    );
  });

  it("sends loan activity rows to loan detail", () => {
    expect(
      transactionViewHref({
        id: "tx",
        isLoanActivity: true,
        loanId: "loan-1",
      }),
    ).toBe("/dashboard/loans/detail?loanId=loan-1");
  });
});
