/**
 * Matches backend `Transactions::Transfer#fee_transaction_description`.
 * With note:  "Transfer fee for: <note>, amount: <transfer amount>"
 * Without:    "Transfer fee, amount: <transfer amount>"
 */
export const buildTransferFeeDescription = (params: {
  description?: string | null;
  transferAmount: number;
}): string => {
  const note = (params.description ?? "").trim();
  const amountLabel = formatTransferFeeAmountLabel(params.transferAmount);
  if (note) {
    return `Transfer fee for: ${note}, amount: ${amountLabel}`;
  }
  return `Transfer fee, amount: ${amountLabel}`;
};

export const formatTransferFeeAmountLabel = (amount: number): string => {
  if (!Number.isFinite(amount)) {
    return "0";
  }
  if (Number.isInteger(amount)) {
    return String(amount);
  }
  return String(amount);
};

export const TRANSFER_FEE_CATEGORY_NAME = "Transfer Fee";

export const localTransferFeeId = (clientMutationId: string): string =>
  `local:${clientMutationId}:fee`;

/** Fee placeholder for an optimistic series child (`local:{cid}:{n}:fee`). */
export const localSeriesChildTransferFeeId = (
  clientMutationId: string,
  index: number,
): string => `local:${clientMutationId}:${index + 1}:fee`;

export const isLocalTransferFeeId = (id: string): boolean =>
  id.startsWith("local:") && id.endsWith(":fee");
