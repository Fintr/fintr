"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SummaryStatTile,
  summaryStatGridClassName,
} from "@/components/dashboard/insights/summary-stat-tile";
import { InsightMetric } from "@/services/insights/types";
import { CalculationBreakdownContent } from "@/components/dashboard/insights/calculation-breakdown-content";
import { getMetricCalculation } from "@/components/dashboard/insights/insight-metric-calculations";
import { CircleHelp } from "lucide-react";

interface InsightMetricCardsProps {
  metrics: InsightMetric[];
  isLoading?: boolean;
  isBusiness?: boolean;
}

const parsePercent = (value: string) =>
  parseFloat(value.replace("%", "").replace(/[^\d.-]/g, "")) || 0;

const parseMonths = (value: string) => {
  const match = value.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
};

const metricValueClassName = (metric: InsightMetric): string => {
  if (metric.key === "expense_change") {
    return metric.trend === "expense" ? "text-red-900" : "text-teal-600";
  }

  if (metric.key === "savings_rate" || metric.key === "gross_margin") {
    const pct = parsePercent(metric.value);
    const ok = metric.key === "gross_margin" ? 15 : 10;
    const strong = metric.key === "gross_margin" ? 30 : 20;

    if (pct >= strong) {
      return "text-teal-600";
    }
    if (pct >= ok) {
      return "text-primary";
    }
    return "text-red-900";
  }

  if (metric.key === "emergency_fund") {
    const amount = parseMonths(metric.value);
    const isWeeks = metric.value.includes("week");
    const monthsEquivalent = isWeeks ? amount / 4.33 : amount;

    if (monthsEquivalent >= 6) {
      return "text-teal-600";
    }
    if (monthsEquivalent >= 3) {
      return "text-primary";
    }
    return "text-red-900";
  }

  return "text-primary";
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
          className="h-7 w-7 shrink-0 text-primary/50 hover:text-primary hover:bg-primary/5"
          aria-label={`How ${title} is calculated`}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-h-[min(70vh,420px)] overflow-y-auto">
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

export const InsightMetricCards = ({
  metrics,
  isLoading = false,
  isBusiness = false,
}: InsightMetricCardsProps) => {
  if (!isLoading && !metrics.length) {
    return null;
  }

  return (
    <Card className="mb-2 border border-primary/10">
      <CardHeader className="px-4 pb-2">
        <CardTitle>Key metrics</CardTitle>
        <CardDescription>
          How you are tracking against common financial targets
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {isLoading ? (
          <div className={summaryStatGridClassName(3)}>
            {[1, 2, 3].map((key) => (
              <div
                key={key}
                className="bg-[#f9f7f5] p-4 rounded-lg h-[88px] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className={summaryStatGridClassName(metrics.length)}>
            {metrics.map((metric) => (
              <SummaryStatTile
                key={metric.key}
                label={metric.label}
                value={metric.value}
                valueClassName={metricValueClassName(metric)}
                footer={
                  metric.key === "expense_change"
                    ? "Change vs. the previous period of equal length — not your monthly budget."
                    : `Target: ${metric.benchmark}`
                }
                action={
                  <CalculationPopover metric={metric} isBusiness={isBusiness} />
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
