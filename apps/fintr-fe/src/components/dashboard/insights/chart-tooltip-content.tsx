"use client";

type ChartTooltipPayload = {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string | number;
};

export interface ChartTooltipContentProps {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string | number;
  labelFormatter?: (label: string) => string;
  formatValue?: (value: number, name: string) => string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  formatValue = (value) => String(value),
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const labelText =
    label != null && label !== ""
      ? labelFormatter
        ? labelFormatter(String(label))
        : String(label)
      : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md dark:border-border dark:bg-card">
      {labelText ? (
        <p className="mb-1.5 text-sm font-semibold text-foreground">{labelText}</p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((entry) => {
          const name = entry.name ?? String(entry.dataKey ?? "");
          const value = entry.value ?? 0;
          const color = entry.color ?? "var(--foreground)";

          return (
            <li
              key={`${name}-${entry.dataKey}`}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span>
                <span className="text-muted-foreground">{name}</span>
                {": "}
                <span className="font-medium">{formatValue(value, name)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
