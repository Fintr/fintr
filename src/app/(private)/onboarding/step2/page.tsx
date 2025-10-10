"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAtom, useSetAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingInput } from "@/components/ui/floating-input";
import { useOnboarding } from "@/hooks/async/useOnboarding";
import { BudgetCategory, BudgetCategoryInput } from "@/services/onboarding/mutations";
import { onboardingBudgetCategoriesAtom, onboardingTotalBudgetAtom } from "@/atoms/budgetAtoms";
import { onboardingDataAtom } from "@/atoms/onboardingAtoms";
import { numberFormatting } from "@/lib/utils";
import { toast } from "sonner";
import { Target, ArrowRight, ArrowLeft, X } from "lucide-react";

export default function OnboardingStep2() {
  const router = useRouter();
  const { saveStep2Data, isUpdating } = useOnboarding("budgets");
  
  // Use Jotai atoms for state management
  const [budgetCategories, setBudgetCategories] = useAtom(onboardingBudgetCategoriesAtom);
  const [totalBudget] = useAtom(onboardingTotalBudgetAtom);
  const [onboardingData, setOnboardingData] = useAtom(onboardingDataAtom);
  const [errors, setErrors] = useState<{ [key: number]: { name?: string; amount?: string } }>({});

  const validateForm = () => {
    const newErrors: { [key: number]: { name?: string; amount?: string } } = {};
    
    budgetCategories.forEach((category, index) => {
      const categoryErrors: { name?: string; amount?: string } = {};
      
      if (!category.name.trim()) {
        categoryErrors.name = "Category name is required";
      }
      
      if (!category.amount || isNaN(Number(category.amount)) || Number(category.amount) < 0) {
        categoryErrors.amount = "Please enter a valid amount";
      }
      
      if (Object.keys(categoryErrors).length > 0) {
        newErrors[index] = categoryErrors;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (validateForm()) {
      try {
        // Convert to BudgetCategoryInput (without percentage) for API
        const budgetCategoryInputs: BudgetCategoryInput[] = budgetCategories.map(category => ({
          name: category.name,
          amount: category.amount
        }));
        
        // Save step 2 data to backend
        await saveStep2Data({
          step: 'budgets',
          budgetCategories: budgetCategoryInputs,
        });
        
        // Navigate to next step on success
        router.push('/onboarding/step3');
      } catch (error) {
        console.error('Error saving step 2 data:', error);
        toast.error('Error saving budget categories. Please try again.');
      }
    }
  };

  const handleBack = () => {
    router.push('/onboarding/step1');
  };

  const updateCategory = (index: number, field: 'name' | 'amount', value: string) => {
    const updatedCategories = [...budgetCategories];
    if (field === 'amount') {
      // For amount field, use handleInputChange for formatting and store clean value
      const formattedValue = numberFormatting.handleInputChange(value);
      const cleanValue = numberFormatting.cleanForBackend(formattedValue);
      updatedCategories[index] = { ...updatedCategories[index], [field]: cleanValue.toString() };
      setDisplayAmounts(prev => ({ ...prev, [index]: formattedValue }));
    } else {
      updatedCategories[index] = { ...updatedCategories[index], [field]: value };
    }
    setBudgetCategories(updatedCategories);
  };

  // Display values for amount fields to handle formatting
  const [displayAmounts, setDisplayAmounts] = useState<{ [key: number]: string }>({});

  const deleteCategory = (index: number) => {
    const updatedCategories = budgetCategories.filter((_, i) => i !== index);
    setBudgetCategories(updatedCategories);
    
    // Clear any errors for this category
    const newErrors = { ...errors };
    delete newErrors[index];
    
    // Reindex errors for remaining categories
    const reindexedErrors: { [key: number]: { name?: string; amount?: string } } = {};
    Object.keys(newErrors).forEach(key => {
      const oldIndex = parseInt(key);
      if (oldIndex > index) {
        reindexedErrors[oldIndex - 1] = newErrors[oldIndex];
      } else if (oldIndex < index) {
        reindexedErrors[oldIndex] = newErrors[oldIndex];
      }
    });
    
    setErrors(reindexedErrors);
  };

  const addCategory = () => {
    const newCategory: BudgetCategory = {
      name: "",
      amount: "0",
      percentage: 0
    };
    setBudgetCategories([...budgetCategories, newCategory]);
  };

  // Calculate total income from step1
  const totalIncome = onboardingData.incomeData?.income || 0;

  const calculatePercentage = (amount: string): number => {
    const numAmount = Number(amount || 0);
    if (totalIncome === 0) return 0;
    return Math.round((numAmount / totalIncome) * 100);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Step 2 of 4</span>
            <span>Budget Setup</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all duration-500 ease-out w-2/4"></div>
          </div>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-primary/30 rounded-full w-fit">
              <Target className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Budget Set-Up</CardTitle>
            <CardDescription>
              Customize your monthly budget allocation across different spending categories
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Budget Categories List */}
            <div className="space-y-4">
              {/* Total budget summary */}
              <div className="bg-muted rounded-lg p-4 border border-border mt-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    Total Monthly Budget:
                  </span>
                  <span className="text-lg font-bold text-primary">
                    ₱{totalBudget.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Potential savings preview */}
              <div className="bg-muted rounded-lg p-4 border border-border mt-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    Potential Monthly Savings:
                  </span>
                  <span className="text-lg font-bold text-teal-600">
                    ₱{(totalIncome - totalBudget).toLocaleString()}
                  </span>
                </div>
              </div>

              {budgetCategories.map((category, index) => (
                <div key={index} className="border border-border rounded-lg p-4 space-y-4 bg-card relative">
                  {/* Delete button */}
                  {budgetCategories.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCategory(index)}
                      className="z-20 absolute top-2 right-2 h-6 w-6 p-0 bg-white text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <div className="space-y-3">
                    <div>
                      <FloatingInput
                        type="text"
                        label="Category Name"
                        value={category.name}
                        onChange={(e) => updateCategory(index, 'name', e.target.value)}
                        className={errors[index]?.name ? "border-destructive" : ""}
                      />
                      {errors[index]?.name && (
                        <p className="text-destructive text-sm mt-1">{errors[index].name}</p>
                      )}
                    </div>

                    <div>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <FloatingInput
                            type="text"
                            label="Amount (₱)"
                            value={displayAmounts[index] || numberFormatting.formatForInput(category.amount)}
                            onChange={(e) => updateCategory(index, 'amount', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className={errors[index]?.amount ? "border-destructive" : ""}
                          />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground bg-primary/30 px-2 py-1 rounded-full whitespace-nowrap">
                            {calculatePercentage(category.amount)}% of income
                          </span>
                        </div>
                      </div>
                      {errors[index]?.amount && (
                        <p className="text-destructive text-sm mt-1">{errors[index].amount}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new category button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={addCategory}
                className="border-dashed border-2 hover:border-primary hover:text-primary"
              >
                + Add New Category
              </Button>
            </div>

            
            {/* Action buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={handleBack}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <Button 
                onClick={handleNext}
                disabled={isUpdating}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {isUpdating ? "Saving..." : "Next"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            You can adjust these amounts based on your spending habits and financial goals
          </p>
        </div>
      </div>
    </div>
  );
}
