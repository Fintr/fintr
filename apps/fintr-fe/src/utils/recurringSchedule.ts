import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
} from "date-fns";

import { REPEAT_INTERVALS, ScheduleTypeEnum } from "@/constants/transactionConstants";
import type { IndexTransaction } from "@/types/transactionTypes";
import { computeUpcomingSeriesDates } from "@/services/transactions/schedule-occurrence-dates";
import { getLocalIsoDateKey } from "@/utils/dateUtils";
import {
  computeInstallmentCommitmentTotalCents,
  resolveInstallmentTotalCents,
} from "@fintr/domain";

export type RecurringSeriesSummary = {
  rootParentId: string;
  representative: IndexTransaction;
  scheduleType: string;
  repeatInterval: string | null;
  installmentPeriod?: number | null;
  installmentTotal?: number | null;
  title: string;
  amount: number;
  amountCurrency?: string;
  occurrences: IndexTransaction[];
  nextOccurrenceDate: string | null;
  lastOccurrenceDate: string | null;
  isActive: boolean;
};

export type LedgerDisplayItem =
  | { kind: "row"; row: IndexTransaction }
  | {
      kind: "collapsed";
      key: string;
      rootParentId: string;
      repeatInterval: string;
      rows: IndexTransaction[];
      representative: IndexTransaction;
      /** Earliest occurrence date in this group — used for list sort and day dividers. */
      anchorDate: string;
    };

const HIGH_FREQUENCY_INTERVALS = new Set([
  "every_day",
  "every_week",
]);

export const repeatIntervalLabel = (
  repeatInterval?: string | null,
): string => {
  const normalized = repeatInterval?.trim() ?? "";
  if (!normalized) {
    return "";
  }

  const match = REPEAT_INTERVALS.find((item) => item.value === normalized);
  return match?.label ?? normalized.replace(/_/g, " ");
};

export const isRecurringScheduleType = (
  scheduleType?: string | null,
): boolean =>
  scheduleType === ScheduleTypeEnum.REPEAT
  || scheduleType === ScheduleTypeEnum.INSTALLMENT
  || scheduleType === "repeat"
  || scheduleType === "installment";

export const isRecurringRow = (
  row: Pick<
    IndexTransaction,
    "inSeries" | "parentId" | "scheduleType"
  >,
): boolean =>
  Boolean(row.inSeries)
  || Boolean(row.parentId)
  || isRecurringScheduleType(row.scheduleType);

export const resolveRootParentId = (
  row: Pick<
    IndexTransaction,
    "id" | "parentId" | "scheduleType" | "rootParentId"
  >,
): string | null => {
  if (row.rootParentId?.trim()) {
    return row.rootParentId.trim();
  }

  if (row.parentId?.trim()) {
    return row.parentId.trim();
  }

  if (isRecurringScheduleType(row.scheduleType)) {
    return row.id;
  }

  return null;
};

const normalizeCurrencyCode = (code?: string | null): string =>
  code?.trim().toUpperCase() ?? "";

export const inferLedgerCurrency = (
  rows: Array<Pick<IndexTransaction, "amountCurrency">>,
): string | undefined => {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const currency = normalizeCurrencyCode(row.amountCurrency);
    if (!currency) {
      return;
    }

    counts.set(currency, (counts.get(currency) ?? 0) + 1);
  });

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
};

export const preferOccurrenceRowForDate = (
  rows: IndexTransaction[],
  spaceCurrency?: string | null,
): IndexTransaction => {
  if (rows.length === 1) {
    return rows[0]!;
  }

  const ledgerCurrency = normalizeCurrencyCode(
    spaceCurrency ?? inferLedgerCurrency(rows),
  );

  const score = (row: IndexTransaction): number => {
    const currency = normalizeCurrencyCode(row.amountCurrency);
    const amount = Number(row.amount) || 0;
    let points = 0;

    if (ledgerCurrency && currency === ledgerCurrency) {
      points += 8;
    }
    if (amount >= 0) {
      points += 4;
    }
    if (ledgerCurrency && currency && currency !== ledgerCurrency) {
      points -= 4;
    }

    return points;
  };

  return [...rows].sort((left, right) => {
    const delta = score(right) - score(left);
    if (delta !== 0) {
      return delta;
    }

    return left.id.localeCompare(right.id);
  })[0]!;
};

export const resolveInstallmentOccurrenceDisplay = (
  row: IndexTransaction | undefined,
  series: RecurringSeriesSummary,
  spaceCurrency: string,
): { amount: number; currency: string } => {
  if (!row) {
    return {
      amount: series.amount,
      currency: series.amountCurrency ?? spaceCurrency,
    };
  }

  const space = normalizeCurrencyCode(spaceCurrency);
  const currency = normalizeCurrencyCode(
    row.amountCurrency ?? series.amountCurrency ?? spaceCurrency,
  );
  const amount = Number(row.amount) || 0;

  if (space && currency !== space && amount < 0) {
    const fallback = series.occurrences.find((occurrence) => {
      const occurrenceCurrency = normalizeCurrencyCode(occurrence.amountCurrency);
      return occurrenceCurrency === space && Number(occurrence.amount) > 0;
    });

    return {
      amount: fallback?.amount ?? series.amount,
      currency: spaceCurrency,
    };
  }

  return {
    amount,
    currency: row.amountCurrency ?? series.amountCurrency ?? spaceCurrency,
  };
};

export const indexOccurrencesByDate = (
  rows: IndexTransaction[],
  spaceCurrency?: string | null,
): Map<string, IndexTransaction> => {
  const grouped = new Map<string, IndexTransaction[]>();

  rows.forEach((row) => {
    const dateKey = getLocalIsoDateKey(row.date);
    const list = grouped.get(dateKey) ?? [];
    list.push(row);
    grouped.set(dateKey, list);
  });

  const ledgerCurrency = spaceCurrency ?? inferLedgerCurrency(rows);
  const result = new Map<string, IndexTransaction>();

  grouped.forEach((dateRows, dateKey) => {
    result.set(dateKey, preferOccurrenceRowForDate(dateRows, ledgerCurrency));
  });

  return result;
};

export const resolveRowRepeatInterval = (
  row: Pick<IndexTransaction, "repeatInterval" | "scheduleType">,
): string | null => {
  const interval = row.repeatInterval?.trim();
  if (interval) {
    return interval;
  }

  if (row.scheduleType === ScheduleTypeEnum.INSTALLMENT) {
    return "every_month";
  }

  return null;
};

export const resolveSeriesRepeatInterval = (
  occurrences: IndexTransaction[],
  rootParentId: string,
): string | null => {
  const root = occurrences.find((row) => row.id === rootParentId);
  if (root) {
    const fromRoot = resolveRowRepeatInterval(root);
    if (fromRoot) {
      return fromRoot;
    }
  }

  for (const row of occurrences) {
    const interval = resolveRowRepeatInterval(row);
    if (interval) {
      return interval;
    }
  }

  return null;
};

export const resolveSeriesParentDate = (
  occurrences: IndexTransaction[],
  rootParentId: string,
): string | null => {
  const root = occurrences.find((row) => row.id === rootParentId);
  if (root?.date) {
    return getLocalIsoDateKey(root.date);
  }

  const sorted = [...occurrences].sort((left, right) =>
    left.date.localeCompare(right.date),
  );

  return sorted[0]?.date ? getLocalIsoDateKey(sorted[0].date) : null;
};

export type UpcomingSeriesDisplayItem = {
  date: string;
  row?: IndexTransaction;
  isProjected: boolean;
};

export const seriesHasRecordedOccurrenceThrough = (
  occurrences: IndexTransaction[],
  throughDate = getLocalIsoDateKey(new Date()),
): boolean =>
  occurrences.some(
    (row) => getLocalIsoDateKey(row.date) <= throughDate,
  );

export const countSeriesRecordedOccurrences = (
  occurrences: IndexTransaction[],
  throughDate = getLocalIsoDateKey(new Date()),
): number =>
  occurrences.filter(
    (row) => getLocalIsoDateKey(row.date) <= throughDate,
  ).length;

export const resolveSeriesInstallmentPeriod = (
  occurrences: IndexTransaction[],
  rootParentId: string,
): number | null => {
  const root = occurrences.find((row) => row.id === rootParentId);
  if (root?.installmentPeriod && root.installmentPeriod > 0) {
    return root.installmentPeriod;
  }

  for (const row of occurrences) {
    if (row.installmentPeriod && row.installmentPeriod > 0) {
      return row.installmentPeriod;
    }
  }

  return null;
};

export const buildUpcomingSeriesDisplayItems = (
  series: RecurringSeriesSummary,
  today = getLocalIsoDateKey(new Date()),
  count = 7,
): UpcomingSeriesDisplayItem[] => {
  const parentDate = resolveSeriesParentDate(
    series.occurrences,
    series.rootParentId,
  );
  const repeatInterval =
    series.repeatInterval
    ?? resolveSeriesRepeatInterval(series.occurrences, series.rootParentId);
  const installmentPeriod =
    series.installmentPeriod
    ?? resolveSeriesInstallmentPeriod(series.occurrences, series.rootParentId);
  const isInstallment =
    series.scheduleType === ScheduleTypeEnum.INSTALLMENT
    || series.scheduleType === "installment";
  const displayCount =
    isInstallment && installmentPeriod
      ? installmentPeriod
      : count;
  const exclusiveThroughDate = seriesHasRecordedOccurrenceThrough(
    series.occurrences,
    today,
  )
    ? today
    : undefined;

  const occurrencesByDate = indexOccurrencesByDate(series.occurrences);

  if (parentDate && (repeatInterval || isInstallment)) {
    const projectedDates = computeUpcomingSeriesDates({
      parentDate,
      repeatInterval: repeatInterval ?? "every_month",
      scheduleType: series.scheduleType,
      installmentPeriod,
      today,
      count: displayCount,
      exclusiveThroughDate,
    });

    return projectedDates.map((date) => ({
      date,
      row: occurrencesByDate.get(date),
      isProjected: !occurrencesByDate.has(date),
    }));
  }

  const todayDate = parseISO(today);
  return series.occurrences
    .filter((row) => parseRowDate(row.date) >= todayDate)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, count)
    .map((row) => ({
      date: getLocalIsoDateKey(row.date),
      row,
      isProjected: false,
    }));
};

export const shouldCollapseIntervalInLedger = (
  repeatInterval?: string | null,
): boolean => {
  const normalized = repeatInterval?.trim() ?? "";
  return HIGH_FREQUENCY_INTERVALS.has(normalized);
};

const parseRowDate = (date: string): Date =>
  startOfDay(parseISO(date.slice(0, 10)));

export const formatRelativeDueLabel = (
  date: string,
  today = getLocalIsoDateKey(new Date()),
): string => {
  const targetKey = getLocalIsoDateKey(date);
  const targetDate = parseISO(targetKey);
  const todayDate = parseISO(today);
  const diff = differenceInCalendarDays(targetDate, todayDate);

  if (diff === 0) {
    return "Today";
  }

  if (diff === 1) {
    return "Tomorrow";
  }

  if (diff > 1) {
    const dateLabel = format(
      targetDate,
      targetDate.getFullYear() === todayDate.getFullYear()
        ? "MMM d"
        : "MMM d, yyyy",
    );
    return `In ${diff} days (${dateLabel})`;
  }

  if (diff === -1) {
    return "Yesterday";
  }

  return format(targetDate, "MMM d, yyyy");
};

export const frequencySectionOrder = (repeatInterval?: string | null): number => {
  const order: Record<string, number> = {
    every_day: 0,
    every_week: 1,
    every_2_weeks: 2,
    every_month: 3,
    every_2_months: 4,
    every_3_months: 5,
    every_6_months: 6,
    every_year: 7,
    installment: 8,
  };

  const key = repeatInterval?.trim() ?? "every_month";
  return order[key] ?? 99;
};

export const frequencySectionLabel = (
  repeatInterval?: string | null,
  scheduleType?: string | null,
): string => {
  if (scheduleType === ScheduleTypeEnum.INSTALLMENT) {
    return "Installment";
  }

  const label = repeatIntervalLabel(repeatInterval);
  if (label) {
    return label;
  }

  return "Recurring";
};

export const buildRecurringSeriesSummaries = (
  rows: IndexTransaction[],
  today = getLocalIsoDateKey(new Date()),
): RecurringSeriesSummary[] => {
  const groups = new Map<string, IndexTransaction[]>();

  rows.forEach((row) => {
    if (!isRecurringRow(row)) {
      return;
    }

    const rootId = resolveRootParentId(row);
    if (!rootId) {
      return;
    }

    const bucket = groups.get(rootId) ?? [];
    bucket.push(row);
    groups.set(rootId, bucket);
  });

  const todayDate = parseISO(today);

  return [...groups.entries()].map(([rootParentId, occurrences]) => {
    const sorted = [...occurrences].sort((left, right) =>
      right.date.localeCompare(left.date),
    );
    const representative =
      sorted.find((row) => row.id === rootParentId)
      ?? sorted.find((row) => !row.parentId)
      ?? sorted[0]!;
    const repeatInterval = resolveSeriesRepeatInterval(sorted, rootParentId);
    const installmentPeriod = resolveSeriesInstallmentPeriod(sorted, rootParentId);
    const parentDate = resolveSeriesParentDate(sorted, rootParentId);
    const occurrenceCentsByDate = [...indexOccurrencesByDate(sorted).entries()]
      .reduce<Record<string, number>>(
        (amounts, [dateKey, row]) => {
          amounts[dateKey] = Math.round(row.amount * 100);
          return amounts;
        },
        {},
      );
    const storedTotal = sorted.find(
      (row) => row.installmentTotal != null && row.installmentTotal > 0,
    )?.installmentTotal;
    const root = sorted.find((row) => row.id === rootParentId);
    const defaultPerPaymentCents = root
      ? Math.round(root.amount * 100)
      : storedTotal != null && installmentPeriod
        ? Math.round((storedTotal * 100) / installmentPeriod)
        : Math.round(representative.amount * 100);
    const installmentTotalCents =
      installmentPeriod && parentDate
        ? computeInstallmentCommitmentTotalCents({
            parentDate,
            period: installmentPeriod,
            defaultPerPaymentCents,
            occurrenceCentsByDate,
          })
        : resolveInstallmentTotalCents({
            installmentTotalCents:
              representative.installmentTotal != null
                ? Math.round(representative.installmentTotal * 100)
                : null,
            perPaymentCents: Math.round(representative.amount * 100),
            period: installmentPeriod ?? 0,
            seriesAmountCents: sorted.reduce(
              (sum, row) => sum + Math.round(row.amount * 100),
              0,
            ),
          });
    const exclusiveThroughDate = seriesHasRecordedOccurrenceThrough(
      sorted,
      today,
    )
      ? today
      : undefined;
    const future = sorted
      .filter((row) => parseRowDate(row.date) > todayDate)
      .sort((left, right) => left.date.localeCompare(right.date));
    let nextOccurrenceDate = future[0]?.date ?? null;
    if (parentDate && (repeatInterval || installmentPeriod)) {
      const projected = computeUpcomingSeriesDates({
        parentDate,
        repeatInterval: repeatInterval ?? "every_month",
        scheduleType: representative.scheduleType ?? ScheduleTypeEnum.REPEAT,
        installmentPeriod,
        today,
        count: 1,
        exclusiveThroughDate,
      });
      if (projected[0]) {
        nextOccurrenceDate = projected[0];
      }
    }
    const lastOccurrenceDate = sorted[0]?.date ?? null;
    const upcomingWithinYear =
      Boolean(nextOccurrenceDate)
      && differenceInCalendarDays(
        parseRowDate(nextOccurrenceDate),
        todayDate,
      ) <= 365;

    return {
      rootParentId,
      representative,
      scheduleType: representative.scheduleType ?? ScheduleTypeEnum.REPEAT,
      repeatInterval,
      installmentPeriod,
      installmentTotal: installmentTotalCents / 100,
      title:
        representative.description?.trim()
        || representative.entityName?.trim()
        || representative.categoryName,
      amount: representative.amount,
      amountCurrency: representative.amountCurrency,
      occurrences: sorted,
      nextOccurrenceDate,
      lastOccurrenceDate,
      isActive: upcomingWithinYear || Boolean(nextOccurrenceDate),
    };
  });
};

export const partitionRecurringSeries = (
  summaries: RecurringSeriesSummary[],
  today = getLocalIsoDateKey(new Date()),
): {
  upcoming: RecurringSeriesSummary[];
  active: RecurringSeriesSummary[];
  inactive: RecurringSeriesSummary[];
} => {
  const todayDate = parseISO(today);
  const upcomingHorizon = addDays(todayDate, 7);

  const upcoming = summaries
    .filter((series) => {
      if (!series.nextOccurrenceDate) {
        return false;
      }

      const nextDate = parseRowDate(series.nextOccurrenceDate);
      return nextDate >= todayDate && nextDate <= upcomingHorizon;
    })
    .sort((left, right) =>
      (left.nextOccurrenceDate ?? "").localeCompare(
        right.nextOccurrenceDate ?? "",
      ),
    );

  const active = summaries
    .filter((series) => series.isActive)
    .sort((left, right) =>
      frequencySectionOrder(left.repeatInterval)
      - frequencySectionOrder(right.repeatInterval),
    );

  const inactive = summaries
    .filter((series) => !series.isActive)
    .sort((left, right) =>
      (right.lastOccurrenceDate ?? "").localeCompare(
        left.lastOccurrenceDate ?? "",
      ),
    );

  return { upcoming, active, inactive };
};

export const groupRecurringSeriesByFrequency = (
  summaries: RecurringSeriesSummary[],
): Array<{ key: string; label: string; items: RecurringSeriesSummary[] }> => {
  const buckets = new Map<string, RecurringSeriesSummary[]>();

  summaries.forEach((series) => {
    const key =
      series.scheduleType === ScheduleTypeEnum.INSTALLMENT
        ? "installment"
        : (series.repeatInterval ?? "every_month");
    const bucket = buckets.get(key) ?? [];
    bucket.push(series);
    buckets.set(key, bucket);
  });

  return [...buckets.entries()]
    .sort(
      ([leftKey], [rightKey]) =>
        frequencySectionOrder(leftKey) - frequencySectionOrder(rightKey),
    )
    .map(([key, items]) => ({
      key,
      label: frequencySectionLabel(
        key === "installment" ? null : key,
        key === "installment" ? ScheduleTypeEnum.INSTALLMENT : null,
      ),
      items: items.sort((left, right) =>
        left.title.localeCompare(right.title),
      ),
    }));
};

export const buildUpcomingCalendarDays = (
  summaries: RecurringSeriesSummary[],
  monthAnchor = getLocalIsoDateKey(new Date()),
): Array<{ date: string; count: number }> => {
  const anchor = parseISO(monthAnchor.slice(0, 10));
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const counts = new Map<string, number>();

  summaries.forEach((series) => {
    series.occurrences.forEach((row) => {
      const date = parseRowDate(row.date);
      if (date < monthStart || date > monthEnd) {
        return;
      }

      const key = getLocalIsoDateKey(row.date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }));
};

export const filterRowsToSeriesRepresentatives = (
  rows: IndexTransaction[],
): IndexTransaction[] => {
  const groups = new Map<string, IndexTransaction[]>();

  rows.forEach((row) => {
    if (!isRecurringRow(row)) {
      return;
    }

    const rootId = resolveRootParentId(row);
    if (!rootId) {
      return;
    }

    const bucket = groups.get(rootId) ?? [];
    bucket.push(row);
    groups.set(rootId, bucket);
  });

  return [...groups.values()].map((occurrences) => {
    const rootId = resolveRootParentId(occurrences[0]!);
    const representative =
      occurrences.find((row) => row.id === rootId)
      ?? occurrences.find((row) => !row.parentId)
      ?? [...occurrences].sort((left, right) =>
        left.date.localeCompare(right.date),
      )[0]!;

    return {
      ...representative,
      rootParentId: rootId,
      inSeries: true,
    };
  });
};

export const prepareLedgerDisplayItems = (
  rows: IndexTransaction[],
): LedgerDisplayItem[] => {
  const collapsedKeys = new Set<string>();
  const collapsedGroups = new Map<string, IndexTransaction[]>();
  const passthrough: IndexTransaction[] = [];

  rows.forEach((row) => {
    if (!isRecurringRow(row)) {
      passthrough.push(row);
      return;
    }

    const rootId = resolveRootParentId(row);
    const interval = resolveRowRepeatInterval(row);
    if (!rootId || !interval || !shouldCollapseIntervalInLedger(interval)) {
      passthrough.push(row);
      return;
    }

    const key = `${rootId}:${interval}`;
    collapsedKeys.add(key);
    const bucket = collapsedGroups.get(key) ?? [];
    bucket.push(row);
    collapsedGroups.set(key, bucket);
  });

  const items: LedgerDisplayItem[] = [];

  rows.forEach((row) => {
    const rootId = resolveRootParentId(row);
    const interval = resolveRowRepeatInterval(row);
    if (!rootId || !interval || !shouldCollapseIntervalInLedger(interval)) {
      if (passthrough.includes(row)) {
        items.push({ kind: "row", row });
      }
      return;
    }

    const key = `${rootId}:${interval}`;
    if (!collapsedGroups.has(key)) {
      return;
    }

    const groupRows = collapsedGroups.get(key)!;
    if (groupRows[0]?.id !== row.id) {
      return;
    }

    const representative =
      groupRows.find((entry) => entry.id === rootId)
      ?? groupRows.find((entry) => !entry.parentId)
      ?? groupRows[0]!;

    items.push({
      kind: "collapsed",
      key,
      rootParentId: rootId,
      repeatInterval: interval,
      rows: groupRows,
      representative,
      anchorDate: groupRows.reduce(
        (earliest, entry) =>
          entry.date.slice(0, 10) < earliest.slice(0, 10)
            ? entry.date
            : earliest,
        groupRows[0]!.date,
      ),
    });

    collapsedGroups.delete(key);
  });

  return sortLedgerDisplayItems(items);
};

export const getLedgerDisplayItemDate = (item: LedgerDisplayItem): string => {
  if (item.kind === "row") {
    return item.row.date.slice(0, 10);
  }

  return item.anchorDate.slice(0, 10);
};

export const sortLedgerDisplayItems = (
  items: LedgerDisplayItem[],
): LedgerDisplayItem[] =>
  [...items].sort((left, right) =>
    getLedgerDisplayItemDate(right).localeCompare(
      getLedgerDisplayItemDate(left),
    ),
  );

export const seriesOccurrenceCountLabel = (
  count: number,
  repeatInterval: string,
): string => {
  const intervalLabel = repeatIntervalLabel(repeatInterval);
  if (count <= 1) {
    return intervalLabel;
  }

  return `${intervalLabel} · ${count} in view`;
};
