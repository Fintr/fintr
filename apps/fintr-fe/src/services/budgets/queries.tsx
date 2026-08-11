import { AxiosInstance } from 'axios';
import { BudgetIndexInputType, BudgetsPage, Budget, BudgetCategory } from '@/types/budgetTypes';
import { CategoryTreeOption } from '@/types/categoryTreeTypes';

export const fetchBudgetsPage = async (
  api: AxiosInstance,
  {
    pageParam = 1,
    queryKey,
    requestConfig,
  }: {
    pageParam?: number;
    queryKey: readonly unknown[];
    requestConfig?: import("axios").AxiosRequestConfig;
  }
): Promise<BudgetsPage> => {
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
      ...requestConfig,
    });

    const budgets = response?.data?.data?.budgets || [];
    const summary = response?.data?.data?.summary || null;

    if (!Array.isArray(budgets)) {
      console.error('Invalid budget data structure received:', response?.data);
      return { budgets: [], summary: null, nextPage: null, totalPages: null, totalCount: null };
    }

    const transformedBudgets = budgets.map((budget: Record<string, unknown>) => ({
      id: String(budget.id ?? ''),
      date: String(budget.date ?? ''),
      category_name: String(budget.categoryName ?? budget.category_name ?? ''),
      category_id: String(budget.categoryId ?? budget.category_id ?? ''),
      subcategory_id: budget.subcategoryId ?? budget.subcategory_id ?? null,
      total_spent:
        typeof budget.totalSpent === 'string'
          ? parseFloat(budget.totalSpent) || 0
          : Number(budget.totalSpent ?? budget.total_spent ?? 0),
      amount_currency: String(budget.amountCurrency ?? budget.amount_currency ?? 'PHP'),
      amount: Number(budget.amount ?? budget.budget ?? 0),
      has_explicit_parent_budget: Boolean(
        budget.hasExplicitParentBudget ?? budget.has_explicit_parent_budget,
      ),
      parent_only_spent: Number(
        budget.parentOnlySpent ?? budget.parent_only_spent ?? 0,
      ),
      subcategories: Array.isArray(budget.subcategories)
        ? budget.subcategories.map((sub: Record<string, unknown>) => ({
            id: String(sub.id ?? ''),
            subcategoryId: String(sub.subcategoryId ?? sub.subcategory_id ?? ''),
            subcategoryName: String(
              sub.subcategoryName ?? sub.subcategory_name ?? sub.name ?? '',
            ),
            name: String(sub.subcategoryName ?? sub.subcategory_name ?? sub.name ?? ''),
            spent: Number(sub.spent ?? sub.total_spent ?? 0),
            budget: Number(sub.amount ?? sub.budget ?? 0),
          }))
        : [],
    }));

    const transformedSummary = summary
      ? {
          total_budget: summary.totalBudget ?? summary.total_budget ?? 0,
          total_spent: summary.totalSpent ?? summary.total_spent ?? 0,
          total_spent_percentage:
            summary.totalSpentPercentage ?? summary.total_spent_percentage ?? null,
          remaining: summary.remaining ?? 0,
        }
      : null;

    return {
      budgets: transformedBudgets,
      summary: transformedSummary,
      nextPage: null,
      totalPages: null,
      totalCount: null,
    };
  } catch (error) {
    console.error("Error fetching budgets page:", error);
    throw error;
  }
};

export const enrichCategoriesWithSubcategoryTree = (
  categories: BudgetCategory[],
  expenseOptions: CategoryTreeOption[],
): BudgetCategory[] => {
  return categories.map((category) => {
    if (!category.categoryId) {
      return category;
    }

    const parentOption = expenseOptions.find(
      (option) => option.id === category.categoryId,
    );

    if (!parentOption?.children?.length) {
      return category;
    }

    const existingBySubId = new Map(
      category.subcategories
        .filter((sub) => sub.subcategoryId)
        .map((sub) => [String(sub.subcategoryId), sub]),
    );

    const subcategories = parentOption.children.map((child) => {
      const existing = existingBySubId.get(child.id);

      if (existing) {
        return existing;
      }

      return {
        id: "",
        subcategoryId: child.id,
        subcategoryName: child.label,
        name: child.label,
        spent: 0,
        budget: 0,
      };
    });

    return {
      ...category,
      subcategories,
    };
  });
};

export const transformBudgetsToCategories = (
  budgets: Array<Record<string, unknown>>,
) => {
  if (budgets.length > 0 && budgets[0].subcategories) {
    return budgets.map((row) => mapBudgetRowToCategory(row));
  }

  const categoryMap = new Map<string, BudgetCategory>();

  budgets.forEach((budget) => {
    const categoryName = String(budget.category_name ?? '');
    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, {
        id: String(budget.id ?? ''),
        name: categoryName,
        spent: Number(budget.total_spent ?? 0),
        budget: Number(budget.amount ?? 0),
        color: getColor(categoryName),
        subcategories: [],
      });
    } else {
      const category = categoryMap.get(categoryName)!;
      category.spent = (category.spent || 0) + Number(budget.total_spent ?? 0);
      category.budget = (category.budget || 0) + Number(budget.amount ?? 0);
    }
  });

  return Array.from(categoryMap.values());
};

const mapBudgetRowToCategory = (row: Record<string, unknown>): BudgetCategory => {
  const categoryName = String(row.categoryName ?? row.category_name ?? '');
  const subcategories = Array.isArray(row.subcategories)
    ? row.subcategories.map((sub: Record<string, unknown>) => ({
        id: String(sub.id ?? ''),
        subcategoryId: String(sub.subcategoryId ?? sub.subcategory_id ?? ''),
        subcategoryName: String(sub.subcategoryName ?? sub.subcategory_name ?? sub.name ?? ''),
        name: String(sub.subcategoryName ?? sub.subcategory_name ?? sub.name ?? ''),
        spent: Number(sub.spent ?? sub.total_spent ?? 0),
        budget: Number(sub.budget ?? sub.amount ?? 0),
      }))
    : [];

  return {
    id: String(row.id ?? ''),
    name: categoryName,
    categoryId: String(row.categoryId ?? row.category_id ?? ''),
    hasExplicitParentBudget: Boolean(
      row.hasExplicitParentBudget ?? row.has_explicit_parent_budget,
    ),
    parentOnlySpent: Number(row.parentOnlySpent ?? row.parent_only_spent ?? 0),
    spent: Number(row.totalSpent ?? row.total_spent ?? 0),
    budget: Number(row.amount ?? row.budget ?? 0),
    color: getColor(categoryName),
    subcategories,
  };
};

/**
 * Returns category options that do not already have a parent budget in the fetched period.
 */
export const filterCategoryOptionsWithoutBudgets = <
  T extends { label: string; value: string; id?: string },
>(
  options: T[],
  budgets: Array<Record<string, unknown>> | undefined,
): T[] => {
  const usedParentCategoryIds = new Set(
    budgets
      ?.filter((budget) => !budget.subcategory_id && !budget.subcategoryId)
      .map((budget) => String(budget.category_id ?? budget.categoryId ?? ""))
      .filter(Boolean) ?? [],
  );

  const usedCategoryNames = new Set(
    budgets?.map((budget) => String(budget.category_name ?? budget.categoryName ?? "")) ?? [],
  );

  return options.filter((option) => {
    const categoryId = option.id ?? option.value;

    if (usedParentCategoryIds.has(categoryId)) {
      return false;
    }

    return !usedCategoryNames.has(option.value) && !usedCategoryNames.has(option.label);
  });
};

const getColor = (categoryName: string) => {
  const colors = [
    '#0A3D62', '#3c6382', '#60a3bc', '#0c2461',
    '#1e3799', '#4a69bd', '#6a89cc', '#82ccdd',
    '#b8e994', '#78e08f', '#3c40c6', '#575fcf'
  ];

  const hash = categoryName.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  return colors[hash % colors.length];
};
