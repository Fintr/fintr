import type { MonthlyFinancialSummary } from "./types";

const pickField = (
  raw: Record<string, unknown>,
  camel: string,
  snake: string,
): unknown => raw[camel] ?? raw[snake];

const toNumericField = (value: unknown): number | string => {
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }

  return 0;
};

/** Coerce API / bootstrap rows into the shape insights offline math expects. */
export const normalizeMonthlyFinancialSummary = (
  raw: unknown,
): MonthlyFinancialSummary | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const year = Number(row.year);
  const month = Number(row.month);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  const monthStartDate = String(
    pickField(row, "monthStartDate", "month_start_date") ?? "",
  );
  const monthEndDate = String(
    pickField(row, "monthEndDate", "month_end_date") ?? "",
  );

  return {
    id: String(row.id ?? `local:${year}-${String(month).padStart(2, "0")}`),
    year,
    month,
    currency: String(row.currency ?? "PHP").trim().toUpperCase(),
    fxBased: Boolean(pickField(row, "fxBased", "fx_based")),
    calculatedAt: String(
      pickField(row, "calculatedAt", "calculated_at") ?? "",
    ),
    totalIncome: toNumericField(
      pickField(row, "totalIncome", "total_income"),
    ),
    totalExpenses: toNumericField(
      pickField(row, "totalExpenses", "total_expenses"),
    ),
    netSavings: toNumericField(
      pickField(row, "netSavings", "net_savings"),
    ),
    savingsPercentage: toNumericField(
      pickField(row, "savingsPercentage", "savings_percentage"),
    ),
    monthStartDate,
    monthEndDate,
  };
};

export const normalizeMonthlyFinancialSummaries = (
  raw: unknown,
): MonthlyFinancialSummary[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map(normalizeMonthlyFinancialSummary)
    .filter((row): row is MonthlyFinancialSummary => row !== null);
};
