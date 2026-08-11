import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  parseISO,
  startOfDay,
} from "date-fns";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";

const toIsoDate = (date: Date): string => format(date, "yyyy-MM-dd");

const parseIsoDate = (value: string): Date =>
  startOfDay(parseISO(value.slice(0, 10)));

const dateKey = (date: Date): string => toIsoDate(date);

const isWithinInclusiveRange = (
  date: Date,
  rangeStart: Date,
  rangeEnd: Date,
): boolean => {
  const key = dateKey(date);
  return key >= dateKey(rangeStart) && key <= dateKey(rangeEnd);
};

const advanceByRepeatInterval = (
  date: Date,
  repeatInterval: string,
): Date | null => {
  switch (repeatInterval) {
    case "every_day":
      return addDays(date, 1);
    case "every_week":
      return addWeeks(date, 1);
    case "every_2_weeks":
      return addWeeks(date, 2);
    case "every_month":
      return addMonths(date, 1);
    case "every_2_months":
      return addMonths(date, 2);
    case "every_3_months":
      return addMonths(date, 3);
    case "every_6_months":
      return addMonths(date, 6);
    case "every_year":
      return addYears(date, 1);
    default:
      return null;
  }
};

/**
 * Mirrors BE CreateRepeatTransactions windows + IceCube expansion for the
 * initial local-first series (past through today, future through +1 month).
 */
export const expandLocalSeriesOccurrenceDates = (params: {
  parentDate: string;
  scheduleType: ScheduleTypeEnum | string;
  repeatInterval?: string | null;
  installmentPeriod?: number | null;
  today?: string;
}): string[] => {
  const parentDate = parseIsoDate(params.parentDate);
  const today = parseIsoDate(params.today ?? toIsoDate(new Date()));
  const futureEnd = addMonths(today, 1);

  const rangeStart =
    dateKey(parentDate) < dateKey(today)
      ? addDays(parentDate, 1)
      : addDays(today, 1);
  const rangeEnd = futureEnd;

  if (dateKey(rangeStart) > dateKey(rangeEnd)) {
    return [];
  }

  if (params.scheduleType === ScheduleTypeEnum.ONE_TIME) {
    return [];
  }

  const dates: string[] = [];

  if (params.scheduleType === ScheduleTypeEnum.INSTALLMENT) {
    const period = Number(params.installmentPeriod);
    if (!Number.isFinite(period) || period <= 1) {
      return [];
    }

    // Parent is occurrence 1; generate the remaining period - 1 months.
    for (let index = 1; index < period; index += 1) {
      const cursor = addMonths(parentDate, index);
      if (
        dateKey(cursor) !== dateKey(parentDate) &&
        isWithinInclusiveRange(cursor, rangeStart, rangeEnd)
      ) {
        dates.push(toIsoDate(cursor));
      }
      if (dateKey(cursor) > dateKey(rangeEnd)) {
        break;
      }
    }

    return dates;
  }

  const interval = params.repeatInterval?.trim() ?? "";
  if (!interval) {
    return [];
  }

  let cursor = parentDate;
  // Safety cap for daily schedules across a ~1 month+past window.
  for (let step = 0; step < 400; step += 1) {
    const next = advanceByRepeatInterval(cursor, interval);
    if (!next) {
      break;
    }
    cursor = next;
    if (dateKey(cursor) > dateKey(rangeEnd)) {
      break;
    }
    if (
      dateKey(cursor) !== dateKey(parentDate) &&
      isWithinInclusiveRange(cursor, rangeStart, rangeEnd)
    ) {
      dates.push(toIsoDate(cursor));
    }
  }

  return dates;
};

export const localSeriesChildId = (
  clientMutationId: string,
  index: number,
): string => `local:${clientMutationId}:${index + 1}`;

export const isLocalSeriesChildId = (
  id: string,
  clientMutationId: string,
): boolean => id.startsWith(`local:${clientMutationId}:`);
