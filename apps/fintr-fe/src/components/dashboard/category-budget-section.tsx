"use client";

import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useAtomValue } from "jotai";
import { expenseCategoryOptionsAtom } from "@/atoms/dashboardAtoms";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
import {
  enrichCategoriesWithSubcategoryTree,
  transformBudgetsToCategories,
} from "@/services/budgets/queries";
import { BudgetCategory } from "@/types/budgetTypes";
import { formatCurrency, getProgressColor } from "@/lib/utils";
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
  const monthLabel = format(new Date(firstDay), "MMMM yyyy");

  const {
    data: budgetsData,
    isLoading,
    isError,
    updateBudgetMutation,
    createBudgetMutation,
  } = useBudgetsData(firstDay, lastDay);

  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);
  const [isEditing, setIsEditing] = useState(false);

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
    const found = enriched.find((row) => row.categoryId === categoryId);

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

  const formattedItemPercentage = budgetPercentage.toFixed(1);

  const handleSaveSuccess = () => {
    setIsEditing(false);
  };

  return (
    <section className="space-y-3 rounded-lg border border-primary/10 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Budget
          </h2>
          <p className="text-xs text-muted-foreground">{monthLabel}</p>
        </div>
        {!isEditing && hasBudget ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner size="small" />
        </div>
      ) : isError ? (
        <p className="text-sm text-red-900">Could not load budget for this month.</p>
      ) : isEditing || !hasBudget ? (
        <EditBudgetForm
          budget={budgetCategory}
          budgetsData={budgetsData}
          updateBudgetMutation={updateBudgetMutation}
          createBudgetMutation={createBudgetMutation}
          budgetMonthDate={firstDay}
          spaceCurrency={spaceCurrency}
          hideCategory
          onCancel={hasBudget ? () => setIsEditing(false) : undefined}
          onSuccess={handleSaveSuccess}
        />
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm font-medium mb-2">
              <span className="text-primary">Total</span>
              <span>
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
                <span
                  className={`ml-2 ${getProgressColor(budgetPercentage, "font")}`}
                >
                  ({formattedItemPercentage}%)
                </span>
              </span>
            </div>
            <Progress
              value={budgetPercentage > 100 ? 100 : budgetPercentage}
              className="h-2 bg-gray-200"
              indicatorClassName={getProgressColor(budgetPercentage, "bg")}
            />
          </div>

          {budgetCategory.subcategories.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              {(budgetCategory.parentOnlySpent ?? 0) > 0 && (
                <div className="flex items-center justify-between text-sm pl-3">
                  <span className="font-medium text-primary/80">Parent only</span>
                  <span className="text-primary/70">
                    {formatCurrency(
                      budgetCategory.parentOnlySpent ?? 0,
                      spaceCurrency,
                    )}
                  </span>
                </div>
              )}
              {budgetCategory.subcategories.map((sub) => {
                const subPercentage =
                  sub.budget > 0
                    ? (sub.spent / sub.budget) * 100
                    : sub.spent > 0
                      ? 100
                      : 0;

                return (
                  <div key={sub.subcategoryId ?? sub.name} className="space-y-1 pl-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-primary/80">
                        {sub.subcategoryName ?? sub.name}
                      </span>
                      <span className="text-primary/70">
                        {sub.id ? (
                          <>
                            {formatCurrency(sub.spent, spaceCurrency)} /{" "}
                            {formatCurrency(sub.budget, spaceCurrency)}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Not set
                          </span>
                        )}
                      </span>
                    </div>
                    {sub.id ? (
                      <Progress
                        value={subPercentage > 100 ? 100 : subPercentage}
                        className="h-1.5 bg-gray-100"
                        indicatorClassName={getProgressColor(subPercentage, "bg")}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
