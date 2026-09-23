import type { Account } from "@/types/accountTypes";
import type { AccountOptionWithCurrency } from "@/types/generalTypes";

const optionBalanceMatchesAccount = (
  option: AccountOptionWithCurrency,
  account: Account,
): boolean => {
  if (String(option.balance ?? "") !== String(account.balance)) {
    return false;
  }

  if (
    account.balanceCurrency
    && option.currency
    && option.currency !== account.balanceCurrency
  ) {
    return false;
  }

  if (
    account.accountCategory
    && option.accountCategory
    && option.accountCategory !== account.accountCategory
  ) {
    return false;
  }

  return true;
};

/**
 * Picker options come from the dashboard shell snapshot. Account balances
 * live in the accounts cache. Overlay so the picker shows the same number
 * as the accounts list.
 */
export const overlayAccountOptionBalances = (
  options: AccountOptionWithCurrency[],
  accounts: Account[],
): AccountOptionWithCurrency[] => {
  if (options.length === 0 || accounts.length === 0) {
    return options;
  }

  const accountsByName = new Map(
    accounts.map((account) => [account.name, account]),
  );
  let changed = false;

  const next = options.map((option) => {
    const account = accountsByName.get(option.value);
    if (!account || optionBalanceMatchesAccount(option, account)) {
      return option;
    }

    changed = true;
    return {
      ...option,
      balance: account.balance,
      currency: account.balanceCurrency ?? option.currency,
      accountCategory: account.accountCategory ?? option.accountCategory,
    };
  });

  return changed ? next : options;
};
