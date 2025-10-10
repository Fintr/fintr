"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAtom, useSetAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingInput } from "@/components/ui/floating-input";
import { PhilippinesTaxCalculator } from "@/components/ui/philippines-tax-calculator";
import { onboardingDataAtom, onboardingStepAtom } from "@/atoms/onboardingAtoms";
import { useOnboarding } from "@/hooks/async/useOnboarding";
import { numberFormatting } from "@/lib/utils";
import { toast } from "sonner";
import { PhilippinePeso, ArrowRight, ArrowLeft } from "lucide-react";

export default function OnboardingStep1() {
  const router = useRouter();
  const [onboardingData, setOnboardingData] = useAtom(onboardingDataAtom);
  const { saveStep1Data, isUpdating } = useOnboarding("income");
  
  const [income, setIncome] = useState<string>(
    onboardingData.incomeData?.income?.toString() || ""
  );
  const [displayIncome, setDisplayIncome] = useState<string>(
    numberFormatting.formatForInput(onboardingData.incomeData?.income || 0)
  );
  
  const [errors, setErrors] = useState<{ income?: string }>({});
  
  // Tax calculator integration
  const grossIncome = parseFloat(income) || 0;
  const [taxCalculation, setTaxCalculation] = useState({
    grossIncome: 0,
    sssContribution: 0,
    philhealthContribution: 0,
    pagibigContribution: 0,
    incomeTax: 0,
    totalDeductions: 0,
    netIncome: 0
  });
  
  // Deduction options state - set to true by default
  const [deductTaxes, setDeductTaxes] = useState(true);
  const [deductContributions, setDeductContributions] = useState(true);

  const handleIncomeChange = (value: string) => {
    const cleanValue = numberFormatting.cleanForBackend(value);
    setIncome(cleanValue.toString());
    setDisplayIncome(numberFormatting.formatForInput(cleanValue));
  };

  const validateForm = () => {
    const newErrors: { income?: string } = {};
    
    if (!income || isNaN(Number(income)) || Number(income) < 0) {
      newErrors.income = "Please enter a valid income amount";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (validateForm()) {
      try {
        // Update local onboarding data
        setOnboardingData({
          ...onboardingData,
          step: 'budgets',
          incomeData: {
            income: Number(income),
          },
        });
        
        // Calculate the amount to use based on deduction options
        let amountToUse = Number(income);
        
        // If deductions are enabled, use the net income from tax calculation
        if ((deductTaxes || deductContributions) && taxCalculation) {
          amountToUse = taxCalculation.netIncome;
        }
        
        // Save step 1 data to backend
        await saveStep1Data({
          step: 'income',
          income: amountToUse,
        });
        
        // Navigate to next step on success
        router.push('/onboarding/step2');
      } catch (error) {
        console.error('Error saving step 1 data:', error);
        toast.error('Error saving income data. Please try again.');
      }
    }
  };

  // Calculate total income for logic (use net income if deductions are enabled)
  const totalIncome = (deductTaxes || deductContributions) && taxCalculation ? taxCalculation.netIncome : (Number(income) || 0);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Step 1 of 4</span>
            <span>Income Setup</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all duration-500 ease-out w-1/4"></div>
          </div>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-primary/30 rounded-full w-fit">
              <PhilippinePeso className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Tell us about your income</CardTitle>
            <CardDescription>
              Enter your gross income, we'll deduct taxes and contributions to give you your take-home pay. 
              We'll use this to build a personalized budget and financial plan for you.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <FloatingInput
                  type="text"
                  label="Monthly Income (₱)"
                  value={displayIncome}
                  onChange={(e) => handleIncomeChange(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={errors.income ? "border-destructive" : ""}
                />
                {errors.income && (
                  <p className="text-destructive text-sm mt-1">{errors.income}</p>
                )}
              </div>
              
              {/* Deduction Options */}
              <div className="flex justify-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setDeductTaxes(!deductTaxes)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                    deductTaxes 
                      ? 'bg-primary text-white border border-primary shadow-md' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  Deduct Taxes
                </button>
                <button
                  type="button"
                  onClick={() => setDeductContributions(!deductContributions)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                    deductContributions 
                      ? 'bg-primary text-white border border-primary shadow-md' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  Deduct Contributions
                </button>
              </div>
            </div>

            {/* Tax Calculator */}
            {(deductTaxes || deductContributions) && (
              <div className="w-full animate-in slide-in-from-top-2 fade-in duration-300">
                <PhilippinesTaxCalculator 
                  grossIncome={grossIncome}
                  deductTaxes={deductTaxes}
                  deductContributions={deductContributions}
                  onCalculationChange={setTaxCalculation}
                  className="w-full"
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-center pt-4">
              <Button 
                onClick={handleNext}
                disabled={isUpdating}
                className="px-8 bg-primary hover:bg-primary/90"
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
            Don't worry, you can always update this information later in your dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
