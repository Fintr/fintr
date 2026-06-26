import type { ConversionSnapshot } from "@/components/dashboard/forms/AmountWithRatePicker";

export function transactionHadStoredConversion(
  data: Record<string, unknown> | null | undefined,
): boolean {
  if (!data) return false;

  return (
    data.currency_conversion != null ||
    data.currencyConversion != null ||
    data.original_display_currency != null ||
    data.originalDisplayCurrency != null
  );
}

/**
 * Ledger currency for FX fetch, preview, and API conversion metadata.
 * Always targets the account when the amount currency differs from it — the backend
 * books in account currency, not space currency.
 */
export function resolveAmountPickerTargetCurrency({
  amountCurrency,
  accountLedgerCurrency,
  editBookedCurrency,
  effectiveSpaceCurrency,
}: {
  amountCurrency: string;
  accountLedgerCurrency: string | null;
  editBookedCurrency: string | null;
  effectiveSpaceCurrency: string;
  isEditMode?: boolean;
}): string | null {
  const accountCurrency = accountLedgerCurrency ?? editBookedCurrency;

  if (accountCurrency != null) {
    if (amountCurrency === accountCurrency) {
      return null;
    }

    return accountCurrency;
  }

  if (amountCurrency !== effectiveSpaceCurrency) {
    return effectiveSpaceCurrency;
  }

  return null;
}

export function conversionSnapshotMatchesTarget(
  snapshot: ConversionSnapshot | null,
  targetCurrency: string | null,
): boolean {
  if (!snapshot) return true;
  if (!targetCurrency) return true;
  if (snapshot.targetCurrency == null) return false;

  return snapshot.targetCurrency === targetCurrency;
}

export function shouldUseStoredConversionForPreview({
  isEditMode,
  hadStoredConversion,
  conversionSnapshot,
  targetCurrency,
  accountLedgerCurrency,
  effectiveSpaceCurrency,
}: {
  isEditMode: boolean;
  hadStoredConversion: boolean;
  conversionSnapshot: ConversionSnapshot | null;
  targetCurrency: string | null;
  accountLedgerCurrency: string | null;
  effectiveSpaceCurrency: string;
}): boolean {
  if (!conversionSnapshot) return false;

  if (
    targetCurrency != null &&
    (conversionSnapshot.targetCurrency == null ||
      conversionSnapshot.targetCurrency !== targetCurrency)
  ) {
    return false;
  }

  if (
    targetCurrency === effectiveSpaceCurrency &&
    accountLedgerCurrency != null &&
    accountLedgerCurrency !== effectiveSpaceCurrency
  ) {
    return false;
  }

  if (!isEditMode || !hadStoredConversion) return true;

  return true;
}

export function shouldPreviewConversionOnlyInEdit({
  isEditMode,
  hadStoredConversion,
  targetCurrency,
  effectiveSpaceCurrency,
}: {
  isEditMode: boolean;
  hadStoredConversion: boolean;
  targetCurrency: string | null;
  effectiveSpaceCurrency: string;
}): boolean {
  if (!isEditMode) return false;
  if (!hadStoredConversion) return true;

  return targetCurrency === effectiveSpaceCurrency;
}

/** When amount currency differs from the ledger target — API needs conversion metadata. */
export function transactionNeedsConversion({
  amountCurrency,
  targetCurrency,
}: {
  amountCurrency: string;
  targetCurrency: string | null;
}): boolean {
  if (targetCurrency == null || String(targetCurrency).trim() === "") return false;

  return amountCurrency !== targetCurrency;
}

/** Create flow only — blocks submit while the rate is still loading. */
export function createTransactionNeedsConversion({
  amountCurrency,
  targetCurrency,
  isEditMode,
}: {
  amountCurrency: string;
  targetCurrency: string | null;
  isEditMode: boolean;
}): boolean {
  if (isEditMode) return false;

  return transactionNeedsConversion({ amountCurrency, targetCurrency });
}

export function shouldShowAmountFxInEdit({
  isEditMode,
  conversionSnapshot,
  amountCurrency,
  targetCurrency,
}: {
  isEditMode: boolean;
  conversionSnapshot: ConversionSnapshot | null;
  amountCurrency: string;
  targetCurrency: string | null;
}): boolean {
  if (!isEditMode) return false;
  if (conversionSnapshot != null) return true;

  return targetCurrency != null && amountCurrency !== targetCurrency;
}
