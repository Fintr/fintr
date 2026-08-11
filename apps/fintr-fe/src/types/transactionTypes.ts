import { UpdateScopeEnum } from "@/constants/transactionConstants";
import type { TransactionTag } from "@/types/transactionTagTypes";

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
  /** ISO timestamp; used with `date` for newest-first list order (matches BE). */
  createdAt?: string;
  description: string;
  amount: number;
  /** ISO currency code for `amount` (from API; matches space when converted, else native e.g. USD). */
  amountCurrency?: string;
  /** Booked / native leg when different from space display (from API when present). */
  bookedAmount?: number;
  bookedAmountCurrency?: string;
  categoryName: string;
  subcategoryName?: string | null;
  categoryId?: string;
  subcategoryId?: string | null;
  fromAccountName: string;
  toAccountName: string;
  type: CombinedTransactionTypeEnum;
  inSeries: boolean;
  hasImage: boolean;
  hasLoanPayment?: boolean;
  calculated?: boolean;
  activitableId?: string;
  isLoanActivity?: boolean;
  loanType?: "borrowed" | "lent";
  loanId?: string;
  entityName?: string;
  tags?: TransactionTag[];
}

export interface IndexActivity {
  id: string;
  date: string;
  description: string;
  amount: number;
  amountCurrency?: string;
  bookedAmount?: number;
  bookedAmountCurrency?: string;
  categoryName: string;
  subcategoryName?: string | null;
  fromAccountName: string;
  toAccountName: string;
  type: ActivitiesTypeEnum;
  inSeries: boolean;
  hasImage: boolean;
  hasLoanPayment?: boolean;
  calculated?: boolean;
  /** Underlying record id (differs from activity row id for transfers). */
  activitableId?: string;
  isLoanActivity?: boolean;
  loanType?: "borrowed" | "lent";
  loanId?: string;
  entityName?: string;
  tags?: TransactionTag[];
}

export interface TransactionIndexInputType {
  spaceCode: string;
  categoryName?: string;
  categoryId?: string;
  subcategoryId?: string;
  categoryFilters?: string[];
  accountNames?: string[];
  startDate: string;
  endDate: string;
  minAmount: number | string;
  maxAmount: number | string;
  page: number;
  searchQuery?: string;
  tagIds?: string[];
  entryType?: string;
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
  categoryId?: string;
  subcategoryId?: string | null;
  subcategoryName?: string | null;
  accountName: string;
  /** Explicit form type sent to API: "income" or "expense" */
  transactionType: "income" | "expense";
  type: CombinedTransactionTypeEnum;
  scheduleType: ScheduleTypeEnum;
  repeatInterval: string;
  installmentPeriod: number;
  file: File | null;
  entityName?: string;
  tagIds?: string[];
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
  nextPage: number | null;
  totalPages: number | null;
  totalCount: number | null;
  totals: TransactionTotals | null;
}

export interface ActivitiesPage {
  activities: IndexActivity[];
  nextPage: number | null;
  totalPages: number | null;
  totalCount: number | null;
  totals: TransactionTotals | null;
}

export enum CombinedTransactionTypeEnum {
  EXPENSE = "expense",
  INCOME = "income",
  TRANSFER = "transfer",
  LOAN_DISBURSEMENT = "loan_disbursement",
  LOAN_PAYMENT = "loan_payment",
}

export enum ActivitiesTypeEnum {
  EXPENSE = "expense",
  INCOME = "income",
  TRANSFER = "transfer",
  LOAN_DISBURSEMENT = "loan_disbursement",
  LOAN_PAYMENT = "loan_payment",
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
