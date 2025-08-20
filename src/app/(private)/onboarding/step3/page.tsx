"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingInput } from "@/components/ui/floating-input";
import { FloatingSelect } from "@/components/ui/floating-select";
import { useOnboarding } from "@/hooks/async/useOnboarding";
import { onboardingAccountsDataAtom, onboardingAccountCategoriesAtom, AccountData, incomeRequirementsAtom } from "@/atoms/budgetAtoms";
import { onboardingDataAtom } from "@/atoms/onboardingAtoms";
import { toast } from "sonner";
import { CreditCard, ArrowRight, ArrowLeft, X } from "lucide-react";

export default function OnboardingStep3() {
  const router = useRouter();
  const { saveStep3Data, isUpdating, onboardingData } = useOnboarding("accounts");
  
  // Use Jotai atoms for state management
  const [accountsData, setAccountsData] = useAtom(onboardingAccountsDataAtom);
  const [accountCategories] = useAtom(onboardingAccountCategoriesAtom);
  const [incomeRequirements] = useAtom(incomeRequirementsAtom);
  const [errors, setErrors] = useState<{ [key: number]: { name?: string; accountCategory?: string; balance?: string } }>({});
  const [generalErrors, setGeneralErrors] = useState<{ salary?: string; business?: string }>({});

  const validateForm = () => {
    const newErrors: { [key: number]: { name?: string; accountCategory?: string; balance?: string } } = {};
    const newGeneralErrors: { salary?: string; business?: string } = {};
    
    accountsData.forEach((account, index) => {
      const accountErrors: { name?: string; accountCategory?: string; balance?: string } = {};
      
      if (!account.name.trim()) {
        accountErrors.name = "Account name is required";
      }
      
      if (!account.accountCategory) {
        accountErrors.accountCategory = "Account category is required";
      }
      
      if (isNaN(Number(account.balance)) || Number(account.balance) < 0) {
        accountErrors.balance = "Please enter a valid balance";
      }
      
      if (Object.keys(accountErrors).length > 0) {
        newErrors[index] = accountErrors;
      }
    });

    // Check if salary income account is required and selected (using atom instead of API data)
    if (incomeRequirements.salaryIncome) {
      const hasSalaryAccount = accountsData.some(account => account.forSalary);
      if (!hasSalaryAccount) {
        newGeneralErrors.salary = "Please select an account to receive your salary income";
      }
    }

    // Check if business income account is required and selected (using atom instead of API data)
    if (incomeRequirements.businessIncome) {
      const hasBusinessAccount = accountsData.some(account => account.forBusiness);
      if (!hasBusinessAccount) {
        newGeneralErrors.business = "Please select an account to receive your business income";
      }
    }
    
    setErrors(newErrors);
    setGeneralErrors(newGeneralErrors);
    
    return Object.keys(newErrors).length === 0 && Object.keys(newGeneralErrors).length === 0;
  };

  const handleNext = async () => {
    if (validateForm()) {
      try {
        // Filter out false boolean attributes before sending to backend
        const processedAccountsData = accountsData.map(account => {
          const processedAccount: any = {
            name: account.name,
            accountCategory: account.accountCategory,
            balance: account.balance
          };
          
          // Only include boolean attributes if they're true
          if (account.forSalary) {
            processedAccount.forSalary = true;
          }
          if (account.forBusiness) {
            processedAccount.forBusiness = true;
          }
          
          return processedAccount;
        });
        
        // Save step 3 data to backend
        await saveStep3Data({
          step: 'accounts',
          accounts: processedAccountsData,
        });
        
        // Navigate to completion or dashboard on success
        router.push('/onboarding/completed');
      } catch (error) {
        console.error('Error saving step 3 data:', error);
        toast.error('Error saving accounts. Please try again.');
      }
    } else {
      // Show toast when validation fails
      toast.error('Please fix the errors before continuing.');
    }
  };

  const handleBack = () => {
    router.push('/onboarding/step2');
  };

  const updateAccount = (index: number, field: 'name' | 'accountCategory' | 'balance' | 'forSalary' | 'forBusiness', value: string | number | boolean) => {
    const updatedAccounts = [...accountsData];
    updatedAccounts[index] = { ...updatedAccounts[index], [field]: value };
    setAccountsData(updatedAccounts);
  };

  const deleteAccount = (index: number) => {
    const updatedAccounts = accountsData.filter((_, i) => i !== index);
    setAccountsData(updatedAccounts);
    
    // Clear any errors for this account
    const newErrors = { ...errors };
    delete newErrors[index];
    
    // Reindex errors for remaining accounts
    const reindexedErrors: { [key: number]: { name?: string; accountCategory?: string; balance?: string } } = {};
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

  const addAccount = () => {
    const newAccount: AccountData = {
      name: "",
      accountCategory: "",
      balance: 0,
      forSalary: false,
      forBusiness: false
    };
    setAccountsData([...accountsData, newAccount]);
  };

  const handleSalaryAccountSelection = (selectedIndex: number) => {
    const updatedAccounts = accountsData.map((account, index) => ({
      ...account,
      forSalary: index === selectedIndex ? !account.forSalary : false
    }));
    setAccountsData(updatedAccounts);
    
    // Clear salary error if an account is now selected
    if (updatedAccounts.some(account => account.forSalary)) {
      setGeneralErrors(prev => ({ ...prev, salary: undefined }));
    }
  };

  const handleBusinessAccountSelection = (selectedIndex: number) => {
    const updatedAccounts = accountsData.map((account, index) => ({
      ...account,
      forBusiness: index === selectedIndex ? !account.forBusiness : false
    }));
    setAccountsData(updatedAccounts);
    
    // Clear business error if an account is now selected
    if (updatedAccounts.some(account => account.forBusiness)) {
      setGeneralErrors(prev => ({ ...prev, business: undefined }));
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Step 3 of 4</span>
            <span>Accounts Setup</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all duration-500 ease-out w-3/4"></div>
          </div>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Accounts Set-Up</CardTitle>
            <CardDescription>
              Add your bank accounts, cards, and other financial accounts <br /> <br />
              Click the account/s where your salary and/or business income comes in. Fintr will automatically add it every 1st of the month, so you don’t have to.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Accounts List */}
            <div className="space-y-4">
              {accountsData.map((account, index) => (
                <div key={index} className="border border-border rounded-lg p-4 space-y-4 bg-card relative">
                  {/* Delete button */}
                  {accountsData.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAccount(index)}
                      className="z-20 absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground bg-white hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <div className="space-y-3">
                    {/* First row: Account Name and Category */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FloatingInput
                          type="text"
                          label="Account Name"
                          value={account.name}
                          onChange={(e) => updateAccount(index, 'name', e.target.value)}
                          className={errors[index]?.name ? "border-destructive" : ""}
                        />
                        {errors[index]?.name && (
                          <p className="text-destructive text-sm mt-1">{errors[index].name}</p>
                        )}
                      </div>

                      <div>
                        <FloatingSelect
                          label="Account Category"
                          value={account.accountCategory}
                          onValueChange={(value) => updateAccount(index, 'accountCategory', value)}
                          options={accountCategories}
                          className={errors[index]?.accountCategory ? "border-destructive" : ""}
                        />
                        {errors[index]?.accountCategory && (
                          <p className="text-destructive text-sm mt-1">{errors[index].accountCategory}</p>
                        )}
                      </div>
                    </div>

                    {/* Second row: Balance and Account Type */}
                    <div className="space-y-3">
                      <div className="flex gap-3 items-start">
                        <div className="flex-1">
                          <FloatingInput
                            type="number"
                            label="Balance (₱)"
                            value={account.balance.toString()}
                            onChange={(e) => updateAccount(index, 'balance', Number(e.target.value))}
                            min="0"
                            step="0.01"
                            className={errors[index]?.balance ? "border-destructive" : ""}
                          />
                          {errors[index]?.balance && (
                            <p className="text-destructive text-sm mt-1">{errors[index].balance}</p>
                          )}
                        </div>
                        
                        {/* Account Type Pills */}
                        <div className="flex gap-2 flex-wrap pt-3">
                          <button
                            type="button"
                            onClick={() => handleSalaryAccountSelection(index)}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all duration-200 ${
                              account.forSalary
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            For Salary
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleBusinessAccountSelection(index)}
                            className={`px-3 py-1.5 text-xs rounded-full border transition-all duration-200 ${
                              account.forBusiness
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            For Business
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* General error messages for required account assignments */}
            {(generalErrors.salary || generalErrors.business) && (
              <div className="space-y-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                {generalErrors.salary && (
                  <p className="text-destructive text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-destructive rounded-full"></span>
                    {generalErrors.salary}
                  </p>
                )}
                {generalErrors.business && (
                  <p className="text-destructive text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-destructive rounded-full"></span>
                    {generalErrors.business}
                  </p>
                )}
              </div>
            )}

            {/* Add new account button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={addAccount}
                className="border-dashed border-2 hover:border-primary hover:text-primary"
              >
                + Add New Account
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
                className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
              >
                {isUpdating ? "Completing..." : "Complete Setup"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            You can add more accounts later from your dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
