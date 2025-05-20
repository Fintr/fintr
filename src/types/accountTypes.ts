export enum AccountCategory {
  CASH = "cash",
  SAVINGS = "savings",
  DEBIT = "debit",
  CREDIT_CARD = "credit_card",
  E_WALLET = "e_wallet",
  LOAN = "loan",
  INVESTMENT = "investment"
}

export const accountCategoryLabels: Record<AccountCategory, string> = {
  [AccountCategory.CASH]: "Cash",
  [AccountCategory.SAVINGS]: "Savings",
  [AccountCategory.DEBIT]: "Debit",
  [AccountCategory.CREDIT_CARD]: "Credit Card",
  [AccountCategory.E_WALLET]: "E-Wallet",
  [AccountCategory.LOAN]: "Loan",
  [AccountCategory.INVESTMENT]: "Investment"
};

export interface AccountCreateData {
  name: string;
  balance: number;
  accountCategory: AccountCategory;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  accountCategory: AccountCategory;
  createdAt: string;
  updatedAt: string;
} 
