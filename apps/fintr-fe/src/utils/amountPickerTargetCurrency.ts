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

export function resolveAmountPickerTargetCurrency({
  amountCurrency,
  accountLedgerCurrency,
  editBookedCurrency,
  effectiveSpaceCurrency,
  isEditMode = false,
}: {
  amountCurrency: string;
  accountLedgerCurrency: string | null;
  editBookedCurrency: string | null;
  effectiveSpaceCurrency: string;
  isEditMode?: boolean;
}): string | null {
  if (isEditMode && amountCurrency !== effectiveSpaceCurrency) {
    return effectiveSpaceCurrency;
  }

  const accountCurrency = accountLedgerCurrency ?? editBookedCurrency;

  if (accountCurrency != null && amountCurrency !== accountCurrency) {
    return accountCurrency;
  }

  if (amountCurrency !== effectiveSpaceCurrency) {
    return effectiveSpaceCurrency;
  }

  return accountCurrency;
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
  if (!isEditMode || !hadStoredConversion) return true;

  if (
    targetCurrency === effectiveSpaceCurrency &&
    accountLedgerCurrency != null &&
    accountLedgerCurrency !== effectiveSpaceCurrency
  ) {
    return false;
  }

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
