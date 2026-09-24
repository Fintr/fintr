export type MonthlyFinancialSummary = {
  id: string;
  year: number;
  month: number;
  currency: string;
  fxBased: boolean;
  calculatedAt: string;
  totalIncome: number | string;
  totalExpenses: number | string;
  netSavings: number | string;
  savingsPercentage: number | string;
  monthStartDate: string;
  monthEndDate: string;
};
