"use client";

import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { WeeklySpending } from "@/services/insights/types";

const chartConfig = {
  amount: {
    label: "Spending",
    theme: {
      light: "var(--primary)",
      dark: "var(--primary-dark-mode)",
    },
  },
} satisfies ChartConfig;

interface WeeklySpendingCardProps {
  data: WeeklySpending[];
  isLoading?: boolean;
  formatAmount: (amount: number) => string;
}

export const WeeklySpendingCard = ({
  data,
  isLoading = false,
  formatAmount,
}: WeeklySpendingCardProps) => {
  const hasSpending = data.some((entry) => entry.amount > 0);

  return (
    <Card className="mx-4 border border-border/50 bg-card shadow-none md:mx-0">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
          Weekly Spending
        </CardTitle>
        <CardDescription>Your daily expenses this week</CardDescription>
      </CardHeader>

      <CardContent className="px-4 pb-6 sm:px-6">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size="medium" />
          </div>
        ) : !hasSpending ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No spending recorded this week yet.
            </p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-[5/3] w-full max-h-[260px]"
          >
            <BarChart
              data={data}
              margin={{ top: 8, right: 4, left: 0, bottom: 28 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                minTickGap={0}
                tick={{
                  fill: "var(--muted-foreground)",
                  fontSize: 12,
                }}
              />
              <YAxis hide domain={[0, "dataMax"]} />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value) => (
                      <span className="font-medium tabular-nums text-foreground">
                        {formatAmount(Number(value))}
                      </span>
                    )}
                  />
                }
              />
              <Bar
                dataKey="amount"
                fill="var(--color-amount)"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};
