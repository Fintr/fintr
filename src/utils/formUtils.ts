export const formDataWithFile = (data: any) => {
  const formData = new FormData();
      
  // Add all transaction data to FormData
  Object.entries(data).forEach(([key, value]) => {
    // Skip undefined or null values
    if (value === undefined || value === null) return;
    
    // Handle file separately
    if (key === 'file') {
      if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
      }
    } else {
      formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  });

  return formData;
};

export const isUploadableFile = (value: unknown): value is File | Blob => {
  if (typeof window === "undefined") {
    return false;
  }

  return value instanceof File || value instanceof Blob;
};

/**
 * Picks the amount field currency when prefilling the expense form (e.g. Add Receipt)
 * without currency conversion metadata. Prefer space default_transaction_currency when
 * the user has set it and it is an allowed code; otherwise use the selected account's
 * currency, then space currency.
 */
export function resolvePrefillAmountCurrency(params: {
  defaultTransactionCurrency: string | null | undefined;
  amountCurrencyCodes: readonly string[];
  accountName: string | undefined;
  accounts: ReadonlyArray<{ value: string; currency?: string | null }>;
  spaceCurrency: string;
}): string {
  const {
    defaultTransactionCurrency,
    amountCurrencyCodes,
    accountName,
    accounts,
    spaceCurrency,
  } = params;

  const defaultCode =
    defaultTransactionCurrency != null &&
    String(defaultTransactionCurrency).length === 3 &&
    amountCurrencyCodes.includes(String(defaultTransactionCurrency))
      ? String(defaultTransactionCurrency)
      : null;

  if (defaultCode) return defaultCode;

  const account = accounts.find((a) => a.value === accountName);
  return account?.currency ?? spaceCurrency;
}
