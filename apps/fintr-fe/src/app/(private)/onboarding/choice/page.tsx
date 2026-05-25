"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useOnboarding } from "@/hooks/async/useOnboarding";
import { toast } from "sonner";
import { ArrowRight, Clock } from "lucide-react";

export default function OnboardingChoice() {
  const router = useRouter();
  const { skipOnboarding, isUpdating } = useOnboarding();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    router.prefetch("/onboarding/step2");
    router.prefetch("/dashboard");
  }, [router]);

  const handleSetupNow = () => {
    setIsNavigating(true);
    router.replace("/onboarding/step2");
  };

  const handleSetupLater = async () => {
    try {
      await skipOnboarding();
      router.replace("/dashboard");
    } catch (error) {
      console.error("Error skipping onboarding:", error);
      toast.error("Something went wrong. Please try again.");
    }
  };

  const isBusy = isUpdating || isNavigating;

  return (
    <>
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Step 1 of 5</span>
            <span>Get Started</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all duration-500 ease-out w-1/5" />
          </div>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">How would you like to get started?</CardTitle>
            <CardDescription>
              You can set up your income, budgets, and accounts now, or jump straight to the dashboard and do it later.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            <button
              onClick={handleSetupNow}
              disabled={isBusy}
              className="w-full text-left rounded-xl border-2 border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-all duration-200 p-5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground text-base">
                    {isNavigating ? "Opening setup..." : "Setup Now"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Walk through income, budgets, and accounts in a few quick steps.
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-primary mt-0.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            <button
              onClick={handleSetupLater}
              disabled={isBusy}
              className="w-full text-left rounded-xl border-2 border-border hover:border-muted-foreground bg-muted/30 hover:bg-muted/60 transition-all duration-200 p-5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground text-base">
                    {isUpdating ? "Setting up..." : "Setup Later"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Go straight to the dashboard. We'll create default categories and a Cash account for you.
                  </p>
                </div>
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              </div>
            </button>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          You can always complete your setup from the dashboard settings.
        </p>
    </>
  );
}
