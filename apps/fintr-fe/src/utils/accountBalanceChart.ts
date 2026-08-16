import { getCurrencySymbol } from "@/lib/utils";
import { getLocalIsoDateKey } from "@/utils/dateUtils";

import type { AccountBalanceTimelinePoint } from "@/services/transactions/accountBalanceTimeline";

export type NormalizedBalanceTimelinePoint = AccountBalanceTimelinePoint & {
  chartX: number;
};

/** Parse API date strings without timezone day-shift (YYYY-MM-DD or ISO datetime). */
export const formatBalanceChartDateLabel = (dateInput: string): string => {
  const dateKey = getLocalIsoDateKey(dateInput);
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return dateInput;
  }

  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const dayMidpointChartX = (dateKey: string): number => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
};

export const parseBalanceChartTimestamp = (
  occurredAt: string,
  fallbackDate: string,
): number => {
  const parsed = Date.parse(occurredAt);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  return dayMidpointChartX(getLocalIsoDateKey(fallbackDate));
};

export const normalizeBalanceTimelinePoints = (
  points: AccountBalanceTimelinePoint[],
): NormalizedBalanceTimelinePoint[] =>
  points.map((point) => {
    const date = getLocalIsoDateKey(point.date);

    return {
      ...point,
      date,
      occurredAt: date,
      chartX: dayMidpointChartX(date),
    };
  });

/** One end-of-day balance per calendar day — removes intra-day zigzag. */
export const aggregateBalancePointsToDaily = (
  points: NormalizedBalanceTimelinePoint[],
): NormalizedBalanceTimelinePoint[] => {
  const byDay = new Map<string, NormalizedBalanceTimelinePoint>();

  for (const point of points) {
    const dayKey = point.date;
    const existing = byDay.get(dayKey);

    if (!existing || point.chartX >= existing.chartX) {
      byDay.set(dayKey, {
        ...point,
        change: null,
        chartX: dayMidpointChartX(dayKey),
      });
    }
  }

  return [...byDay.values()].sort((left, right) => left.chartX - right.chartX);
};

/** Evenly sample points for a clean line on long histories (always keeps endpoints). */
export const downsampleBalanceChartPoints = (
  points: NormalizedBalanceTimelinePoint[],
  maxPoints: number = 48,
): NormalizedBalanceTimelinePoint[] => {
  if (points.length <= maxPoints) {
    return points;
  }

  const indices = [0];
  if (maxPoints > 2) {
    const stepSize = (points.length - 1) / (maxPoints - 1);
    for (let i = 1; i < maxPoints - 1; i += 1) {
      indices.push(Math.round(i * stepSize));
    }
  }
  indices.push(points.length - 1);

  return [...new Set(indices)]
    .sort((left, right) => left - right)
    .map((index) => points[index]);
};

export const buildBalanceChartSeries = (
  points: AccountBalanceTimelinePoint[],
): NormalizedBalanceTimelinePoint[] => {
  const normalized = normalizeBalanceTimelinePoints(points);

  if (normalized.length < 2) {
    return normalized;
  }

  const daily = aggregateBalancePointsToDaily(normalized);

  if (daily.length < 2) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];

    return downsampleBalanceChartPoints([
      { ...first, change: null },
      {
        ...last,
        change: null,
        chartX: last.chartX + 1,
      },
    ]);
  }

  return downsampleBalanceChartPoints(daily);
};

export const isFlatBalanceSeries = (
  points: NormalizedBalanceTimelinePoint[],
): boolean => {
  if (points.length === 0) {
    return true;
  }

  const firstBalance = points[0].balance;
  return points.every((point) => point.balance === firstBalance);
};

export const extendBalanceChartToRange = (
  points: NormalizedBalanceTimelinePoint[],
  startDate: string,
  endDate: string,
): NormalizedBalanceTimelinePoint[] => {
  if (points.length === 0) {
    return points;
  }

  const startKey = getLocalIsoDateKey(startDate);
  const endKey = getLocalIsoDateKey(endDate);
  const first = points[0];
  const last = points[points.length - 1];
  const next = [...points];

  if (first.date > startKey) {
    next.unshift({
      ...first,
      date: startKey,
      occurredAt: startKey,
      change: null,
      chartX: dayMidpointChartX(startKey),
    });
  }

  if (last.date < endKey) {
    next.push({
      ...last,
      date: endKey,
      occurredAt: endKey,
      change: null,
      chartX: dayMidpointChartX(endKey),
    });
  }

  return next;
};

export const buildFlatChartLine = (
  balance: number,
  startDate: string,
  endDate: string,
): NormalizedBalanceTimelinePoint[] => {
  const startKey = getLocalIsoDateKey(startDate);
  const endKey = getLocalIsoDateKey(endDate);

  return [
    {
      date: startKey,
      occurredAt: startDate,
      balance,
      change: null,
      chartX: dayMidpointChartX(startKey),
    },
    {
      date: endKey,
      occurredAt: endDate,
      balance,
      change: null,
      chartX: dayMidpointChartX(endKey),
    },
  ];
};

export const balanceChartYDomain = (
  points: NormalizedBalanceTimelinePoint[],
): [number, number] => {
  if (points.length === 0) {
    return [0, 1];
  }

  const balances = points.map((point) => point.balance);
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const span = max - min;
  const padding = span > 0 ? span * 0.12 : Math.max(Math.abs(max), 1) * 0.08;

  return [min - padding, max + padding];
};

export const formatBalancePercentChange = (percentChange: number): string => {
  if (percentChange > 0) {
    return `+${percentChange.toFixed(2)}%`;
  }

  if (percentChange < 0) {
    return `${percentChange.toFixed(2)}%`;
  }

  return "0.00%";
};

export const formatBalanceChartAxisAmount = (
  amount: number,
  currency: string,
): string => {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const symbol = getCurrencySymbol(currency);

  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const digits = millions >= 10 ? 0 : 1;
    return `${sign}${symbol}${millions.toFixed(digits)}M`;
  }

  if (abs >= 1_000) {
    const thousands = abs / 1_000;
    const digits = thousands >= 10 ? 0 : 1;
    return `${sign}${symbol}${thousands.toFixed(digits)}K`;
  }

  return `${sign}${symbol}${Math.round(abs)}`;
};

export const chartRangeTimestamps = (
  startDate: string,
  endDate: string,
): [number, number] => {
  const startX = dayMidpointChartX(getLocalIsoDateKey(startDate));
  const endX = dayMidpointChartX(getLocalIsoDateKey(endDate));

  if (endX <= startX) {
    return [startX, startX + 1];
  }

  return [startX, endX];
};
