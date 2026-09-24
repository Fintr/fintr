// Transaction schedule constants
export const REPEAT_INTERVALS = [
  { label: "Every day", value: "every_day" },
  { label: "Every week", value: "every_week" },
  { label: "Every 2 weeks", value: "every_2_weeks" },
  { label: "Every month", value: "every_month" },
  { label: "Every 2 months", value: "every_2_months" },
  { label: "Every 3 months", value: "every_3_months" },
  { label: "Every 6 months", value: "every_6_months" },
  { label: "Every year", value: "every_year" },
];

// Schedule Type Enum (mirroring the types from transactionTypes.ts)
export enum ScheduleTypeEnum {
  ONE_TIME = "one_time",
  REPEAT = "repeat",
  INSTALLMENT = "installment"
}

export const BASIC_SCHEDULE_TYPE_OPTIONS = [
  { label: "One-Time", value: ScheduleTypeEnum.ONE_TIME },
  { label: "Recurring", value: ScheduleTypeEnum.REPEAT },
] as const;

export const EXPENSE_SCHEDULE_TYPE_OPTIONS = [
  ...BASIC_SCHEDULE_TYPE_OPTIONS,
  { label: "Installment", value: ScheduleTypeEnum.INSTALLMENT },
] as const;

// Transaction types (mirroring the types from transactionTypes.ts)
export enum TransactionTypeEnum {
  EXPENSE = "expense",
  INCOME = "income"
}

export enum UpdateScopeEnum {
  THIS_ONLY = "this_only",
  THIS_AND_FUTURE = "this_and_future",
  ALL_IN_SERIES = "all_in_series"
}

export enum DeleteScopeEnum {
  THIS_ONLY = "this_only",
  THIS_AND_FUTURE = "this_and_future",
  ALL_IN_SERIES = "all_in_series"
} 
