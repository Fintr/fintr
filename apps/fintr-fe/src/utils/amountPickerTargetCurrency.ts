import type { ConversionSnapshot } from "@/components/dashboard/forms/AmountWithRatePicker";
import {
  conversionHasFx,
  moneyFieldsFromDetailPayload,
} from "@/utils/transactionViewMoney";

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

const RATE_TOLERANCE = 1e-6;

const inferConvertedAmountFromInstallmentPlan = ({
  data,
  originalAmount,
  originalCurrency,
}: {
  data: Record<string, unknown>;
  originalAmount: number;
  originalCurrency: string;
}): number => {
  const installmentTotal = Number(
    data.installmentTotal
    ?? data.installment_total,
  );
  const periodMonths = Number(
    data.installmentPeriod
    ?? data.installment_period,
  );

  if (
    !Number.isFinite(installmentTotal)
    || installmentTotal <= 0
    || !Number.isFinite(periodMonths)
    || periodMonths <= 0
    || !Number.isFinite(originalAmount)
    || originalAmount <= 0
  ) {
    return NaN;
  }

  const ledgerPerPayment = installmentTotal / periodMonths;
  if (ledgerPerPayment / originalAmount <= 1.001) {
    return NaN;
  }

  const amountLeg = Number(data.amount);
  const amountLegCurrency = String(
    data.amountCurrency
    ?? data.amount_currency
    ?? "",
  ).trim();

  if (
    Number.isFinite(amountLeg)
    && amountLeg > 0
    && amountLegCurrency !== ""
    && amountLegCurrency !== originalCurrency
    && Math.abs(amountLeg - ledgerPerPayment) / ledgerPerPayment < 0.05
  ) {
    return amountLeg;
  }

  return ledgerPerPayment;
};

/** Build edit-form FX from the persisted backend `currency_conversion` payload. */
export function conversionSnapshotFromTransactionData(
  data: Record<string, unknown> | null | undefined,
): ConversionSnapshot | null {
  if (!data) return null;

  const rawConv = (
    data.currencyConversion
    ?? data.currency_conversion
  ) as Record<string, unknown> | undefined;
  const originalDisplayAmount = Number(
    data.originalDisplayAmount
    ?? data.original_display_amount,
  );
  const originalDisplayCurrency = String(
    data.originalDisplayCurrency
    ?? data.original_display_currency
    ?? "",
  ).trim();

  if (
    !rawConv
    && (originalDisplayCurrency === "" || !Number.isFinite(originalDisplayAmount))
  ) {
    return null;
  }

  const originalAmount = Number(
    rawConv?.originalAmount
    ?? rawConv?.original_amount
    ?? originalDisplayAmount,
  );
  const originalCurrency = String(
    originalDisplayCurrency
    || rawConv?.originalCurrency
    || rawConv?.original_currency
    || "",
  ).trim();
  if (!originalCurrency || !Number.isFinite(originalAmount)) {
    return null;
  }

  const convertedAmountFromPayload = Number(
    rawConv?.convertedAmount
    ?? rawConv?.converted_amount,
  );
  const amountLeg = Number(data.amount);
  const amountLegCurrency = String(
    data.amountCurrency
    ?? data.amount_currency
    ?? "",
  ).trim();
  const convertedAmount =
    Number.isFinite(convertedAmountFromPayload) && convertedAmountFromPayload > 0
      ? convertedAmountFromPayload
      : Number.isFinite(amountLeg)
        && amountLeg > 0
        && amountLegCurrency !== ""
        && amountLegCurrency !== originalCurrency
        ? amountLeg
        : inferConvertedAmountFromInstallmentPlan({
          data,
          originalAmount,
          originalCurrency,
        });
  const convertedCurrency = String(
    rawConv?.convertedCurrency
    ?? rawConv?.converted_currency
    ?? (
      Number.isFinite(convertedAmount)
      && amountLegCurrency !== ""
      && amountLegCurrency !== originalCurrency
        ? amountLegCurrency
        : ""
    )
    ?? data.bookedAmountCurrency
    ?? data.booked_amount_currency
    ?? "",
  ).trim();

  const exchangeRateFromPayload = Number(
    rawConv?.exchangeRate
    ?? rawConv?.exchange_rate,
  );
  const exchangeRate =
    Number.isFinite(exchangeRateFromPayload) && exchangeRateFromPayload > 0
      ? exchangeRateFromPayload
      : originalAmount > 0 && Number.isFinite(convertedAmount) && convertedAmount > 0
        ? convertedAmount / originalAmount
        : 1;

  const sourceRaw = String(rawConv?.source ?? "manual");
  const exchangeRateSource = (
    sourceRaw === "auto" || sourceRaw === "recent" ? sourceRaw : "manual"
  ) as ConversionSnapshot["exchangeRateSource"];

  return {
    originalCurrency,
    targetCurrency: convertedCurrency || originalCurrency,
    exchangeRate,
    exchangeRateSource,
  };
}

/** Edit forms always show the persisted transaction rate — never today's market rate. */
export function storedConversionForEditForm({
  data,
  targetCurrency,
}: {
  data: Record<string, unknown> | null | undefined;
  targetCurrency: string | null;
}): ConversionSnapshot | null {
  if (!data) return null;

  const direct = conversionSnapshotFromTransactionData(data);
  if (direct) {
    return {
      ...direct,
      targetCurrency: targetCurrency ?? direct.targetCurrency,
    };
  }

  const money = moneyFieldsFromDetailPayload(data);
  if (!conversionHasFx(money.currencyConversion)) {
    return null;
  }

  const fromMoney = conversionSnapshotFromTransactionData({
    ...data,
    currencyConversion: money.currencyConversion,
    originalDisplayAmount: money.currencyConversion!.originalAmount,
    originalDisplayCurrency: money.currencyConversion!.originalCurrency,
    original_display_amount: money.currencyConversion!.originalAmount,
    original_display_currency: money.currencyConversion!.originalCurrency,
    bookedAmount: money.bookedAmount,
    bookedAmountCurrency: money.bookedAmountCurrency,
    booked_amount: money.bookedAmount,
    booked_amount_currency: money.bookedAmountCurrency,
  });

  if (!fromMoney) {
    return null;
  }

  return {
    ...fromMoney,
    targetCurrency:
      targetCurrency
      ?? fromMoney.targetCurrency
      ?? money.currencyConversion!.convertedCurrency,
  };
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

  // Edit with a previously assigned rate: always seed it. Target legs can
  // briefly mismatch while the account ledger resolves; dropping the seed
  // here lets AmountWithRatePicker auto-fetch today's market rate instead of
  // the installment/transaction rate the user already chose.
  if (isEditMode && hadStoredConversion) {
    return true;
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

export function withEditOriginalCurrency(
  codes: string[],
  originalCurrency?: string | null,
): string[] {
  const code = originalCurrency?.trim().toUpperCase() ?? "";
  if (code.length !== 3 || codes.includes(code)) {
    return codes;
  }

  return [code, ...codes];
}
