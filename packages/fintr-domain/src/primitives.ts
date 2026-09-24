export const SCHEDULE_TYPES = ["one_time", "repeat", "installment"] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export const TRANSFER_SCHEDULE_TYPES = ["one_time", "repeat"] as const;
export type TransferScheduleType = (typeof TRANSFER_SCHEDULE_TYPES)[number];

export const TRANSACTION_TYPES = ["income", "expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const REPEAT_INTERVALS = [
  "every_day",
  "every_week",
  "every_2_weeks",
  "every_month",
  "every_2_months",
  "every_3_months",
  "every_6_months",
  "every_year",
] as const;
export type RepeatInterval = (typeof REPEAT_INTERVALS)[number];

export const EXCHANGE_RATE_SOURCES = ["auto", "manual", "recent"] as const;
export type ExchangeRateSource = (typeof EXCHANGE_RATE_SOURCES)[number];

export const DELETE_SCOPES = [
  "this_only",
  "this_and_future",
  "all_in_series",
] as const;
export type DeleteScope = (typeof DELETE_SCOPES)[number];

export const UPDATE_SCOPES = [
  "this_only",
  "this_and_future",
  "all_in_series",
] as const;
export type UpdateScope = (typeof UPDATE_SCOPES)[number];
