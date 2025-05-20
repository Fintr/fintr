import { atom } from 'jotai';
import { BudgetCategory } from '@/types/budgetTypes';

// Base atom for budget date filter (defaults to current date)
export const budgetDateAtom = atom<string>(() => {
  const today = new Date();
  return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
});

// Atom for applied budget filters
export const appliedBudgetFiltersAtom = atom((get) => {
  return {
    date: get(budgetDateAtom)
  };
});

// Atom for budget categories data
export const budgetCategoriesAtom = atom<BudgetCategory[]>([]);

// Atom for total budget stats
export const budgetStatsAtom = atom((get) => {
  const categories = get(budgetCategoriesAtom);
  
  const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);
  const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const budgetUsagePercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  
  return {
    totalBudget,
    totalSpent,
    totalRemaining,
    budgetUsagePercentage,
    isOverBudget: budgetUsagePercentage > 100
  };
}); 
