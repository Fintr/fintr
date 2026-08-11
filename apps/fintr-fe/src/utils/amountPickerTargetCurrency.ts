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

export function conversionSnapshotMatchesAmountCurrency(
  snapshot: ConversionSnapshot | null,
  amountCurrency: string,
): boolean {
  if (!snapshot) return true;

  return snapshot.originalCurrency === amountCurrency;
}

export function shouldUseStoredConversionForPreview({
  isEditMode,
  hadStoredConversion,
  conversionSnapshot,
  amountCurrency,
  targetCurrency,
  accountLedgerCurrency,
  effectiveSpaceCurrency,
}: {
  isEditMode: boolean;
  hadStoredConversion: boolean;
  conversionSnapshot: ConversionSnapshot | null;
  amountCurrency: string;
  targetCurrency: string | null;
  accountLedgerCurrency: string | null;
  effectiveSpaceCurrency: string;
}): boolean {
  if (!conversionSnapshot) return false;

  if (!conversionSnapshotMatchesAmountCurrency(conversionSnapshot, amountCurrency)) {
    return false;
  }

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

/** Edit mode allows changing FX; rates must sync to the parent snapshot for submit. */
export function shouldPreviewConversionOnlyInEdit(_args: {
  isEditMode: boolean;
  hadStoredConversion: boolean;
  targetCurrency: string | null;
  effectiveSpaceCurrency: string;
}): boolean {
  return false;
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

/** Blocks submit while the rate is still loading (create and edit). */
export function createTransactionNeedsConversion({
  amountCurrency,
  targetCurrency,
}: {
  amountCurrency: string;
  targetCurrency: string | null;
  /** @deprecated Ignored — edit mode also requires a conversion snapshot when currencies differ. */
  isEditMode?: boolean;
}): boolean {
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
