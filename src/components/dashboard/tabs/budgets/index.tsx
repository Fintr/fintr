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
import { Progress } from "@/components/ui/progress";
import { Trash2, CalendarIcon, Filter } from "lucide-react";
import { transformBudgetsToCategories } from "@/services/budgets/queries";
import { z } from "zod";
import { formatCurrency, getProgressColor } from "@/lib/utils";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
import { NewBudgetDialog } from "./new-budget-dialog";
import { EditBudgetDialog } from "./edit-budget-dialog";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

interface BudgetsTabProps {}

const BudgetsTab = ({}: BudgetsTabProps) => {
  // Budget state
  const [showFilters, setShowFilters] = useState(false);
  const [budgetDate, setBudgetDate] = useState<Date | undefined>(() => {
    const today = new Date();
    return today; 
  });
  const [appliedDateFilter, setAppliedDateFilter] = useState<string>(() => {
    const today = new Date();
    return format(today, "yyyy-MM-dd"); 
  });
  const formattedDate = budgetDate ? format(budgetDate, "MMMM yyyy") : "Pick a date";

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

  // Handle date change (for the date picker)
  const handleDateSelect = (date: Date | undefined) => {
    setBudgetDate(date);
  };

  // Handle applying filters
  const handleApplyFilters = () => {
    if (budgetDate) {
      setAppliedDateFilter(format(budgetDate, "yyyy-MM-dd"));
    }
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
        <div className="flex items-end flex-col md:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 bg-white text-primary"
          >
            <Filter className="h-4 w-4" />
            <div className="hidden md:flex">
              {showFilters ? "Hide" : "Show"} Filters
            </div>
          </Button>
          <NewBudgetDialog
            budgetsData={budgetsData}
            createBudgetMutation={createBudgetMutation}
          />
        </div>
      </CardHeader>
      <CardContent>
        {/* Budget Filters */}
        {showFilters && (
          <Card className="mb-6">
            <CardHeader className="px-4">
              <CardTitle>Budget Filters</CardTitle>
              <CardDescription>Customize your budget view</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="space-y-2 flex-1">
                  <Label>Budget Month</Label>
                  <div className="flex items-center gap-6 flex-col md:flex-row items-start md:items-center">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className="w-[250px] justify-start text-left font-normal text-sm"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {budgetDate ? (
                            format(budgetDate, "MMMM d, yyyy")
                          ) : (
                            <span className="text-sm">Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={budgetDate}
                          onSelect={handleDateSelect}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <div className="text-sm font-medium">
                      {formattedDate}
                    </div>
                    <div className="md:self-end">
                      <Button
                        className="bg-primary hover:bg-primary/80 w-full"
                        onClick={handleApplyFilters}
                        disabled={isLoading}
                      >
                        Apply Filters
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Budget Summary */}
        <Card className="mb-6">
          <CardHeader className="px-4">
            <CardTitle>Budget Summary</CardTitle>
            <CardDescription>Overview of your budget status</CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            {isError ? (
              <div className="py-4 text-center bg-red-800">
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
                    <div className={`ml-2 text-sm font-medium ${getProgressColor(budgetUsagePercentage, "font")}`}>
                      ({formattedBudgetPercentage}%)
                    </div>
                  </div>
                  <Progress
                    value={budgetUsagePercentage}
                    className="h-2 mt-2 bg-gray-200"
                    indicatorClassName={getProgressColor(budgetUsagePercentage, "bg")}
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
            <div className="py-4 text-center">
              <LoadingSpinner size="medium" />
            </div>
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
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
                      <div className="flex items-center justify-between w-full md:w-auto">
                        <h3 className="font-medium text-primary truncate max-w-[200px] md:max-w-[300px]">
                          {category.name}
                        </h3>
                        <div className="flex space-x-2 md:hidden">
                          <EditBudgetDialog
                            budget={category}
                            updateBudgetMutation={updateBudgetMutation}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-delete"
                            onClick={() => handleDeleteBudget(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-2 md:mt-0 flex items-center justify-between md:justify-end w-full">
                        <div className="text-sm font-medium md:mr-4">
                          <span
                            className={
                              isItemOverBudget
                                ? "text-[var(--red-900)]"
                                : "text-primary"
                            }
                          >
                            {formatCurrency(category.spent)}
                          </span>
                          <span className="text-primary/70">
                            {" "}
                            / {formatCurrency(category.budget)}
                          </span>
                          <span className={`ml-2 ${getProgressColor(budgetPercentage, "font")}`}>
                            ({formattedItemPercentage}%)
                          </span>
                        </div>
                        <div className="hidden md:flex space-x-2">
                          <EditBudgetDialog
                            budget={category}
                            updateBudgetMutation={updateBudgetMutation}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-delete"
                            onClick={() => handleDeleteBudget(index)}
                          >
                            <Trash2 className="h-4 w-4 delete-icon" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <Progress
                      value={budgetPercentage > 100 ? 100 : budgetPercentage}
                      className="h-2 bg-gray-200"
                      indicatorClassName={
                        getProgressColor(budgetPercentage, "bg")
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
