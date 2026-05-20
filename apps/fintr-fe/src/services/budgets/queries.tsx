import { AxiosInstance } from 'axios';
import { BudgetIndexInputType, BudgetsPage, Budget, BudgetCategory } from '@/types/budgetTypes';

/**
 * Fetches monthly budgets from the API.
 * 
 * @param api - The authenticated Axios instance.
 * @param options - Query options object with pageParam and queryKey.
 * @param options.pageParam - The page number to fetch (default: 1)
 * @param options.queryKey - Query key array containing [queryName, spaceCode, startDate, endDate]
 * @returns A promise resolving to a BudgetsPage containing budgets and pagination info
 */
export const fetchBudgetsPage = async (
  api: AxiosInstance,
  {
    pageParam = 1,
    queryKey,
  }: {
    pageParam?: number;
    queryKey: readonly unknown[];
  }
): Promise<BudgetsPage> => {
  // Extract parameters from queryKey
  const [_key, spaceCode, startDate, endDate] = queryKey as [
    string,
    string,
    string,
    string
  ];

  if (!spaceCode) {
    console.error('Space code is required for fetching budgets');
    return { budgets: [], summary: null, nextPage: null, totalPages: null, totalCount: null };
  }

  if (!startDate || !endDate) {
    console.error('Start date and end date are required for fetching budgets');
    return { budgets: [], summary: null, nextPage: null, totalPages: null, totalCount: null };
  }

  const input: BudgetIndexInputType = {
    spaceCode,
    start_date: startDate,
    end_date: endDate,
    page: pageParam,
  };

  try {
    const response = await api.get('/budgets', {
      params: input,
    });
    
    // Parse API response - new structure: response.data.data.budgets and response.data.data.summary
    const budgets = response?.data?.data?.budgets || [];
    const summary = response?.data?.data?.summary || null;
    
    // This endpoint doesn't support pagination anymore, so set pagination fields to null
    const totalPages = null;
    const totalCount = null;
    const nextPage = null;

    if (!Array.isArray(budgets)) {
      console.error('Invalid budget data structure received:', response?.data);
      return { budgets: [], summary: null, nextPage: null, totalPages: null, totalCount: null };
    }

    // Transform budgets to ensure totalSpent is a number (API returns it as string)
    const transformedBudgets = budgets.map((budget: any) => ({
      ...budget,
      total_spent: typeof budget.totalSpent === 'string' 
        ? parseFloat(budget.totalSpent) || 0 
        : budget.totalSpent || 0,
      // Map camelCase keys back to snake_case for consistency with existing code
      category_name: budget.categoryName || budget.category_name,
      amount_currency: budget.amountCurrency || budget.amount_currency,
    }));

    // Transform summary keys from camelCase to snake_case for consistency
    const transformedSummary = summary ? {
      total_budget: summary.totalBudget ?? summary.total_budget ?? 0,
      total_spent: summary.totalSpent ?? summary.total_spent ?? 0,
      total_spent_percentage: typeof summary.totalSpentPercentage === 'string'
        ? parseFloat(summary.totalSpentPercentage)
        : summary.totalSpentPercentage ?? summary.total_spent_percentage ?? null,
      remaining: summary.remaining ?? 0,
    } : null;

    return { budgets: transformedBudgets, summary: transformedSummary, nextPage, totalPages, totalCount };
  } catch (error) {
    console.error("Error fetching budgets page:", error);
    throw error;
  }
};

/**
 * Transforms raw budget data from API into the format expected by BudgetsTab component
 * 
 * @param budgets - Array of budget objects from the API
 * @returns Transformed budget categories with calculated spent and budget amounts
 */
export const transformBudgetsToCategories = (budgets: Budget[]) => {
  const categoryMap = new Map<string, BudgetCategory>();
  
  // Group budgets by category and calculate totals
  budgets.forEach(budget => {
    if (!categoryMap.has(budget.category_name)) {
      categoryMap.set(budget.category_name, {
        id: budget.id,
        name: budget.category_name,
        spent: budget.total_spent || 0,
        budget: budget.amount,
        color: getColor(budget.category_name), // Assign a color based on category name
        subcategories: []
      });
    } else {
      const category = categoryMap.get(budget.category_name)!;
      category.spent = (category.spent || 0) + (budget.total_spent || 0);
      category.budget = (category.budget || 0) + budget.amount;
    }
  });
  
  return Array.from(categoryMap.values());
};

/**
 * Returns category options that do not already have a budget in the fetched period.
 */
export const filterCategoryOptionsWithoutBudgets = (
  options: Array<{ label: string; value: string }>,
  budgets: Budget[] | undefined,
): Array<{ label: string; value: string }> => {
  const usedCategoryNames = new Set(
    budgets?.map((budget) => budget.category_name) ?? [],
  );

  return options.filter((option) => !usedCategoryNames.has(option.value));
};

// Helper function to generate consistent colors for categories
const getColor = (categoryName: string) => {
  // Generate a color based on the category name for consistency
  const colors = [
    '#0A3D62', '#3c6382', '#60a3bc', '#0c2461',
    '#1e3799', '#4a69bd', '#6a89cc', '#82ccdd',
    '#b8e994', '#78e08f', '#3c40c6', '#575fcf'
  ];
  
  // Simple hash function to pick a color
  const hash = categoryName.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  
  return colors[hash % colors.length];
}; 
