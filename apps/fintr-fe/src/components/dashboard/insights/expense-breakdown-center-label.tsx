"use client";

type CenterLabelViewBox = {
  cx?: number;
  cy?: number;
};

export interface ExpenseBreakdownCenterLabelProps {
  cx?: number;
  cy?: number;
  viewBox?: CenterLabelViewBox;
  totalLabel: string;
}

/** Renders inside Recharts <Pie> so cx/cy match the donut hole. */
export const ExpenseBreakdownCenterLabel = ({
  cx: cxProp,
  cy: cyProp,
  viewBox,
  totalLabel,
}: ExpenseBreakdownCenterLabelProps) => {
  const cx = cxProp ?? viewBox?.cx;
  const cy = cyProp ?? viewBox?.cy;

  if (cx == null || cy == null) {
    return null;
  }

  return (
    <text data-testid="expense-breakdown-center" pointerEvents="none">
      <tspan
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        fill="var(--muted-foreground)"
        fontSize={12}
      >
        Total Expenses
      </tspan>
      <tspan
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fill="var(--foreground)"
        fontSize={16}
        fontWeight={600}
      >
        {totalLabel}
      </tspan>
    </text>
  );
};
