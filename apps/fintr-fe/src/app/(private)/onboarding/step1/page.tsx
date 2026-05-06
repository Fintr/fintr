"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyPicker } from "@/components/ui/currency-picker";
import { isValidCurrencyCode } from "@/data/currencies";
import { useOnboarding } from "@/hooks/async/useOnboarding";
import { toast } from "sonner";
import { ArrowRight, Globe } from "lucide-react";

export default function OnboardingStep1() {
  const router = useRouter();
  const { saveCurrencyStepData, isUpdating, onboardingData } = useOnboarding("currency");
  const currentCurrency =
    onboardingData?.data?.currency ?? onboardingData?.data?.storedCurrency ?? "PHP";
  const [selectedCurrency, setSelectedCurrency] = useState<string>(currentCurrency);

  const handleNext = async () => {
    try {
      await saveCurrencyStepData({
        step: "currency",
        currency: selectedCurrency,
      });
      router.push("/onboarding/step2");
    } catch (error) {
      console.error("Error saving currency:", error);
      toast.error("Failed to save currency. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Step 1 of 5</span>
            <span>Workspace currency</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all duration-500 ease-out w-1/5" />
          </div>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-primary/30 rounded-full w-fit">
              <Globe className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Choose your currency</CardTitle>
            <CardDescription>
              This will be the default currency for your workspace. You can change it later in
              settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <CurrencyPicker
                value={selectedCurrency}
                onChange={setSelectedCurrency}
                label="Currency"
                placeholder="Search by name or code (e.g. PHP, US Dollar)..."
                className="w-full"
              />
            </div>
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleNext}
                disabled={
                  isUpdating || !selectedCurrency || !isValidCurrencyCode(selectedCurrency)
                }
                className="px-8 bg-primary hover:bg-primary/90"
              >
                {isUpdating ? "Saving..." : "Next"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Transactions and budgets will use this currency by default.
        </p>
      </div>
    </div>
  );
}
