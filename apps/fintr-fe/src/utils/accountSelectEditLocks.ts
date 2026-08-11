/**
 * Account select helpers for edit mode. Currency locking is disabled so users can
 * switch to accounts in other currencies (FX is handled by AmountWithRatePicker).
 */

/** Kept for call sites that still show a disabled hint; currently unused. */
export const ACCOUNT_EDIT_LOCK_DISABLED_HINT =
  "When editing, accounts in any currency can be selected; amounts convert with the exchange rate.";

export type AccountOptionForEditLock = {
  value: string;
  currency?: string;
};

export function optionLedgerCurrencyForEditLock(
  option: AccountOptionForEditLock,
  spaceCurrency: string,
): string {
  return option.currency ?? spaceCurrency;
}

/** Previously locked edit selects to the original ledger currency; now always unlocked. */
export function editLockedAccountLedgerCurrency(
  _isEditMode: boolean,
  _initialAccountName: string | undefined,
  _accountOptions: AccountOptionForEditLock[],
  _spaceCurrency: string,
): string | undefined {
  return undefined;
}

/**
 * Whether this account row should be non-selectable in edit mode.
 * Currency no longer disables options; FX is handled on submit.
 */
export function isAccountSelectOptionDisabledForEdit(
  _isEditMode: boolean,
  _lock: string | undefined,
  _option: AccountOptionForEditLock,
  _spaceCurrency: string,
): boolean {
  return false;
}
