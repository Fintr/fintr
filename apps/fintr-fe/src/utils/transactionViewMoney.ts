import type {
  CurrencyConversionType,
  IndexTransaction,
} from "@/types/transactionTypes";

type TransactionViewMoneyFields = Pick<
  IndexTransaction,
  | "amount"
  | "amountCurrency"
  | "bookedAmount"
  | "bookedAmountCurrency"
  | "currencyConversion"
>;

export type TransactionViewMoney = {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number | null;
  convertedCurrency: string | null;
  exchangeRate: number | null;
  source: string | null;
  hasConversion: boolean;
};

const sameCurrency = (left?: string | null, right?: string | null): boolean =>
  Boolean(left?.trim()) &&
  Boolean(right?.trim()) &&
  left!.trim().toUpperCase() === right!.trim().toUpperCase();

const nearlyEqualMoney = (left: number, right: number): boolean => {
  if (left === right) {
    return true;
  }

  const scale = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.abs(left - right) < 0.05 || Math.abs(left - right) / scale < 0.002;
};

export function conversionHasFx(
  conversion: CurrencyConversionType | undefined | null,
): conversion is CurrencyConversionType {
  if (!conversion) {
    return false;
  }

  return !sameCurrency(
    conversion.originalCurrency,
    conversion.convertedCurrency,
  );
}

/**
 * Fixes FX rows where the original leg was stored as the converted magnitude
 * (e.g. GBP 20,000 at 100 PHP/GBP instead of GBP 200 → PHP 20,000).
 */
export function reconcileFxConversion(
  conversion: CurrencyConversionType,
  booked?: { amount?: number | null; currency?: string | null },
): CurrencyConversionType {
  const rate = Number(conversion.exchangeRate);
  let originalAmount = Number(conversion.originalAmount);
  let convertedAmount = Number(conversion.convertedAmount);
  const originalCurrency = conversion.originalCurrency;
  const convertedCurrency = conversion.convertedCurrency;

  const bookedAmount =
    booked?.amount != null ? Math.abs(Number(booked.amount)) : null;
  const bookedCurrency = booked?.currency?.trim() || null;

  let trustedBookedOriginal = false;

  if (
    bookedAmount != null
    && Number.isFinite(bookedAmount)
    && bookedCurrency
    && sameCurrency(bookedCurrency, originalCurrency)
    && !sameCurrency(bookedCurrency, convertedCurrency)
  ) {
    originalAmount = bookedAmount;
    trustedBookedOriginal = true;
  }

  if (
    conversionHasFx(conversion)
    && rate > 0
    && Number.isFinite(rate)
    && Math.abs(rate - 1) > 0.001
    && Number.isFinite(originalAmount)
  ) {
    const expectedConverted = originalAmount * rate;

    if (
      trustedBookedOriginal
      && (
        !Number.isFinite(convertedAmount)
        || convertedAmount === 0
        || nearlyEqualMoney(convertedAmount, originalAmount)
      )
    ) {
      convertedAmount = expectedConverted;
    } else if (
      !trustedBookedOriginal
      && Number.isFinite(convertedAmount)
      && convertedAmount !== 0
      && nearlyEqualMoney(originalAmount, convertedAmount)
    ) {
      // Original leg stored as converted magnitude (e.g. GBP 20,000 at 100 PHP/GBP).
      originalAmount = convertedAmount / rate;
    } else if (
      !Number.isFinite(convertedAmount)
      || convertedAmount === 0
    ) {
      convertedAmount = expectedConverted;
    }
  }

  return {
    ...conversion,
    originalAmount,
    originalCurrency,
    convertedAmount,
    convertedCurrency,
    exchangeRate: Number.isFinite(rate) ? rate : conversion.exchangeRate,
  };
}

export function transactionViewMoney(
  transaction: TransactionViewMoneyFields,
  spaceCurrency: string,
): TransactionViewMoney {
  const conversion = transaction.currencyConversion;
  if (conversionHasFx(conversion)) {
    const reconciled = reconcileFxConversion(conversion, {
      amount: transaction.bookedAmount,
      currency: transaction.bookedAmountCurrency,
    });

    return {
      originalAmount: Number(reconciled.originalAmount),
      originalCurrency: reconciled.originalCurrency,
      convertedAmount: Number(reconciled.convertedAmount),
      convertedCurrency: reconciled.convertedCurrency,
      exchangeRate: Number(reconciled.exchangeRate),
      source: reconciled.source?.trim() || null,
      hasConversion: true,
    };
  }

  const spaceAmount = transaction.amount;
  const spaceCur = transaction.amountCurrency ?? spaceCurrency;
  const booked = transaction.bookedAmount;
  const bookedCur = transaction.bookedAmountCurrency?.trim();

  if (booked != null && bookedCur && !sameCurrency(bookedCur, spaceCur)) {
    const originalAbs = Math.abs(booked);
    const convertedAbs = Math.abs(spaceAmount);
    const rate =
      originalAbs > 0 && Number.isFinite(convertedAbs)
        ? convertedAbs / originalAbs
        : null;

    return {
      originalAmount: originalAbs,
      originalCurrency: bookedCur,
      convertedAmount: spaceAmount,
      convertedCurrency: spaceCur,
      exchangeRate: rate,
      source: null,
      hasConversion: true,
    };
  }

  return {
    originalAmount: spaceAmount,
    originalCurrency: spaceCur,
    convertedAmount: null,
    convertedCurrency: null,
    exchangeRate: null,
    source: null,
    hasConversion: false,
  };
}

export function parseCurrencyConversion(
  payload: Record<string, unknown>,
): CurrencyConversionType | undefined {
  const raw = (payload.currencyConversion ?? payload.currency_conversion) as
    | Record<string, unknown>
    | undefined;

  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const originalCurrency = String(
    raw.originalCurrency ?? raw.original_currency ?? "",
  ).trim();
  const convertedCurrency = String(
    raw.convertedCurrency ?? raw.converted_currency ?? "",
  ).trim();
  const originalAmount = Number(raw.originalAmount ?? raw.original_amount);
  const convertedAmount = Number(raw.convertedAmount ?? raw.converted_amount);
  const exchangeRate = Number(raw.exchangeRate ?? raw.exchange_rate);

  if (!originalCurrency || !convertedCurrency) {
    return undefined;
  }

  if (!Number.isFinite(originalAmount) || !Number.isFinite(convertedAmount)) {
    return undefined;
  }

  return reconcileFxConversion({
    id: raw.id != null ? String(raw.id) : undefined,
    originalAmount,
    originalCurrency,
    convertedAmount,
    convertedCurrency,
    exchangeRate: Number.isFinite(exchangeRate) ? exchangeRate : 0,
    source: String(raw.source ?? raw.exchangeRateSource ?? ""),
    rateTimestamp:
      (raw.rateTimestamp as string | undefined) ??
      (raw.rate_timestamp as string | undefined),
    note: (raw.note as string | null | undefined) ?? null,
  });
}

const payloadNumber = (value: unknown): number | undefined => {
  if (value == null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const payloadCurrency = (value: unknown): string =>
  value == null ? "" : String(value).trim();

/**
 * Maps GET /transactions/:id (and transfer detail) money onto the index-row
 * shape used by the view page: booked/original vs space-normalized amount.
 */
export function moneyFieldsFromDetailPayload(
  payload: Record<string, unknown>,
): Pick<
  IndexTransaction,
  | "amount"
  | "amountCurrency"
  | "bookedAmount"
  | "bookedAmountCurrency"
  | "currencyConversion"
> {
  const spaceAmount = (payload.amountInSpaceCurrency ??
    payload.amount_in_space_currency) as
    | { amount?: unknown; currency?: unknown }
    | undefined;

  const conversion = parseCurrencyConversion(payload);
  const originalDisplayAmount = payloadNumber(
    payload.originalDisplayAmount ?? payload.original_display_amount,
  );
  const originalDisplayCurrency = payloadCurrency(
    payload.originalDisplayCurrency ?? payload.original_display_currency,
  );

  const amount = payloadNumber(spaceAmount?.amount ?? payload.amount) ?? 0;
  const amountCurrency =
    payloadCurrency(spaceAmount?.currency)
    || payloadCurrency(payload.amountCurrency ?? payload.amount_currency);

  let bookedAmount = payloadNumber(
    payload.bookedAmount ?? payload.booked_amount,
  );
  let bookedAmountCurrency = payloadCurrency(
    payload.bookedAmountCurrency ?? payload.booked_amount_currency,
  );

  if (originalDisplayCurrency && originalDisplayAmount != null) {
    bookedAmount = originalDisplayAmount;
    bookedAmountCurrency = originalDisplayCurrency;
  } else if (conversionHasFx(conversion)) {
    bookedAmount = conversion.originalAmount;
    bookedAmountCurrency = conversion.originalCurrency;
  } else if (bookedAmount == null) {
    bookedAmount = payloadNumber(payload.amount) ?? amount;
    bookedAmountCurrency =
      payloadCurrency(payload.amountCurrency ?? payload.amount_currency)
      || amountCurrency;
  }

  const currencyConversion = conversionHasFx(conversion)
    ? reconcileFxConversion(conversion, {
        amount: bookedAmount,
        currency: bookedAmountCurrency,
      })
    : conversion;

  return {
    amount,
    amountCurrency,
    bookedAmount,
    bookedAmountCurrency,
    currencyConversion,
  };
}
