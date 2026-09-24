"use client";

import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalculationBreakdownContent } from "@/components/dashboard/insights/calculation-breakdown-content";
import { MetricCalculation } from "@/services/insights/types";
import { useRevealProgress } from "@/hooks/useRevealProgress";
import { CircleHelp } from "lucide-react";

export type HealthScoreFactorVariant = "savings" | "budget" | "debt";

const FACTOR_STYLES: Record<
  HealthScoreFactorVariant,
  { bar: string; badge: string; scoreText: string }
> = {
  savings: {
    bar: "bg-teal-600",
    badge: "bg-teal-600",
    scoreText: "text-teal-600",
  },
  budget: {
    bar: "bg-primary",
    badge: "bg-primary",
    scoreText: "text-primary",
  },
  debt: {
    bar: "bg-amber-600",
    badge: "bg-amber-600",
    scoreText: "text-amber-600",
  },
};

interface HealthScoreFactorRowProps {
  label: string;
  percentage: string;
  score: number;
  variant: HealthScoreFactorVariant;
  helpTitle?: string;
  calculation?: MetricCalculation;
}

const scoreBarValue = (score: number) =>
  Math.min(Math.max(score, 0), 100);

export const HealthScoreFactorRow = ({
  label,
  percentage,
  score,
  variant,
  helpTitle,
  calculation,
}: HealthScoreFactorRowProps) => {
  const styles = FACTOR_STYLES[variant];
  const popoverTitle = helpTitle ?? label;
  const targetBarValue = scoreBarValue(score);
  const { ref, progress } = useRevealProgress({
    amount: 0.45,
    durationMs: 1200,
  });
  const animatedBarValue = targetBarValue * progress;

  return (
    <div ref={ref} className="space-y-2">
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-sm font-medium">{label}</span>
          {calculation && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-primary/50 hover:text-primary hover:bg-primary/5"
                  aria-label={`How ${label} is calculated`}
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-80 max-h-[min(70vh,420px)] overflow-y-auto"
              >
                <CalculationBreakdownContent
                  title={popoverTitle}
                  calculation={calculation}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center justify-center rounded-sm ${styles.badge} px-2 py-1 text-xs font-medium text-white ring-1 ring-inset dark:ring-0`}
          >
            {percentage}
          </span>
          <span className={`text-sm font-medium ${styles.scoreText}`}>
            {score}
          </span>
        </div>
      </div>

      <Progress
        value={animatedBarValue}
        className="h-2 bg-gray-200"
        indicatorClassName={`${styles.bar} transition-none`}
        aria-label={`${label} health score ${score} out of 100`}
      />
    </div>
  );
};
