"use client";

import { useId, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  Area,
  AreaChart,
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

const CHART_LINE_COLOR = "oklch(59.6% 0.145 163.225)";

const formatEndpointAmount = (amount: number, currency: string): string =>
  formatCurrency(amount, currency).replace(/[.,]00$/, "");

export const AccountBalanceChart = ({
  accountId,
  displayAmount,
  displayCurrency,
  displayAmountLoading = false,
  enabled = true,
}: AccountBalanceChartProps) => {
  const chartFillId = useId().replace(/:/g, "");
  const [chartRange, setChartRange] = useState<AccountChartRangeId>("all");
  const presetOptions = usePresetDateRangeOptions();

  const { startDate, endDate } = useMemo(
    () => getAccountChartDateRange(chartRange, new Date(), presetOptions),
    [chartRange, presetOptions],
  );

  const timelineQuery = useAccountBalanceTimeline({
    accountId,
    startDate,
    endDate,
    enabled: enabled && !!accountId,
  });

  const chartPoints = useMemo(
    () => buildBalanceChartSeries(timelineQuery.data?.points ?? []),
    [timelineQuery.data?.points],
  );

  const chartCurrency = timelineQuery.data?.currency ?? displayCurrency;
  const isChartLoading = enabled && timelineQuery.isLoading;
  const isChartError = timelineQuery.isError;

  const displayChartPoints = useMemo(() => {
    if (isChartLoading || isChartError) {
      return [];
    }

    if (chartPoints.length >= 2) {
      if (isFlatBalanceSeries(chartPoints)) {
        return buildFlatChartLine(chartPoints[0].balance, startDate, endDate);
      }

      return chartPoints;
    }

    return buildFlatChartLine(displayAmount, startDate, endDate);
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

  const periodStats = useMemo(() => {
    if (!canShowChart) {
      return null;
    }

    const firstBalance = displayChartPoints[0].balance;
    const lastBalance = displayChartPoints[displayChartPoints.length - 1].balance;
    const change = lastBalance - firstBalance;
    const percentChange =
      firstBalance !== 0 ? (change / firstBalance) * 100 : 0;

    return {
      change,
      percentChange,
      isPositive: change >= 0,
      isNeutral: change === 0,
    };
  }, [canShowChart, displayChartPoints]);

  const periodLabel = getAccountChartPeriodLabel(chartRange);

  return (
    <div className="space-y-4" aria-label="Account balance over time">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "border border-teal-500/20 dark:border-teal-400/25",
          "bg-gradient-to-b from-teal-500/[0.10] via-teal-500/[0.04] to-transparent",
          "dark:from-teal-400/[0.14] dark:via-teal-400/[0.05]",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
        )}
      >
        <div className="relative min-h-[180px] px-2 pt-2 pb-1">
          {isChartLoading ? (
            <div
              className="flex h-[180px] items-center justify-center text-muted-foreground"
              aria-busy="true"
            >
              <LoadingSpinner size="small" />
              <span className="ml-2 text-sm">Loading chart…</span>
            </div>
          ) : isChartError ? (
            <div
              className="flex h-[180px] items-center justify-center px-4 text-center text-sm text-muted-foreground"
              role="status"
            >
              Could not load balance chart.
            </div>
          ) : canShowChart ? (
            <div className="relative h-[180px]">
              <span
                className="absolute left-2 top-2 z-[2] text-[11px] font-semibold text-teal-700 dark:text-teal-300 tabular-nums"
              >
                {formatEndpointAmount(displayChartPoints[0].balance, chartCurrency)}
              </span>
              <span
                className="absolute right-2 top-2 z-[2] text-[11px] font-semibold text-teal-700 dark:text-teal-300 tabular-nums"
              >
                {formatEndpointAmount(
                  displayChartPoints[displayChartPoints.length - 1].balance,
                  chartCurrency,
                )}
              </span>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={displayChartPoints}
                  margin={{ top: 30, right: 10, left: 10, bottom: 6 }}
                >
                  <defs>
                    <linearGradient
                      id={chartFillId}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={CHART_LINE_COLOR}
                        stopOpacity={0.42}
                      />
                      <stop
                        offset="100%"
                        stopColor={CHART_LINE_COLOR}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    type="number"
                    dataKey="chartX"
                    domain={["dataMin", "dataMax"]}
                    scale="time"
                    hide
                    padding={{ left: 8, right: 8 }}
                  />
                  <YAxis hide domain={yDomain} />
                  <Tooltip
                    cursor={{
                      stroke: "oklch(59.6% 0.145 163.225 / 0.35)",
                      strokeWidth: 1,
                    }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) {
                        return null;
                      }

                      const point = payload[0]?.payload as NormalizedBalanceTimelinePoint;

                      return (
                        <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
                          <p className="text-xs font-semibold text-foreground">
                            {formatBalanceChartDateLabel(point.date)}
                          </p>
                          <p className="text-sm font-medium text-foreground tabular-nums">
                            {formatCurrency(point.balance, chartCurrency)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke={CHART_LINE_COLOR}
                    strokeWidth={2.5}
                    fill={`url(#${chartFillId})`}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: CHART_LINE_COLOR,
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
      </div>

      <div
        className="flex items-center justify-center gap-1"
        role="group"
        aria-label="Chart time range"
      >
        {ACCOUNT_CHART_RANGE_OPTIONS.map((option) => {
          const isSelected = chartRange === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setChartRange(option.id)}
              aria-pressed={isSelected}
              className={cn(
                "min-w-[2.5rem] rounded-full px-3 py-1.5 text-xs font-bold tracking-wide transition-colors",
                isSelected
                  ? "bg-teal-500/15 text-teal-700 ring-1 ring-teal-500/30 shadow-sm dark:bg-teal-400/15 dark:text-teal-300 dark:ring-teal-400/35"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="text-center">
        {displayAmountLoading ? (
          <span className="text-3xl font-bold text-muted-foreground md:text-4xl">
            …
          </span>
        ) : (
          <AnimatedCurrency
            amount={displayAmount}
            currency={displayCurrency}
            className="text-3xl font-bold tracking-tight text-foreground md:text-4xl"
          />
        )}

        {periodStats && !isChartLoading && !isChartError ? (
          <div
            className={cn(
              "mt-2 flex items-center justify-center gap-1 text-sm font-medium",
              periodStats.isNeutral
                ? "text-muted-foreground"
                : periodStats.isPositive
                  ? "text-teal-600 dark:text-teal-400"
                  : "text-red-700 dark:text-red-400",
            )}
          >
            {periodStats.isNeutral ? null : periodStats.isPositive ? (
              <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ArrowDownRight className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="tabular-nums">
              {periodStats.isNeutral
                ? formatCurrency(0, chartCurrency)
                : `${periodStats.isPositive ? "+" : ""}${formatCurrency(periodStats.change, chartCurrency)}`}
              {" "}
              ({formatBalancePercentChange(periodStats.percentChange)})
            </span>
            <span className="text-muted-foreground">{periodLabel}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
