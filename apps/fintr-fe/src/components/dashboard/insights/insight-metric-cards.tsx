"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SummaryStatTile,
  statTilePlaceholderClassName,
} from "@/components/dashboard/insights/summary-stat-tile";
import { InsightMetric } from "@/services/insights/types";
import { CalculationBreakdownContent } from "@/components/dashboard/insights/calculation-breakdown-content";
import { getMetricCalculation } from "@/components/dashboard/insights/insight-metric-calculations";
import { CircleHelp } from "lucide-react";
import {
  dashboardSectionInsetClassName,
  dashboardTabularAmountClassName,
} from "@/components/dashboard/insights/dashboard-insights-surface";

interface InsightMetricCardsProps {
  metrics: InsightMetric[];
  isLoading?: boolean;
  isBusiness?: boolean;
}

const PAIRED_METRIC_KEYS = ["savings_rate", "emergency_fund"] as const;
const FULL_WIDTH_METRIC_KEYS = ["expense_change"] as const;

const MetricTargetPill = ({ benchmark }: { benchmark: string }) => (
  <span className="inline-flex rounded-md border border-border/50 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
    Target {benchmark}
  </span>
);

const metricFooter = (metric: InsightMetric) => {
  if (metric.key === "expense_change") {
    return null;
  }

  return <MetricTargetPill benchmark={metric.benchmark} />;
};

const parsePercent = (value: string) =>
  parseFloat(value.replace("%", "").replace(/[^\d.-]/g, "")) || 0;

const parseMonths = (value: string) => {
  const match = value.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
};

const metricValueClassName = (metric: InsightMetric): string => {
  if (metric.key === "expense_change") {
    return metric.trend === "expense"
      ? "text-red-900 dark:text-red-400"
      : "text-teal-600 dark:text-teal-400";
  }

  if (metric.key === "savings_rate" || metric.key === "gross_margin") {
    const pct = parsePercent(metric.value);
    const ok = metric.key === "gross_margin" ? 15 : 10;
    const strong = metric.key === "gross_margin" ? 30 : 20;

    if (pct >= strong) {
      return "text-teal-600 dark:text-teal-400";
    }
    if (pct >= ok) {
      return "text-primary dark:text-primary-dark-mode";
    }
    return "text-red-900 dark:text-red-400";
  }

  if (metric.key === "emergency_fund") {
    const amount = parseMonths(metric.value);
    const isWeeks = metric.value.includes("week");
    const monthsEquivalent = isWeeks ? amount / 4.33 : amount;

    if (monthsEquivalent >= 6) {
      return "text-teal-600 dark:text-teal-400";
    }
    if (monthsEquivalent >= 3) {
      return "text-primary dark:text-primary-dark-mode";
    }
    return "text-red-900 dark:text-red-400";
  }

  return "text-primary dark:text-primary-dark-mode";
};

const CalculationPopover = ({
  metric,
  isBusiness,
}: {
  metric: InsightMetric;
  isBusiness: boolean;
}) => {
  const fallback = getMetricCalculation(metric.key, isBusiness);
  const calculation = metric.calculation;
  const title = fallback?.title ?? metric.label;

  if (!calculation && !fallback) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-muted hover:text-primary"
          aria-label={`How ${title} is calculated`}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 max-h-[min(70vh,420px)] overflow-y-auto"
      >
        <CalculationBreakdownContent
          title={title}
          calculation={calculation}
          fallbackLabeledFormula={fallback?.formula}
          fallbackNotes={fallback?.details}
        />
      </PopoverContent>
    </Popover>
  );
};

const MetricTile = ({
  metric,
  isBusiness,
  className,
}: {
  metric: InsightMetric;
  isBusiness: boolean;
  className?: string;
}) => (
  <SummaryStatTile
    variant="insight"
    className={cn("h-full", className)}
    label={metric.label}
    value={metric.value}
    valueClassName={cn(
      metric.key === "expense_change" ? "text-base" : "text-lg",
      metric.key === "expense_change" ? "break-words" : "truncate",
      dashboardTabularAmountClassName,
      metricValueClassName(metric),
    )}
    footer={metricFooter(metric)}
    action={
      <CalculationPopover metric={metric} isBusiness={isBusiness} />
    }
  />
);

const partitionMetrics = (metrics: InsightMetric[]) => {
  const metricByKey = new Map(metrics.map((metric) => [metric.key, metric]));

  const pairedMetrics = PAIRED_METRIC_KEYS.map((key) => metricByKey.get(key)).filter(
    (metric): metric is InsightMetric => metric != null,
  );

  const fullWidthMetrics = FULL_WIDTH_METRIC_KEYS.map((key) =>
    metricByKey.get(key),
  ).filter((metric): metric is InsightMetric => metric != null);

  const reservedKeys = new Set<string>([
    ...PAIRED_METRIC_KEYS,
    ...FULL_WIDTH_METRIC_KEYS,
  ]);

  const otherMetrics = metrics.filter((metric) => !reservedKeys.has(metric.key));

  return {
    pairedMetrics,
    fullWidthMetrics,
    otherMetrics,
  };
};

export const InsightMetricCards = ({
  metrics,
  isLoading = false,
  isBusiness = false,
}: InsightMetricCardsProps) => {
  if (!isLoading && !metrics.length) {
    return null;
  }

  const { pairedMetrics, fullWidthMetrics, otherMetrics } = partitionMetrics(
    metrics,
  );

  return (
    <section
      className="px-4"
      aria-labelledby="dashboard-key-metrics-heading"
    >
      <div className="mb-3 px-4 sm:px-0">
        <h2
          id="dashboard-key-metrics-heading"
          className="text-base font-semibold text-foreground"
        >
          Key metrics
        </h2>
      </div>

      <div
        className={cn(
          dashboardSectionInsetClassName,
          "divide-y divide-border/50",
        )}
      >
        {isLoading ? (
          <div className="grid grid-cols-2 divide-x divide-border/50">
            <div className={statTilePlaceholderClassName} />
            <div className={statTilePlaceholderClassName} />
          </div>
        ) : (
          <>
            {otherMetrics.map((metric) => (
              <MetricTile
                key={metric.key}
                metric={metric}
                isBusiness={isBusiness}
                className="border-0 bg-transparent shadow-none"
              />
            ))}

            {pairedMetrics.length > 0 ? (
              <div className="grid grid-cols-2 divide-x divide-border/50">
                {pairedMetrics.map((metric) => (
                  <MetricTile
                    key={metric.key}
                    metric={metric}
                    isBusiness={isBusiness}
                    className="border-0 bg-transparent shadow-none"
                  />
                ))}
              </div>
            ) : null}

            {fullWidthMetrics.map((metric) => (
              <MetricTile
                key={metric.key}
                metric={metric}
                isBusiness={isBusiness}
                className="border-0 bg-transparent shadow-none"
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
};
