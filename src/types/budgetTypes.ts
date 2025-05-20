import { z } from 'zod';

// Schema for validating budget data
export const budgetSchema = z.object({
  id: z.string(),
  date: z.string(),
  category_name: z.string(),
  total_spent: z.number().optional(),
  amount_currency: z.string(),
  amount: z.number()
});

// Types derived from the schema
export type Budget = z.infer<typeof budgetSchema>;

// Budget pagination response type
export interface BudgetsPage {
  budgets: Budget[];
  summary: BudgetSummary | null;
  nextPage: number | null;
  totalPages: number | null;
  totalCount: number | null;
}

// Interface for budget summary
export interface BudgetSummary {
  total_budget: number;
  total_spent: number;
  total_spent_percentage: number | null;
  remaining: number;
}

// Input parameters for fetching budgets
export interface BudgetIndexInputType {
  spaceCode: string;
  date: string; // Format: YYYY-MM-DD
  page?: number;
}

// Budget category with the format used in the BudgetsTab
export interface BudgetCategory {
  id: string;
  name: string;
  spent: number;
  budget: number;
  color: string;
  subcategories: Array<{
    name: string;
    spent: number;
    budget: number;
  }>;
} 
