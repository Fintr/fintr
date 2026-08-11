"use client";

import { ChevronDown, PieChart as PieChartIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "framer-motion";
import { Label, Pie, PieChart, Cell } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { ExpenseBreakdownCenterLabel } from "@/components/dashboard/insights/expense-breakdown-center-label";
import { CHART_COLORS, cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export type ExpenseBreakdownChartItem = {
  name: string;
  value: number;
  color: string;
  percentage?: string;
  details?: Array<{
    name: string;
    value: number;
    percent: string;
  }>;
};

interface ExpenseBreakdownCardProps {
  items: ExpenseBreakdownChartItem[];
  isLoading?: boolean;
  formatAmount: (amount: number) => string;
  title?: string;
  description?: string;
  testId?: string;
  className?: string;
}

const MIN_LEGEND_PERCENT = 1;
const DONUT_INNER_RADIUS = 68;
const DONUT_OUTER_RADIUS = 96;
const DONUT_START_ANGLE = 90;
const REVEAL_DURATION_SEC = 1.2;

const toSliceKey = (index: number) => `slice-${index}`;

const sliceFillColor = (index: number) =>
  CHART_COLORS[index % CHART_COLORS.length];

const hasExpandableDetails = (item: ExpenseBreakdownChartItem) =>
  Boolean(item.details?.length);

const getScrollParent = (element: HTMLElement | null): HTMLElement | null => {
  if (!element) {
    return null;
  }

  let parent = element.parentElement;
  while (parent) {
    const { overflow, overflowY } = window.getComputedStyle(parent);
    if (
      overflowY === "auto"
      || overflowY === "scroll"
      || overflow === "auto"
      || overflow === "scroll"
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }

  return null;
};

const playRevealTween = (
  onProgress: (value: number) => void,
) => {
  const state = { value: 0 };
  onProgress(0);

  return gsap.to(state, {
    value: 1,
    duration: REVEAL_DURATION_SEC,
    ease: "power2.out",
    onUpdate: () => {
      onProgress(state.value);
    },
    onComplete: () => {
      onProgress(1);
    },
  });
};

export const ExpenseBreakdownCard = ({
  items,
  isLoading = false,
  formatAmount,
  title = "Expense Breakdown",
  description = "How your expenses are distributed",
  testId = "expense-breakdown",
  className,
}: ExpenseBreakdownCardProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const [revealProgress, setRevealProgress] = useState(
    () => (shouldReduceMotion ? 1 : 0),
  );
  const chartRef = useRef<HTMLDivElement>(null);
  const chartReady = !isLoading && items.length > 0;
  const animationKey = useMemo(
    () => items.map((item) => `${item.name}:${item.value}`).join("|"),
    [items],
  );

  useGSAP(
    () => {
      if (!chartReady) {
        setRevealProgress(0);
        return;
      }

      if (shouldReduceMotion) {
        setRevealProgress(1);
        return;
      }

      const trigger = chartRef.current;
      if (!trigger) {
        setRevealProgress(0);
        return;
      }

      setRevealProgress(0);

      const scroller = getScrollParent(trigger);
      let tween: gsap.core.Tween | null = null;
      let hasStarted = false;

      const startReveal = () => {
        if (hasStarted) {
          return;
        }
        hasStarted = true;
        tween = playRevealTween(setRevealProgress);
      };

      const scrollTrigger = ScrollTrigger.create({
        trigger,
        scroller: scroller ?? undefined,
        start: "top 85%",
        once: true,
        onEnter: startReveal,
      });

      ScrollTrigger.refresh();

      return () => {
        scrollTrigger.kill();
        tween?.kill();
      };
    },
    {
      dependencies: [animationKey, chartReady, shouldReduceMotion],
      scope: chartRef,
    },
  );

  const pieEndAngle = DONUT_START_ANGLE - 360 * revealProgress;

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.value, 0),
    [items],
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};

    items.forEach((item, index) => {
      config[toSliceKey(index)] = {
        label: item.name,
        color: sliceFillColor(index),
      };
    });

    return config;
  }, [items]);

  const chartData = useMemo(
    () =>
      items.map((item, index) => ({
        ...item,
        sliceKey: toSliceKey(index),
        fill: sliceFillColor(index),
      })),
    [items],
  );

  const legendItems = useMemo(
    () =>
      items
        .map((item, index) => {
          const percent = total > 0 ? (item.value / total) * 100 : 0;

          return {
            ...item,
            index,
            percent,
          };
        })
        .filter((item) => item.percent >= MIN_LEGEND_PERCENT),
    [items, total],
  );

  const selectedItem =
    selectedIndex != null ? items[selectedIndex] ?? null : null;

  const handleSelect = (index: number) => {
    const item = items[index];
    const isAlreadySelected = selectedIndex === index;
    const nextIndex = isAlreadySelected ? null : index;

    setSelectedIndex(nextIndex);

    if (!item) {
      return;
    }

    if (hasExpandableDetails(item)) {
      setExpandedName(isAlreadySelected ? null : item.name);
      return;
    }

    setExpandedName(null);
  };

  const centerHeading = selectedItem?.name ?? "Total Expenses";
  const centerAmount = selectedItem
    ? formatAmount(selectedItem.value)
    : formatAmount(total);

  return (
    <Card
      ref={chartRef}
      className={cn(
        "col-span-2 border border-border/50 bg-card shadow-none",
        className,
      )}
      data-tutorial-target="expense-breakdown"
      data-testid={testId}
    >
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5 text-primary" aria-hidden />
          {title}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 px-4 pb-6 sm:px-6">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size="medium" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No expense data available
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square max-h-[240px] w-full"
              data-testid="expense-breakdown-chart"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      nameKey="sliceKey"
                      formatter={(value, _name, item) => {
                        const payload = item.payload as ExpenseBreakdownChartItem & {
                          sliceKey: string;
                        };

                        if (payload.details?.length) {
                          return (
                            <div className="grid w-full gap-2">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">
                                  {payload.name}
                                </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  {formatAmount(Number(value))}
                                </span>
                              </div>
                              <ul className="space-y-1 border-t border-border/60 pt-2">
                                {payload.details.map((detail) => (
                                  <li
                                    key={detail.name}
                                    className="flex items-center justify-between gap-3 text-[11px]"
                                  >
                                    <span className="truncate text-muted-foreground">
                                      {detail.name}
                                    </span>
                                    <span className="shrink-0 tabular-nums text-foreground">
                                      {formatAmount(detail.value)}
                                      {" "}
                                      (
                                      {detail.percent.includes("%")
                                        ? detail.percent
                                        : `${detail.percent}%`}
                                      )
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        }

                        return (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              {payload.name}
                            </span>
                            <span className="font-medium tabular-nums text-foreground">
                              {formatAmount(Number(value))}
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="sliceKey"
                  innerRadius={DONUT_INNER_RADIUS}
                  outerRadius={DONUT_OUTER_RADIUS}
                  startAngle={DONUT_START_ANGLE}
                  endAngle={pieEndAngle}
                  paddingAngle={0}
                  stroke="none"
                  isAnimationActive={false}
                  onClick={(_data, index) => handleSelect(index)}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.sliceKey}
                      fill={entry.fill}
                      className="cursor-pointer outline-none"
                      opacity={
                        selectedIndex == null || selectedIndex === index
                          ? 1
                          : 0.35
                      }
                    />
                  ))}
                  <Label
                    content={(labelRenderProps) => (
                      <ExpenseBreakdownCenterLabel
                        viewBox={labelRenderProps.viewBox as {
                          cx?: number;
                          cy?: number;
                          x?: number;
                          y?: number;
                          width?: number;
                          height?: number;
                        }}
                        heading={centerHeading}
                        amountLabel={centerAmount}
                      />
                    )}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            <ul className="space-y-3" aria-label="Expense categories">
              {legendItems.map((item) => {
                const isSelected = selectedIndex === item.index;
                const isExpanded = expandedName === item.name;
                const canExpand = hasExpandableDetails(item);
                const barWidthPercent = item.percent * revealProgress;

                return (
                  <li key={`${item.name}-${item.index}`} className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleSelect(item.index)}
                      className={cn(
                        "w-full rounded-xl px-2 py-1.5 text-left transition-colors",
                        isSelected
                          ? "bg-muted/80"
                          : "hover:bg-muted/50",
                      )}
                      aria-expanded={canExpand ? isExpanded : undefined}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-start justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span
                            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: sliceFillColor(item.index) }}
                            aria-hidden
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium text-foreground">
                                {item.name}
                              </span>
                              {canExpand ? (
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                    isExpanded && "rotate-180",
                                  )}
                                  aria-hidden
                                />
                              ) : null}
                            </div>
                            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                              {Math.round(item.percent)}%
                              {" · "}
                              {formatAmount(item.value)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                        role="presentation"
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${barWidthPercent}%`,
                            backgroundColor: sliceFillColor(item.index),
                          }}
                        />
                      </div>
                    </button>

                    {canExpand && isExpanded && item.details ? (
                      <ul
                        className="ml-5 space-y-2 border-l border-border/60 py-1 pl-3"
                        data-testid={`expense-breakdown-details-${item.name}-${item.index}`}
                      >
                        {item.details.map((detail) => (
                          <li
                            key={detail.name}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="truncate text-muted-foreground">
                              {detail.name}
                            </span>
                            <span className="shrink-0 tabular-nums text-foreground">
                              {formatAmount(detail.value)}
                              {" "}
                              <span className="text-muted-foreground">
                                (
                                {detail.percent.includes("%")
                                  ? detail.percent
                                  : `${detail.percent}%`}
                                )
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
