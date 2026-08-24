export const buildEntityDetailHref = (entityId: string) =>
  `/dashboard/space_settings/entities/detail?entityId=${encodeURIComponent(entityId)}`;

export const buildAccountDetailHref = (accountId: string) =>
  `/dashboard/space_settings/accounts/detail?accountId=${encodeURIComponent(accountId)}`;

export const buildTransactionDetailHref = (transactionId: string) =>
  `/dashboard/transactions/detail?transactionId=${encodeURIComponent(transactionId)}`;

export const buildRecurringSeriesDetailHref = (seriesId: string) =>
  `/dashboard/recurring/detail?seriesId=${encodeURIComponent(seriesId)}`;

export const buildRecurringHubHref = () => "/dashboard/recurring";

export const buildLoanDetailHref = (loanId: string) =>
  `/dashboard/loans/detail?loanId=${encodeURIComponent(loanId)}`;

export const transactionViewHref = (transaction: {
  id: string;
  isLoanActivity?: boolean;
  loanId?: string;
}): string => {
  if (transaction.isLoanActivity && transaction.loanId) {
    return buildLoanDetailHref(transaction.loanId);
  }

  return buildTransactionDetailHref(transaction.id);
};

export const buildTransactionsTagFilterHref = (tagId: string) =>
  `/dashboard/?tag=${encodeURIComponent(tagId)}`;

export const buildInsightsTagFilterHref = (tagId: string) =>
  `/dashboard/insights?tag=${encodeURIComponent(tagId)}`;

export const buildTagsPageHref = (tagId: string) =>
  `/dashboard/space_settings/tags?tagId=${encodeURIComponent(tagId)}`;
