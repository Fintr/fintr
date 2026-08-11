export type MetricCalculationCopy = {
  title: string;
  formula: string;
  details: string[];
};

export const getMetricCalculation = (
  key: string,
  isBusiness: boolean,
): MetricCalculationCopy | null => {
  switch (key) {
    case "savings_rate":
      return isBusiness
        ? {
            title: "Net margin",
            formula: "(Revenue − Expenses) ÷ Revenue × 100",
            details: [
              "Uses all income and expense transactions in the selected period, converted to your space currency.",
              "The arrow compares this period’s margin % to the previous period of equal length.",
            ],
          }
        : {
            title: "Savings rate",
            formula: "(Net savings ÷ Total income) × 100",
            details: [
              "Net savings is total income minus total expenses for the filtered period.",
              "The arrow compares this period’s savings rate % to the previous period of equal length—not peso amount saved.",
            ],
          };
    case "emergency_fund":
      return isBusiness
        ? {
            title: "Cash runway",
            formula: "Total cash ÷ Average monthly expenses",
            details: [
              "Cash is the sum of liquid account balances (cash, savings, debit, e-wallet) converted to your space currency.",
              "Average monthly expenses are total expenses over the last 12 months, divided by 12.",
              "Shown in weeks (months × 4.33).",
            ],
          }
        : {
            title: "Emergency fund",
            formula: "Total cash ÷ Average monthly expenses",
            details: [
              "Cash is the sum of liquid account balances (cash, savings, debit, e-wallet) converted to your space currency.",
              "Average monthly expenses are total expenses over the last 12 months, divided by 12.",
              "Target range is 3–6 months of expenses covered.",
            ],
          };
    case "expense_change":
      return {
        title: "Expense vs prior period",
        formula: "(Current expenses − Prior expenses) ÷ Prior expenses × 100",
        details: [
          "Compares total expenses in your selected period to the immediately preceding period of the same length.",
          "Not compared to your monthly budget—only to the prior period.",
          "“Less” means you spent a smaller share than last period; “more” means spending rose.",
          "The icon uses the same income (teal) and expense (red) arrows as transactions.",
        ],
      };
    case "gross_margin":
      return {
        title: "Gross margin",
        formula: "(Revenue − COGS) ÷ Revenue × 100",
        details: [
          "Revenue is all income transactions in the period.",
          "COGS includes expense categories whose names match inventory, supplies, materials, or similar.",
          "Tag direct costs consistently for a more accurate margin.",
        ],
      };
    default:
      return null;
  }
};
