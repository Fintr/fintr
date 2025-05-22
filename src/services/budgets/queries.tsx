import { AxiosInstance } from 'axios';
import { BudgetIndexInputType, BudgetsPage, Budget, BudgetCategory } from '@/types/budgetTypes';

/**
 * Fetches monthly budgets from the API.
 * 
 * @param api - The authenticated Axios instance.
 * @param options - Query options object with pageParam and queryKey.
 * @param options.pageParam - The page number to fetch (default: 1)
 * @param options.queryKey - Query key array containing [queryName, spaceCode, date]
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
  const [_key, spaceCode, date] = queryKey as [
    string,
    string,
    string
  ];

  if (!spaceCode) {
    console.error('Space code is required for fetching budgets');
    return { budgets: [], summary: null, nextPage: null, totalPages: null, totalCount: null };
  }

  if (!date) {
    console.error('Date is required for fetching budgets');
    return { budgets: [], summary: null, nextPage: null, totalPages: null, totalCount: null };
  }

  const input: BudgetIndexInputType = {
    spaceCode,
    date,
    page: pageParam,
  };

  try {
    const response = await api.get('/budgets', {
      params: input,
    });
    
    // Parse API response
    const budgets = response?.data?.data?.value?.budgets || [];
    const summary = response?.data?.data?.value?.summary || null;
    const totalPages = response?.data?.data?.pagination?.totalPages || 1;
    const totalCount = response?.data?.data?.pagination?.totalCount || 0;
    const currentPage = input.page;

    // Determine next page number
    const nextPage = currentPage < totalPages ? currentPage + 1 : null;

    if (!Array.isArray(budgets)) {
      console.error('Invalid budget data structure received:', response?.data);
      return { budgets: [], summary: null, nextPage: null, totalPages: null, totalCount: null };
    }

    return { budgets, summary, nextPage, totalPages, totalCount };
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
        color: getRandomColor(budget.category_name), // Assign a color based on category name
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

// Helper function to generate consistent colors for categories
const getRandomColor = (categoryName: string) => {
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
