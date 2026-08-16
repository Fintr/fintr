"use client";

import { useId, useMemo, useState } from "react";
import {
  CartesianGrid,
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AnimatedCurrency } from "@/components/ui/animated-currency";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAccountBalanceTimeline } from "@/hooks/async/useAccountBalanceTimeline";
import { usePresetDateRangeOptions } from "@/hooks/usePresetDateRangeOptions";
import { cn, formatCurrency } from "@/lib/utils";
import {
  ACCOUNT_CHART_RANGE_OPTIONS,
  type AccountChartRangeId,
  getAccountChartDateRange,
  getAccountChartPeriodLabel,
} from "@/utils/accountChartDateRanges";
import {
  balanceChartYDomain,
  buildBalanceChartSeries,
  buildFlatChartLine,
  chartRangeTimestamps,
  extendBalanceChartToRange,
  formatBalanceChartAxisAmount,
  formatBalanceChartDateLabel,
  formatBalancePercentChange,
  isFlatBalanceSeries,
  type NormalizedBalanceTimelinePoint,
} from "@/utils/accountBalanceChart";

type AccountBalanceChartProps = {
  accountId: string;
  displayAmount: number;
  displayCurrency: string;
  displayAmountLoading?: boolean;
  enabled?: boolean;
};

const UP_COLOR = "oklch(0.72 0.14 163)";
const DOWN_COLOR = "oklch(0.68 0.18 25)";
const NEUTRAL_COLOR = "oklch(0.72 0.02 264)";

export const AccountBalanceChart = ({
  accountId,
  displayAmount,
  displayCurrency,
  displayAmountLoading = false,
  enabled = true,
}: AccountBalanceChartProps) => {
  const chartFillId = useId().replace(/:/g, "");
  const [chartRange, setChartRange] = useState<AccountChartRangeId>("all");
  const [scrubbedPoint, setScrubbedPoint] =
    useState<NormalizedBalanceTimelinePoint | null>(null);
  const presetOptions = usePresetDateRangeOptions();
  const rangeReady =
    chartRange !== "all" || presetOptions.isAllTimeAnchorReady;

  const { startDate, endDate } = useMemo(
    () => getAccountChartDateRange(chartRange, new Date(), presetOptions),
    [chartRange, presetOptions],
  );

  const xDomain = useMemo(
    () => chartRangeTimestamps(startDate, endDate),
    [endDate, startDate],
  );

  const formatAxisTick = (timestamp: number): string => {
    const date = new Date(timestamp);
    const startYear = new Date(xDomain[0]).getFullYear();
    const endYear = new Date(xDomain[1]).getFullYear();

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(startYear !== endYear ? { year: "numeric" } : {}),
    });
  };

  const timelineQuery = useAccountBalanceTimeline({
    accountId,
    startDate,
    endDate,
    enabled: enabled && !!accountId && rangeReady,
  });

  const chartPoints = useMemo(
    () => buildBalanceChartSeries(timelineQuery.data?.points ?? []),
    [timelineQuery.data?.points],
  );

  const chartCurrency = timelineQuery.data?.currency ?? displayCurrency;
  const isChartLoading =
    enabled && (!rangeReady || timelineQuery.isLoading);
  const isChartError = timelineQuery.isError;

  const displayChartPoints = useMemo(() => {
    if (isChartLoading || isChartError) {
      return [];
    }

    let series = chartPoints;

    if (series.length >= 2) {
      if (isFlatBalanceSeries(series)) {
        series = buildFlatChartLine(series[0].balance, startDate, endDate);
      }
    } else if (series.length === 1) {
      series = buildFlatChartLine(series[0].balance, startDate, endDate);
    } else {
      series = buildFlatChartLine(displayAmount, startDate, endDate);
    }

    return extendBalanceChartToRange(series, startDate, endDate);
  }, [
    chartPoints,
    displayAmount,
    endDate,
    isChartError,
    isChartLoading,
    startDate,
  ]);

  const yDomain = useMemo(
    () => balanceChartYDomain(displayChartPoints),
    [displayChartPoints],
  );

  const canShowChart = displayChartPoints.length >= 2;
  const openingBalance = displayChartPoints[0]?.balance;
  const latestPoint = displayChartPoints[displayChartPoints.length - 1];
  const activePoint = scrubbedPoint ?? latestPoint;

  const periodStats = useMemo(() => {
    if (!canShowChart || openingBalance == null || activePoint == null) {
      return null;
    }

    const change = activePoint.balance - openingBalance;
    const percentChange =
      openingBalance !== 0 ? (change / openingBalance) * 100 : 0;

    return {
      change,
      percentChange,
      isPositive: change > 0,
      isNeutral: change === 0,
    };
  }, [activePoint, canShowChart, openingBalance]);

  const periodTrend = latestPoint != null && openingBalance != null
    ? latestPoint.balance - openingBalance
    : 0;
  const lineColor =
    periodTrend === 0
      ? NEUTRAL_COLOR
      : periodTrend > 0
        ? UP_COLOR
        : DOWN_COLOR;

  const heroAmount = activePoint?.balance ?? displayAmount;
  const periodLabel = getAccountChartPeriodLabel(chartRange);
  const isScrubbing = scrubbedPoint != null;

  return (
    <div className="space-y-3" aria-label="Account balance over time">
      <div className="px-1">
        {displayAmountLoading && !isScrubbing ? (
          <span className="text-4xl font-semibold tracking-tight text-muted-foreground md:text-5xl">
            …
          </span>
        ) : (
          <AnimatedCurrency
            amount={heroAmount}
            currency={chartCurrency}
            className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl"
          />
        )}

        {periodStats && !isChartLoading && !isChartError ? (
          <div
            className={cn(
              "mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm font-medium",
              periodStats.isNeutral
                ? "text-muted-foreground"
                : periodStats.isPositive
                  ? "text-teal-600 dark:text-teal-500"
                  : "text-red-800 dark:text-red-400",
            )}
          >
            <span className="tabular-nums">
              {periodStats.isNeutral
                ? formatCurrency(0, chartCurrency)
                : `${periodStats.isPositive ? "+" : ""}${formatCurrency(periodStats.change, chartCurrency)}`}
              {openingBalance != null && openingBalance > 0
                ? ` (${formatBalancePercentChange(periodStats.percentChange)})`
                : ""}
            </span>
            <span className="font-normal text-muted-foreground">
              {isScrubbing
                ? formatBalanceChartDateLabel(scrubbedPoint.date)
                : periodLabel}
            </span>
          </div>
        ) : null}
      </div>

      <div className="relative min-h-[220px]">
        {isChartLoading ? (
          <div
            className="flex h-[220px] items-center justify-center text-muted-foreground"
            aria-busy="true"
          >
            <LoadingSpinner size="small" />
            <span className="ml-2 text-sm">Loading chart…</span>
          </div>
        ) : isChartError ? (
          <div
            className="flex h-[220px] items-center justify-center px-4 text-center text-sm text-muted-foreground"
            role="status"
          >
            Could not load balance chart.
          </div>
        ) : canShowChart ? (
          <div className="relative h-[220px] text-muted-foreground">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={displayChartPoints}
                margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
                onMouseMove={(state) => {
                  const point = state?.activePayload?.[0]?.payload as
                    | NormalizedBalanceTimelinePoint
                    | undefined;

                  if (point) {
                    setScrubbedPoint(point);
                  }
                }}
                onMouseLeave={() => setScrubbedPoint(null)}
              >
                <defs>
                  <linearGradient
                    id={chartFillId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="currentColor"
                  strokeOpacity={0.18}
                  strokeDasharray="3 6"
                />
                <XAxis
                  type="number"
                  dataKey="chartX"
                  domain={xDomain}
                  scale="time"
                  allowDataOverflow
                  tickFormatter={formatAxisTick}
                  ticks={[xDomain[0], xDomain[1]]}
                  tick={{
                    fill: "currentColor",
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                  padding={{ left: 4, right: 4 }}
                />
                <YAxis
                  orientation="right"
                  domain={yDomain}
                  tickCount={4}
                  width={52}
                  tickFormatter={(value) =>
                    formatBalanceChartAxisAmount(Number(value), chartCurrency)
                  }
                  tick={{
                    fill: "currentColor",
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                {openingBalance != null ? (
                  <ReferenceLine
                    y={openingBalance}
                    stroke="currentColor"
                    strokeOpacity={0.35}
                    strokeDasharray="4 6"
                    strokeWidth={1}
                  />
                ) : null}
                <Tooltip
                  cursor={{
                    stroke: lineColor,
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                    strokeOpacity: 0.7,
                  }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) {
                      return null;
                    }

                    const point = payload[0]?.payload as NormalizedBalanceTimelinePoint;

                    return (
                      <div className="rounded-lg border border-border bg-card px-3 py-2 text-foreground shadow-md">
                        <p className="text-xs text-muted-foreground">
                          {formatBalanceChartDateLabel(point.date)}
                        </p>
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(point.balance, chartCurrency)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke={lineColor}
                  strokeWidth={2}
                  fill={`url(#${chartFillId})`}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={(props) => {
                    const { cx, cy, index } = props;
                    const isLast = index === displayChartPoints.length - 1;

                    if (!isLast || cx == null || cy == null) {
                      return <g key={`dot-${index}`} />;
                    }

                    return (
                      <circle
                        key={`dot-${index}`}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill={lineColor}
                        stroke="var(--background)"
                        strokeWidth={2}
                      />
                    );
                  }}
                  activeDot={{
                    r: 5,
                    fill: lineColor,
                    stroke: "var(--background)",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>

      <div
        className="flex items-center justify-between rounded-full bg-muted/40 p-1 dark:bg-input/20"
        role="group"
        aria-label="Chart time range"
      >
        {ACCOUNT_CHART_RANGE_OPTIONS.map((option) => {
          const isSelected = chartRange === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setChartRange(option.id);
                setScrubbedPoint(null);
              }}
              aria-pressed={isSelected}
              className={cn(
                "min-w-0 flex-1 rounded-full px-2 py-1.5 text-[11px] font-semibold tracking-wide transition-colors",
                isSelected
                  ? "bg-background text-foreground shadow-sm dark:bg-muted"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
