import { UpdateScopeEnum } from "@/constants/transactionConstants";

/** Currency conversion details when a transaction used a different currency. */
export interface CurrencyConversionType {
  id?: string;
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  convertedCurrency: string;
  exchangeRate: number;
  source: string;
  rateTimestamp?: string;
  note?: string | null;
}

export interface IndexTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  /** ISO currency code for `amount` (from API; matches space when converted, else native e.g. USD). */
  amountCurrency?: string;
  /** Booked / native leg when different from space display (from API when present). */
  bookedAmount?: number;
  bookedAmountCurrency?: string;
  categoryName: string;
  fromAccountName: string;
  toAccountName: string;
  type: CombinedTransactionTypeEnum;
  inSeries: boolean;
  hasImage: boolean;
  hasLoanPayment?: boolean;
  calculated?: boolean;
}

export interface TransactionIndexInputType {
  spaceCode: string;
  categoryName: string;
  startDate: string;
  endDate: string;
  minAmount: number | string;
  maxAmount: number | string;
  page: number;
  searchQuery?: string;
};

export interface UpdateTransactionType {
  id: string;
  date: string;
  description: string;
  amount: number;
  /** Booked transaction currency (ISO), aligned with +amount+ from GET /transactions/:id. */
  amountCurrency?: string;
  /** Space-normalized display from API when needed for summaries. */
  amountInSpaceCurrency?: { amount: number; currency: string };
  categoryName: string;
  accountName: string;
  /** Explicit form type sent to API: "income" or "expense" */
  transactionType: "income" | "expense";
  type: CombinedTransactionTypeEnum;
  scheduleType: ScheduleTypeEnum;
  repeatInterval: string;
  installmentPeriod: number;
  file: File | null;
  updateScope?: UpdateScopeEnum;
  hasCurrencyConversion?: boolean;
  currencyConversion?: CurrencyConversionType;
}

export interface TransferUpdateTransactionType extends UpdateTransactionType {
  fromAccountName: string;
  toAccountName: string;
  transactionCost: number;
  hasCurrencyConversion?: boolean;
  currencyConversion?: CurrencyConversionType;
}


// Totals by transaction type
export interface TransactionTotals {
  income: number;
  expense: number;
  transfer: number;
}

// Define the expected structure of the API response for infinite query
export interface TransactionsPage {
  transactions: IndexTransaction[];
  nextPage: number | null; // Page number for the next fetch, or null if last page
  totalPages: number | null;
  totalCount: number | null;
  totals: TransactionTotals | null;
  // Add other pagination info if available (e.g., totalPages, totalCount)
}

export enum CombinedTransactionTypeEnum {
  EXPENSE = "expense",
  INCOME = "income",
  TRANSFER = "transfer"
}

export enum ScheduleTypeEnum {
  ONE_TIME = "one_time",
  REPEAT = "repeat",
  INSTALLMENT = "installment"
}

export enum RepeatIntervalEnum {
  EVERY_DAY = "every_day",
  EVERY_WEEK = "every_week",
  EVERY_2_WEEKS = "every_2_weeks",
  EVERY_MONTH = "every_month",
  EVERY_2_MONTHS = "every_2_months",
  EVERY_3_MONTHS = "every_3_months",
  EVERY_6_MONTHS = "every_6_months",
  EVERY_YEAR = "every_year"
}
