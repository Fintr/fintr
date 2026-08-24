"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { CustomModal } from "@/components/ui/custom-modal";
import { BudgetProgress } from "@/components/dashboard/insights/budget-usage-bar";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useTransactionCategories } from "@/hooks/async/useTransactionCategories";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
import {
  enrichCategoriesWithSubcategoryTree,
  findBudgetCategoryForParent,
  transformBudgetsToCategories,
} from "@/services/budgets/queries";
import { BudgetCategory } from "@/types/budgetTypes";
import { formatCurrency } from "@/lib/utils";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import { EditBudgetForm } from "@/components/dashboard/tabs/budgets/edit-budget-form";
import { CategoryTreeOption } from "@/types/categoryTreeTypes";

type CategoryBudgetSectionProps = {
  categoryId: string;
  categoryName: string;
  subcategoryOptions: CategoryTreeOption[];
  spaceCurrency: string;
};

const buildBudgetCategoryFromParent = (
  categoryId: string,
  categoryName: string,
  subcategoryOptions: CategoryTreeOption[],
  existing?: BudgetCategory,
): BudgetCategory => {
  if (existing) {
    return existing;
  }

  return {
    id: "",
    name: categoryName,
    categoryId,
    spent: 0,
    budget: 0,
    color: "#0A3D62",
    subcategories: subcategoryOptions.map((child) => ({
      id: "",
      subcategoryId: child.id,
      subcategoryName: child.label,
      name: child.label,
      spent: 0,
      budget: 0,
    })),
  };
};

const hasBudgetForMonth = (category: BudgetCategory): boolean => {
  if (category.id) {
    return true;
  }

  return category.subcategories.some((sub) => Boolean(sub.id));
};

export function CategoryBudgetSection({
  categoryId,
  categoryName,
  subcategoryOptions,
  spaceCurrency,
}: CategoryBudgetSectionProps) {
  const { firstDay, lastDay } = getCurrentMonthDates();

  const {
    data: budgetsData,
    isLoading,
    isError,
    updateBudgetMutation,
    createBudgetMutation,
  } = useBudgetsData(firstDay, lastDay);

  const { expenseCategoryOptions } = useTransactionCategories();
  const [editorOpen, setEditorOpen] = useState(false);

  const budgetCategory = useMemo(() => {
    if (!budgetsData?.budgets) {
      return buildBudgetCategoryFromParent(
        categoryId,
        categoryName,
        subcategoryOptions,
      );
    }

    const transformed = transformBudgetsToCategories(budgetsData.budgets);
    const enriched = enrichCategoriesWithSubcategoryTree(
      transformed,
      expenseCategoryOptions,
    );
    const found = findBudgetCategoryForParent(
      enriched,
      categoryId,
      categoryName,
    );

    return buildBudgetCategoryFromParent(
      categoryId,
      categoryName,
      subcategoryOptions,
      found,
    );
  }, [
    budgetsData?.budgets,
    categoryId,
    categoryName,
    subcategoryOptions,
    expenseCategoryOptions,
  ]);

  const hasBudget = hasBudgetForMonth(budgetCategory);

  let budgetPercentage = 0;
  let isItemOverBudget = false;

  if (budgetCategory.budget > 0) {
    budgetPercentage = (budgetCategory.spent / budgetCategory.budget) * 100;
    isItemOverBudget = budgetCategory.spent > budgetCategory.budget;
  } else if (budgetCategory.spent > 0) {
    budgetPercentage = 100;
    isItemOverBudget = true;
  }

  const handleSaveSuccess = () => {
    setEditorOpen(false);
  };

  const compactLabel = `${format(new Date(firstDay), "MMMM")} budget`;

  return (
    <section>
      {isLoading ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="small" />
        </div>
      ) : isError ? (
        <p className="text-sm text-red-900 dark:text-red-400">
          Could not load budget for this month.
        </p>
      ) : (
        <button
          type="button"
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left"
          aria-label={compactLabel}
          onClick={() => setEditorOpen(true)}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{compactLabel}</span>
            <span className="text-sm font-medium text-primary">
              {hasBudget ? (
                <>
                  <span
                    className={
                      isItemOverBudget
                        ? "text-[oklch(39.6%_0.141_25.723)]"
                        : "text-primary"
                    }
                  >
                    {formatCurrency(budgetCategory.spent, spaceCurrency)}
                  </span>
                  <span className="text-primary/70">
                    {" "}
                    / {formatCurrency(budgetCategory.budget, spaceCurrency)}
                  </span>
                </>
              ) : (
                <span className="text-primary">Set budget</span>
              )}
            </span>
          </div>
          {hasBudget ? (
            <BudgetProgress
              usagePercentage={budgetPercentage}
              className="mt-2 h-1.5 bg-muted"
            />
          ) : null}
        </button>
      )}

      <CustomModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title="Edit Budget"
        maxWidth="lg"
        className="p-0"
      >
        <div className="px-6 pb-6">
          {editorOpen ? (
            <EditBudgetForm
              budget={budgetCategory}
              budgetsData={budgetsData}
              updateBudgetMutation={updateBudgetMutation}
              createBudgetMutation={createBudgetMutation}
              budgetMonthDate={firstDay}
              spaceCurrency={spaceCurrency}
              hideCategory
              onCancel={() => setEditorOpen(false)}
              onSuccess={handleSaveSuccess}
            />
          ) : null}
        </div>
      </CustomModal>
    </section>
  );
}
