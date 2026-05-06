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
  accountCategory: string; // Changed to string since backend provides { label, value } format
}

export interface Account {
  id: string;
  name: string;
  balance: string; // Backend returns balance as string
  balanceCurrency: string;
  accountCategory: string; // Added accountCategory field from backend
  createdAt?: string;
  updatedAt?: string;
} 
