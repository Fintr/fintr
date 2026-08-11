/**
 * ISO 4217 currency codes and names.
 * Country/flag mapping comes from currency-codes-country-codes-flags; search is client-side.
 */

import {
  getCurrencyByCode,
  getCurrencyCodes,
  getPrimaryCountryForCurrency,
} from "currency-codes-country-codes-flags";

/** Regional indicator A is U+1F1E6; A-Z map to flag letters. */
export function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  return countryCode
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");
}

/** Non-transactional / test ISO codes omitted from pickers. */
const EXCLUDED_CURRENCY_CODES = new Set([
  "XXX",
  "XTS",
  "XAU",
  "XAG",
  "XPD",
  "XPT",
  "XDR",
  "XSU",
  "XUA",
  "XBA",
  "XBB",
  "XBC",
  "XBD",
  "BTC",
]);

export function getCountryCodeForCurrency(currencyCode: string): string {
  const normalized = currencyCode.toUpperCase();
  const primary = getPrimaryCountryForCurrency(normalized);
  if (primary) return primary;
  return normalized.slice(0, 2);
}

/** Common currencies shown first in the currency selector (popular-first sort). */
export const POPULAR_CURRENCY_CODES = [
  "AUD",
  "CAD",
  "CNY",
  "EUR",
  "GBP",
  "INR",
  "JPY",
  "PHP",
  "USD",
  "SGD",
  "HKD",
  "NZD",
] as const;

export const CURRENCIES: { code: string; name: string }[] = getCurrencyCodes()
  .filter((code) => !EXCLUDED_CURRENCY_CODES.has(code))
  .map((code) => {
    const entry = getCurrencyByCode(code);
    return {
      code,
      name: entry?.currencyName ?? code,
    };
  })
  .sort((a, b) => a.code.localeCompare(b.code));

/** Set of valid ISO 4217 codes for validation (e.g. in forms). */
export const CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code));

export function isValidCurrencyCode(code: string): boolean {
  return CURRENCY_CODES.has(code.toUpperCase());
}
