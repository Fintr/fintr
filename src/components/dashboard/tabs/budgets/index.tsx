import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Trash2, Calendar } from "lucide-react";
import { transformBudgetsToCategories } from "@/services/budgets/queries";
import { z } from "zod";
import { formatCurrency } from "@/lib/utils";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
import { NewBudgetDialog } from "./new-budget-dialog";
import { EditBudgetDialog } from "./edit-budget-dialog";
interface BudgetsTabProps {}

const BudgetsTab = ({}: BudgetsTabProps) => {
  // Budget state
  const [budgetDate, setBudgetDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // Format: YYYY-MM-DD
  });
  const [appliedDateFilter, setAppliedDateFilter] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // Format: YYYY-MM-DD
  });
  const formattedDate = new Date(budgetDate).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const {
    data: budgetsData,
    isLoading,
    isError,
    updateBudgetMutation,
    createBudgetMutation,
    deleteBudgetMutation
  } = useBudgetsData(appliedDateFilter);

  // Calculate budget stats
  const budgetSummary = budgetsData?.summary;
  const totalBudget = budgetSummary?.total_budget ?? 0;
  const totalSpent = budgetSummary?.total_spent ?? 0;
  const totalRemaining = budgetSummary?.remaining ?? 0;
  // Provide a fallback for total_spent_percentage if it's null and totalBudget is 0 to avoid NaN
  const budgetUsagePercentage =
    budgetSummary?.total_spent_percentage ??
    (totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0);
  const isOverBudget = budgetUsagePercentage > 100;
  // Ensure formattedBudgetPercentage is not NaN if budgetUsagePercentage is NaN (e.g. 0/0)
  const formattedBudgetPercentage = Number(
    isNaN(budgetUsagePercentage) ? 0 : budgetUsagePercentage
  ).toFixed(1);
  const categories = budgetsData?.budgets
    ? transformBudgetsToCategories(budgetsData.budgets)
    : [];

  // Handle date change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBudgetDate(e.target.value);
  };

  // Handle applying filters
  const handleApplyFilters = (budgetDateFilter: string) => {
    setAppliedDateFilter(budgetDateFilter);
  };

  // Handle budget deletion
  const handleDeleteBudget = (index: number) => {
    deleteBudgetMutation.mutate(categories[index].id);
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Monthly Budget</CardTitle>
          <CardDescription>
            Track your spending against budget limits
          </CardDescription>
        </div>
        <NewBudgetDialog
          budgetsData={budgetsData}
          createBudgetMutation={createBudgetMutation}
        />
      </CardHeader>
      <CardContent>
        {/* Budget Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Budget Filters</CardTitle>
            <CardDescription>Customize your budget view</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="space-y-2 md:w-1/2">
                <Label>Budget Month</Label>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Input
                      type="date"
                      value={budgetDate}
                      onChange={handleDateChange}
                      className="pl-10"
                    />
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  </div>
                  <div className="text-sm font-medium">{formattedDate}</div>
                </div>
              </div>

              <div className="md:self-end">
                <Button
                  className="bg-primary hover:bg-primary/80 w-full"
                  onClick={() => handleApplyFilters(budgetDate)}
                  disabled={isLoading}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Budget Summary</CardTitle>
            <CardDescription>Overview of your budget status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-4 text-center">Loading budget data...</div>
            ) : isError ? (
              <div className="py-4 text-center text-red-500">
                Error loading budget data. Please try again.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Total Budget
                  </h4>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(totalBudget)}
                  </div>
                </div>
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Total Spent
                  </h4>
                  <div className="flex items-center">
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(totalSpent)}
                    </div>
                    <div className="ml-2 text-sm font-medium text-primary">
                      ({formattedBudgetPercentage}%)
                    </div>
                  </div>
                  <Progress
                    value={
                      budgetUsagePercentage > 100 ? 100 : budgetUsagePercentage
                    }
                    className="h-2 mt-2 bg-gray-200"
                    indicatorClassName={
                      isOverBudget ? "bg-[#800020]" : "bg-primary"
                    }
                  />
                </div>
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Remaining
                  </h4>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(totalRemaining)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {isLoading ? (
            <div className="py-4 text-center">Loading categories...</div>
          ) : (
            categories.map((category, index) => {
              // Calculate percentage for each budget item
              let budgetPercentage: number;
              let isItemOverBudget: boolean;

              if (category.budget > 0) {
                budgetPercentage = (category.spent / category.budget) * 100;
                isItemOverBudget = category.spent > category.budget;
              } else {
                // category.budget is 0 or less
                if (category.spent > 0) {
                  budgetPercentage = 100; // Fill the bar completely as it's over the zero budget
                  isItemOverBudget = true; // Clearly over budget
                } else {
                  budgetPercentage = 0; // 0 spent, 0 budget
                  isItemOverBudget = false;
                }
              }
              const formattedItemPercentage = budgetPercentage.toFixed(1);

              return (
                <div
                  key={index}
                  className="p-4 border rounded-lg space-y-4 bg-white"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-primary">
                        {category.name}
                      </h3>
                      <div className="flex items-center space-x-4">
                        <div className="text-sm font-medium">
                          <span
                            className={
                              isItemOverBudget
                                ? "text-[#800020]"
                                : "text-primary"
                            }
                          >
                            {formatCurrency(category.spent)}
                          </span>
                          <span className="text-primary/70">
                            {" "}
                            / {formatCurrency(category.budget)}
                          </span>
                          <span className="ml-2 text-primary">
                            ({formattedItemPercentage}%)
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <EditBudgetDialog
                            budget={category}
                            updateBudgetMutation={updateBudgetMutation}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600"
                            onClick={() => handleDeleteBudget(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <Progress
                      value={budgetPercentage > 100 ? 100 : budgetPercentage}
                      className="h-2 bg-gray-200"
                      indicatorClassName={
                        isItemOverBudget ? "bg-[#800020]" : "bg-primary"
                      }
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetsTab;
