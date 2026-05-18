/**
 * Pure helpers for edit-mode account selects: show all accounts but only allow
 * options whose ledger currency matches the original transaction / transfer leg.
 */

/** Shown when an account tile is disabled because of edit-mode currency locking. */
export const ACCOUNT_EDIT_LOCK_DISABLED_HINT =
  "When editing, only accounts with the same currency as the original account can be selected.";

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

/** Lock currency for income/expense edit, or one leg of a transfer edit. */
export function editLockedAccountLedgerCurrency(
  isEditMode: boolean,
  initialAccountName: string | undefined,
  accountOptions: AccountOptionForEditLock[],
  spaceCurrency: string,
): string | undefined {
  if (!isEditMode || !initialAccountName) {
    return undefined;
  }
  const acc = accountOptions.find((a) => a.value === initialAccountName);
  return optionLedgerCurrencyForEditLock(
    acc ?? { value: initialAccountName },
    spaceCurrency,
  );
}

/**
 * Whether this account row should be non-selectable in edit mode.
 * Call sites still render every option; only this flag toggles Radix `disabled`.
 */
export function isAccountSelectOptionDisabledForEdit(
  isEditMode: boolean,
  lock: string | undefined,
  option: AccountOptionForEditLock,
  spaceCurrency: string,
): boolean {
  if (!isEditMode || lock === undefined || lock === "") {
    return false;
  }
  return optionLedgerCurrencyForEditLock(option, spaceCurrency) !== lock;
}
