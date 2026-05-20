import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type BudgetAllocationSummaryProps = {
  parentAmount: number;
  allocatedToSubs: number;
  spaceCurrency: string;
  isOverAllocation?: boolean;
  className?: string;
};

export function BudgetAllocationSummary({
  parentAmount,
  allocatedToSubs,
  spaceCurrency,
  isOverAllocation = false,
  className,
}: BudgetAllocationSummaryProps) {
  const remaining = parentAmount - allocatedToSubs;

  const rows = [
    {
      label: "Parent budget",
      value: formatCurrency(parentAmount, spaceCurrency),
      valueClassName: "text-primary",
    },
    {
      label: "Subcategories allocated",
      value: formatCurrency(allocatedToSubs, spaceCurrency),
      valueClassName: "text-primary",
    },
    {
      label: "Remaining",
      value: formatCurrency(remaining, spaceCurrency),
      valueClassName: isOverAllocation ? "text-red-600" : "text-primary",
    },
  ];

  return (
    <dl
      className={cn(
        "grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm",
        className,
      )}
    >
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd
            className={cn(
              "tabular-nums text-right font-medium",
              row.valueClassName,
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
