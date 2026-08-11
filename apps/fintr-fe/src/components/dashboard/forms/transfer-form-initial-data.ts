import type { UpdateTransferType } from "@/services/transactions/transfers/mutation";
import type {
  CurrencyConversionType,
  TransferUpdateTransactionType,
} from "@/types/transactionTypes";
import type { ConversionSnapshot } from "./AmountWithRatePicker";

/** Stable identity for transfer edit seed data — ignores object reference churn. */
export function transferInitialDataSignature(
  data: UpdateTransferType | null | undefined,
): string | null {
  if (!data?.id) {
    return null;
  }

  const conv = data.currencyConversion;
  return JSON.stringify({
    id: data.id,
    amount: data.amount,
    transactionCost: data.transactionCost,
    fromAccountName: data.fromAccountName,
    toAccountName: data.toAccountName,
    description: data.description ?? "",
    date: data.date,
    scheduleType: data.scheduleType,
    repeatInterval: data.repeatInterval ?? "",
    hasCurrencyConversion: data.hasCurrencyConversion ?? false,
    originalCurrency: conv?.originalCurrency ?? null,
    convertedCurrency: conv?.convertedCurrency ?? null,
    exchangeRate: conv?.exchangeRate ?? null,
    exchangeRateSource: conv?.source ?? null,
  });
}

export function buildTransferInitialData(
  fullTransactionData: TransferUpdateTransactionType,
  transferConv: CurrencyConversionType | null,
): UpdateTransferType {
  return {
    id: fullTransactionData.id,
    amount: transferConv
      ? transferConv.originalAmount
      : fullTransactionData.amount,
    transactionCost: (fullTransactionData as { transactionCost?: number })
      .transactionCost || 0,
    fromAccountName:
      (fullTransactionData as { fromAccountName?: string }).fromAccountName ||
      "",
    toAccountName:
      (fullTransactionData as { toAccountName?: string }).toAccountName || "",
    description: fullTransactionData.description,
    date: fullTransactionData.date,
    scheduleType: fullTransactionData.scheduleType,
    repeatInterval: fullTransactionData.repeatInterval,
    file: fullTransactionData.file || undefined,
    updateScope: fullTransactionData.updateScope,
    hasCurrencyConversion:
      fullTransactionData.hasCurrencyConversion ??
      (fullTransactionData as { has_currency_conversion?: boolean })
        .has_currency_conversion,
    currencyConversion: transferConv ?? undefined,
  };
}

export function conversionSnapshotFromTransferInitialData(
  data: UpdateTransferType,
): ConversionSnapshot | null {
  const conv = data.currencyConversion;
  if (!conv) {
    return null;
  }

  const exchangeRate = Number(conv.exchangeRate);
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    return null;
  }

  return {
    originalCurrency: conv.originalCurrency,
    targetCurrency: conv.convertedCurrency,
    exchangeRate,
    exchangeRateSource: (conv.source || "manual") as
      | "auto"
      | "manual"
      | "recent",
  };
}

export function shouldIncludeTransferExchangeRate(
  fromAccountCurrency: string,
  toAccountCurrency: string,
  conversionSnapshot: ConversionSnapshot | null,
): boolean {
  return (
    fromAccountCurrency !== toAccountCurrency && conversionSnapshot != null
  );
}
