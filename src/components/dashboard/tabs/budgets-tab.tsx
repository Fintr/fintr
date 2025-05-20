import React, { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBudgetsPage, transformBudgetsToCategories } from "@/services/budgets/queries";
import { updateBudget, UpdateBudgetPayload } from "@/services/budgets/mutations";
import { useAuthApi } from "@/hooks/useAuthApi";
import { BudgetCategory } from "@/types/budgetTypes";
import { z } from "zod";

interface BudgetsTabProps {
  formatCurrency: (amount: number) => string;
}

const newBudgetSchema = z.object({
  category: z.string().min(1, "Category is required"),
  amount: z.string().min(1, "Amount is required")
    .refine(val => !isNaN(parseFloat(val)), "Amount must be a number")
    .refine(val => parseFloat(val) > 0, "Amount must be greater than 0")
});

type NewBudgetFormData = z.infer<typeof newBudgetSchema>;

const BudgetsTab = ({ formatCurrency }: BudgetsTabProps) => {
  // Auth API hook
  const { api, isAuthenticated } = useAuthApi();
  const queryClient = useQueryClient();

  // Budget state
  const [budgetDate, setBudgetDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  });
  const [formattedDate, setFormattedDate] = useState<string>("");
  const [categories, setCategories] = useState<BudgetCategory[]>([]);

  // Form state
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [newBudgetCategory, setNewBudgetCategory] = useState("");
  const [newBudgetAmount, setNewBudgetAmount] = useState("");
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [customCategoryColor, setCustomCategoryColor] = useState("#008080");
  const [editingBudgetIndex, setEditingBudgetIndex] = useState<number | null>(null);
  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<NewBudgetFormData>>({});

  // Update formatted date when budgetDate changes
  useEffect(() => {
    if (budgetDate) {
      try {
        const date = new Date(budgetDate);
        setFormattedDate(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
      } catch (error) {
        console.error("Error formatting date:", error);
        setFormattedDate("");
      }
    }
  }, [budgetDate]);

  // Fetch budgets data with React Query
  const spaceCode = localStorage.getItem('spaceCode') || '';
  const { data: budgetsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['budgets', spaceCode, budgetDate],
    queryFn: async () => {
      if (!isAuthenticated) return { budgets: [], summary: null, nextPage: null, totalPages: 0, totalCount: 0 };
      return await fetchBudgetsPage(api, {
        queryKey: ['budgets', spaceCode, budgetDate],
      });
    },
    enabled: isAuthenticated && Boolean(spaceCode),
  });

  // Calculate budget stats
  const budgetSummary = budgetsData?.summary;
  const totalBudget = budgetSummary?.total_budget ?? 0;
  const totalSpent = budgetSummary?.total_spent ?? 0;
  const totalRemaining = budgetSummary?.remaining ?? 0;
  // Provide a fallback for total_spent_percentage if it's null and totalBudget is 0 to avoid NaN
  const budgetUsagePercentage = budgetSummary?.total_spent_percentage ?? 
    (totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0);
  const isOverBudget = budgetUsagePercentage > 100;
  // Ensure formattedBudgetPercentage is not NaN if budgetUsagePercentage is NaN (e.g. 0/0)
  const formattedBudgetPercentage = Number(isNaN(budgetUsagePercentage) ? 0 : budgetUsagePercentage).toFixed(1);
  
  // Mutation for updating a budget
  const updateBudgetMutation = useMutation({
    mutationFn: (variables: { budgetId: string; data: UpdateBudgetPayload }) => 
      updateBudget(api, variables.budgetId, variables.data),
    onSuccess: (data, variables) => {
      console.log('Update Budget Mutation onSuccess: Data received from PUT:', data);
      console.log('Update Budget Mutation onSuccess: Invalidating queries for:', ['budgets', spaceCode, budgetDate]);
      queryClient.invalidateQueries({ queryKey: ['budgets', spaceCode, budgetDate] });
    },
    onError: (error) => {
      console.error("Error updating budget:", error);
      // Optionally, display an error toast/notification here
    },
  });

  // Transform and update budget categories when data changes
  useEffect(() => {
    console.log('BudgetsTab useEffect triggered. budgetsData:', budgetsData);
    if (budgetsData?.budgets) {
      console.log('BudgetsTab useEffect: Transforming budgetsData.budgets:', budgetsData.budgets);
      const transformedCategories = transformBudgetsToCategories(budgetsData.budgets);
      console.log('BudgetsTab useEffect: Setting categories:', transformedCategories);
      setCategories(transformedCategories);
    } else {
      console.log('BudgetsTab useEffect: budgetsData.budgets is undefined or null.');
    }
  }, [budgetsData]);

  // Handle date change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBudgetDate(e.target.value);
  };

  // Handle applying filters
  const handleApplyFilters = () => {
    refetch();
  };

  // Validate form input
  const validateForm = (): boolean => {
    try {
      newBudgetSchema.parse({
        category: customCategoryName || newBudgetCategory,
        amount: newBudgetAmount
      });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors: Partial<NewBudgetFormData> = {};
        error.errors.forEach(err => {
          const path = err.path[0] as keyof NewBudgetFormData;
          formattedErrors[path] = err.message;
        });
        setErrors(formattedErrors);
      }
      return false;
    }
  };

  // Handle budget form submission
  const handleBudgetSubmit = async () => {
    if (!validateForm()) return;

    const amount = parseFloat(newBudgetAmount);

    if (editingBudgetIndex !== null) {
      // This is an update to an existing budget
      const budgetToEdit = categories[editingBudgetIndex];
      if (!budgetToEdit || !budgetToEdit.id) {
        console.error("Budget to edit not found or has no ID.");
        // Handle error appropriately, maybe show a toast
        return;
      }
      
      const payload: UpdateBudgetPayload = { amount };
      updateBudgetMutation.mutate({ budgetId: budgetToEdit.id, data: payload });

    } else {
      // This is a new budget creation
      // TODO: This section should ideally also use an API call (e.g., createBudget)
      // For now, it uses Supabase directly as per existing code.
      try {
        let categoryId;
        // Handle custom category
        if (customExpenseCategories.includes(newBudgetCategory)) {
          const categoryResult = await supabase
            .from("categories")
            .insert([
              {
                name: customCategoryName,
                color: customCategoryColor,
                user_id: "current-user-id", // Replace with actual user ID
              },
            ])
            .select();

          if (categoryResult.error) throw categoryResult.error;
          categoryId = categoryResult.data[0].id;
        } else {
          categoryId = newBudgetCategory; // This assumes newBudgetCategory holds an ID for existing categories
        }

        // Save the budget via Supabase
        await supabase
          .from("budgets")
          .insert([
            {
              user_id: "current-user-id", // Replace with actual user ID
              category_id: categoryId,
              amount: amount,
              period: "monthly", // Assuming monthly, might need to be dynamic
              start_date: new Date(budgetDate).toISOString().split("T")[0], // Use budgetDate for start_date
              end_date: null, // Or calculate based on period
            },
          ])
          .select();
        
        // Refetch data after Supabase insert for new budgets
        refetch();

      } catch (error) {
        console.error("Error saving new budget via Supabase:", error);
        // Handle Supabase error (e.g., show toast)
      }
    }

    // Reset form irrespective of create or update, after mutation is triggered or Supabase call initiated
    setShowBudgetForm(false);
    setNewBudgetCategory("");
    setNewBudgetAmount("");
    setShowCustomCategoryInput(false);
    setCustomCategoryName("");
    setEditingBudgetIndex(null);
    setErrors({}); // Clear previous form errors

    // refetch() is handled by onSuccess of mutation for updates, 
    // and explicitly called for new budgets after supabase insert.
  };

  // Handle budget deletion
  const handleDeleteBudget = (index: number) => {
    const updatedCategories = [...categories];
    updatedCategories.splice(index, 1);
    setCategories(updatedCategories);
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
        <div className="flex items-center space-x-2">
          <Button
            className="bg-[#0A3D62] hover:bg-[#0A3D62]/80"
            onClick={() => setShowBudgetForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Budget
          </Button>
        </div>
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
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500"/>
                  </div>
                  <div className="text-sm font-medium">
                    {formattedDate}
                  </div>
                </div>
              </div>

              <div className="md:self-end">
                <Button 
                  className="bg-[#0A3D62] hover:bg-[#0A3D62]/80 w-full"
                  onClick={handleApplyFilters}
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
              <div className="py-4 text-center text-red-500">Error loading budget data. Please try again.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-[#0A3D62]/70 mb-1">
                    Total Budget
                  </h4>
                  <div className="text-2xl font-bold text-[#0A3D62]">
                    {formatCurrency(totalBudget)}
                  </div>
                </div>
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-[#0A3D62]/70 mb-1">
                    Total Spent
                  </h4>
                  <div className="flex items-center">
                    <div className="text-2xl font-bold text-[#0A3D62]">
                      {formatCurrency(totalSpent)}
                    </div>
                    <div className="ml-2 text-sm font-medium text-[#0A3D62]">
                      ({formattedBudgetPercentage}%)
                    </div>
                  </div>
                  <Progress
                    value={
                      budgetUsagePercentage > 100 ? 100 : budgetUsagePercentage
                    }
                    className="h-2 mt-2 bg-gray-200"
                    indicatorClassName={
                      isOverBudget ? "bg-[#800020]" : "bg-[#0A3D62]"
                    }
                  />
                </div>
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-[#0A3D62]/70 mb-1">
                    Remaining
                  </h4>
                  <div className="text-2xl font-bold text-[#0A3D62]">
                    {formatCurrency(totalRemaining)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {showBudgetForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold text-[#0A3D62] mb-4">
                {editingBudgetIndex !== null ? "Update Budget" : "Create New Budget"}
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="budget-category">Category</Label>
                  <Select
                    value={newBudgetCategory}
                    onValueChange={(value) => {
                      if (value === "add_category") {
                        setShowCustomCategoryInput(true);
                        setNewBudgetCategory("");
                      } else {
                        setShowCustomCategoryInput(false);
                        setNewBudgetCategory(value);
                      }
                    }}
                    disabled={editingBudgetIndex !== null}
                  >
                    <SelectTrigger id="budget-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {editingBudgetIndex !== null ? (
                        <SelectItem value={newBudgetCategory} disabled>
                          {newBudgetCategory} 
                        </SelectItem>
                      ) : (
                        <>
                          <SelectItem value="myself">Myself</SelectItem>
                          <SelectItem value="family">Family</SelectItem>
                          <SelectItem value="insurance">Insurance</SelectItem>
                          <SelectItem value="home">Home</SelectItem>
                          <SelectItem value="utilities">Utilities</SelectItem>
                          <SelectItem value="food">Food</SelectItem>
                          <SelectItem value="transport">Transport</SelectItem>
                          <SelectItem value="pet">Pet</SelectItem>
                          <SelectItem value="subscriptions">
                            Subscriptions
                          </SelectItem>
                          <SelectItem value="going-out">Going Out</SelectItem>
                          <SelectItem value="travel">Travel</SelectItem>
                          <SelectItem value="shopping">Shopping</SelectItem>
                          {customExpenseCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                          <SelectItem value="add_category">
                            + Add Expense Category
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p className="text-sm text-red-500 mt-1">{errors.category}</p>
                  )}
                </div>

                {showCustomCategoryInput && editingBudgetIndex === null && (
                  <div className="mt-2">
                    <Input
                      placeholder="Enter new expense category"
                      value={customCategoryName}
                      onChange={(e) => setCustomCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          customCategoryName.trim() !== ""
                        ) {
                          setCustomExpenseCategories([
                            ...customExpenseCategories,
                            customCategoryName,
                          ]);
                          setNewBudgetCategory(customCategoryName);
                          setCustomCategoryName("");
                          setShowCustomCategoryInput(false);
                        }
                      }}
                    />
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCustomCategoryInput(false);
                          setCustomCategoryName("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (customCategoryName.trim() !== "") {
                            setCustomExpenseCategories([
                              ...customExpenseCategories,
                              customCategoryName,
                            ]);
                            setNewBudgetCategory(customCategoryName);
                            setCustomCategoryName("");
                            setShowCustomCategoryInput(false);
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="budget-amount">Budget Amount</Label>
                  <Input
                    id="budget-amount"
                    type="number"
                    placeholder="0.00"
                    value={newBudgetAmount}
                    onChange={(e) => setNewBudgetAmount(e.target.value)}
                  />
                  {errors.amount && (
                    <p className="text-sm text-red-500 mt-1">{errors.amount}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBudgetForm(false);
                    setErrors({});
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#0A3D62] hover:bg-[#0A3D62]/80"
                  onClick={handleBudgetSubmit}
                >
                  {editingBudgetIndex !== null ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </div>
        )}

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
              } else { // category.budget is 0 or less
                if (category.spent > 0) {
                  budgetPercentage = 100; // Fill the bar completely as it's over the zero budget
                  isItemOverBudget = true;   // Clearly over budget
                } else {
                  budgetPercentage = 0;    // 0 spent, 0 budget
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
                      <h3 className="font-medium text-[#0A3D62]">
                        {category.name}
                      </h3>
                      <div className="flex items-center space-x-4">
                        <div className="text-sm font-medium">
                          <span
                            className={
                              isItemOverBudget
                                ? "text-[#800020]"
                                : "text-[#0A3D62]"
                            }
                          >
                            {formatCurrency(category.spent)}
                          </span>
                          <span className="text-[#0A3D62]/70">
                            {" "}
                            / {formatCurrency(category.budget)}
                          </span>
                          <span className="ml-2 text-[#0A3D62]">
                            ({formattedItemPercentage}%)
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#0A3D62] hover:bg-blue-50"
                            onClick={() => {
                              setEditingBudgetIndex(index);
                              setNewBudgetCategory(category.name);
                              setNewBudgetAmount(category.budget.toString());
                              setCustomCategoryColor(category.color);
                              setShowCustomCategoryInput(false);
                              setErrors({});
                              setShowBudgetForm(true);
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </Button>
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
                        isItemOverBudget ? "bg-[#800020]" : "bg-[#0A3D62]"
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
