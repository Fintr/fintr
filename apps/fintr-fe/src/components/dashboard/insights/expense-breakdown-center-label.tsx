"use client";

type CenterLabelViewBox = {
  cx?: number;
  cy?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export interface ExpenseBreakdownCenterLabelProps {
  cx?: number;
  cy?: number;
  viewBox?: CenterLabelViewBox;
  heading?: string;
  amountLabel: string;
  /** @deprecated Use `heading` + `amountLabel` */
  totalLabel?: string;
}

const resolveCenterCoordinate = ({
  explicit,
  polar,
  origin,
  size,
}: {
  explicit?: number;
  polar?: number;
  origin?: number;
  size?: number;
}) => {
  if (explicit != null) {
    return explicit;
  }

  if (polar != null) {
    return polar;
  }

  if (origin != null && size != null) {
    return origin + size / 2;
  }

  return undefined;
};

/** Renders inside Recharts <Pie> so cx/cy match the donut hole. */
export const ExpenseBreakdownCenterLabel = ({
  cx: cxProp,
  cy: cyProp,
  viewBox,
  heading = "Total Expenses",
  amountLabel,
  totalLabel,
}: ExpenseBreakdownCenterLabelProps) => {
  const cx = resolveCenterCoordinate({
    explicit: cxProp,
    polar: viewBox?.cx,
    origin: viewBox?.x,
    size: viewBox?.width,
  });
  const cy = resolveCenterCoordinate({
    explicit: cyProp,
    polar: viewBox?.cy,
    origin: viewBox?.y,
    size: viewBox?.height,
  });
  const displayAmount = amountLabel ?? totalLabel ?? "";

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
        {heading}
      </tspan>
      <tspan
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fill="var(--foreground)"
        fontSize={14}
        fontWeight={600}
      >
        {displayAmount}
      </tspan>
    </text>
  );
};
