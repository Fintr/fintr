import { atom } from 'jotai';
import { BudgetCategory } from '@/types/budgetTypes';
import { BudgetCategory as OnboardingBudgetCategory } from '@/services/onboarding/mutations';

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

// Onboarding-specific budget atoms
export const onboardingBudgetCategoriesAtom = atom<OnboardingBudgetCategory[]>([]);

// Derived atom to calculate total budget for onboarding
export const onboardingTotalBudgetAtom = atom((get) => {
  const categories = get(onboardingBudgetCategoriesAtom);
  return categories.reduce((sum, category) => sum + Number(category.amount || 0), 0);
});

// Atom to track if onboarding budget data is loaded
export const onboardingBudgetDataLoadedAtom = atom<boolean>(false);

// Onboarding accounts atoms
export interface AccountData {
  name: string;
  accountCategory: string;
  balance: number;
  forSalary?: boolean;
  forBusiness?: boolean;
}

export interface AccountCategory {
  value: string;
  label: string;
}

export const onboardingAccountsDataAtom = atom<AccountData[]>([]);
export const onboardingAccountCategoriesAtom = atom<AccountCategory[]>([]);
export const onboardingAccountsDataLoadedAtom = atom<boolean>(false);

// Atom to store income requirements from step 2 POST response
export interface IncomeRequirements {
  salaryIncome: boolean;
  businessIncome: boolean;
}

export const incomeRequirementsAtom = atom<IncomeRequirements>({
  salaryIncome: false,
  businessIncome: false
});
