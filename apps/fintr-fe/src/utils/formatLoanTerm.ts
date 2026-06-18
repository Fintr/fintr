export function formatLoanTerm(months: number): string {
  const totalMonths = Math.max(0, Math.floor(months));
  const years = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;

  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} year${years === 1 ? "" : "s"}`);
  }

  if (remainingMonths > 0) {
    parts.push(
      `${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`,
    );
  }

  if (parts.length === 0) {
    return "0 months";
  }

  return parts.join(" ");
}

export type LoanTermUnit = "months" | "years";

export function loanTermToMonths(
  value: string,
  unit: LoanTermUnit,
): number {
  const parsed = parseFloat(value);

  if (isNaN(parsed) || parsed <= 0) {
    return 0;
  }

  return unit === "years"
    ? Math.round(parsed * 12)
    : Math.round(parsed);
}

export function convertLoanTermDisplay(
  value: string,
  from: LoanTermUnit,
  to: LoanTermUnit,
): string {
  const parsed = parseFloat(value);

  if (!value || isNaN(parsed) || parsed <= 0) {
    return value;
  }

  if (from === to) {
    return value;
  }

  if (from === "months" && to === "years") {
    const years = parsed / 12;

    return Number.isInteger(years)
      ? String(years)
      : years.toFixed(1).replace(/\.0$/, "");
  }

  return String(Math.round(parsed * 12));
}

export function formatLoanTermUnitLabel(
  unit: LoanTermUnit,
  value: string,
): string {
  const parsed = parseFloat(value);
  const isOne = !isNaN(parsed) && parsed === 1;

  if (unit === "months") {
    return isOne ? "Month" : "Months";
  }

  return isOne ? "Year" : "Years";
}
