"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAtom, useSetAtom } from "jotai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingInput } from "@/components/ui/floating-input";
import { onboardingDataAtom, onboardingStepAtom } from "@/atoms/onboardingAtoms";
import { useOnboarding } from "@/hooks/async/useOnboarding";
import { toast } from "sonner";
import { PhilippinePeso, ArrowRight, ArrowLeft } from "lucide-react";

export default function OnboardingStep1() {
  const router = useRouter();
  const [onboardingData, setOnboardingData] = useAtom(onboardingDataAtom);
  const { saveStep1Data, isUpdating } = useOnboarding("income");
  
  const [salary, setSalary] = useState<string>(
    onboardingData.incomeData?.salary?.toString() || ""
  );
  const [business, setBusiness] = useState<string>(
    onboardingData.incomeData?.business?.toString() || ""
  );
  
  const [errors, setErrors] = useState<{ salary?: string; business?: string }>({});

  const validateForm = () => {
    const newErrors: { salary?: string; business?: string } = {};
    
    if (!salary || isNaN(Number(salary)) || Number(salary) < 0) {
      newErrors.salary = "Please enter a valid salary amount";
    }
    
    if (!business || isNaN(Number(business)) || Number(business) < 0) {
      newErrors.business = "Please enter a valid business income amount (use 0 if none)";
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
            salary: Number(salary),
            business: Number(business),
          },
        });
        
        // Save step 1 data to backend
        await saveStep1Data({
          step: 'income',
          salaryIncome: Number(salary),
          businessIncome: Number(business),
        });
        
        // Navigate to next step on success
        router.push('/onboarding/step2');
      } catch (error) {
        console.error('Error saving step 1 data:', error);
        toast.error('Error saving income data. Please try again.');
      }
    }
  };

  const totalIncome = (Number(salary) || 0) + (Number(business) || 0);

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
            <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
              <PhilippinePeso className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Tell us about your income</CardTitle>
            <CardDescription>
              This helps us create a personalized budget and financial plan for you
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <FloatingInput
                  type="number"
                  label="Monthly Salary (₱)"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  min="0"
                  step="0.01"
                  className={errors.salary ? "border-destructive" : ""}
                />
                {errors.salary && (
                  <p className="text-destructive text-sm mt-1">{errors.salary}</p>
                )}
              </div>

              <div>
                <FloatingInput
                  type="number"
                  label="Monthly Business Income (₱)"
                  value={business}
                  onChange={(e) => setBusiness(e.target.value)}
                  min="0"
                  step="0.01"
                  className={errors.business ? "border-destructive" : ""}
                />
                {errors.business && (
                  <p className="text-destructive text-sm mt-1">{errors.business}</p>
                )}
              </div>
            </div>

            {/* Total income preview */}
            <div className="bg-muted rounded-lg p-4 border border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Monthly Income:
                </span>
                <span className="text-lg font-bold text-primary dark:text-green-400">
                  ₱{totalIncome.toLocaleString()}
                </span>
              </div>
            </div>

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
