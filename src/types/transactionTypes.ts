import { UpdateScopeEnum } from "@/constants/transactionConstants";

export interface IndexTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryName: string;
  fromAccountName: string;
  toAccountName: string;
  type: CombinedTransactionTypeEnum;
  inSeries: boolean;
}

export interface TransactionIndexInputType {
  spaceCode: string;
  categoryName: string;
  startDate: string;
  endDate: string;
  minAmount: number;
  maxAmount: number;
  page: number;
  searchQuery?: string;
};

export interface UpdateTransactionType {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryName: string;
  accountName: string;
  type: CombinedTransactionTypeEnum;
  scheduleType: ScheduleTypeEnum;
  repeatInterval: string;
  installmentPeriod: number;
  file: File | null;
  updateScope?: UpdateScopeEnum;
}

export interface TransferUpdateTransactionType extends UpdateTransactionType {
  fromAccountName: string;
  toAccountName: string;
  transactionCost: number
}


// Define the expected structure of the API response for infinite query
export interface TransactionsPage {
  transactions: IndexTransaction[];
  nextPage: number | null; // Page number for the next fetch, or null if last page
  totalPages: number | null;
  totalCount: number | null;
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
