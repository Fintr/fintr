import { OptionType } from "./generalTypes";

export interface FinancialSummary {
  totalIncome: string;
  totalExpenses: string;
  netSavings: string;
  savingsPercentage: string;
  calculatedAt: string;
}

export interface DashboardData {
  id: string;
  categoryOptions: OptionType[];
  accountOptions: OptionType[];
  expenseCategoryOptions: OptionType[];
  incomeCategoryOptions: OptionType[];
  goalDescription: string;
  financialSummary: FinancialSummary;
}
