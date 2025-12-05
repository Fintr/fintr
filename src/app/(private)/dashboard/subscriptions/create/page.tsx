"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscriptionPlans, useCreateSubscription } from "@/hooks/async/useSubscriptions";
import { SubscriptionPlan } from "@/services/finance/subscriptions/queries";
import { formatCurrency } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

type WizardStep = "plan" | "review";

const CreateSubscriptionPage = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>("plan");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const { plans, isLoading: isLoadingPlans, isError: isPlansError, error: plansError } = useSubscriptionPlans();
  const { createSubscription, isCreating, data: subscriptionData } = useCreateSubscription();

  useEffect(() => {
    // Handle redirect from mutation data (when subscription is created)
    if (subscriptionData?.actionUrl && !isRedirecting) {
      setIsRedirecting(true);
      setRedirectUrl(subscriptionData.actionUrl);
      toast.info("Redirecting to Xendit to complete payment method setup...");
      
      // Redirect immediately after a brief delay to show the message
      setTimeout(() => {
        window.location.href = subscriptionData.actionUrl!;
      }, 1000);
    } else if (subscriptionData?.subscription && !subscriptionData?.actionUrl) {
      // Only show success if there's no action URL (meaning it was already activated)
      toast.success("Subscription created successfully!");
      router.push("/dashboard/space_settings");
      router.refresh();
    }
  }, [subscriptionData, isRedirecting, router]);

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setCurrentStep("review");
  };

  const handleCreateSubscription = async () => {
    if (!selectedPlan) {
      toast.error("Please select a plan");
      return;
    }

    try {
      const baseUrl = window.location.origin;
      const result = await createSubscription({
        subscriptionPlanId: selectedPlan.id,
        successReturnUrl: `${baseUrl}/dashboard/subscriptions?success=true`,
        failureReturnUrl: `${baseUrl}/dashboard/subscriptions?failure=true`,
      });

      // If we have an action URL, redirect immediately to Xendit
      if (result?.actionUrl) {
        setIsRedirecting(true);
        setRedirectUrl(result.actionUrl);
        toast.info("Redirecting to Xendit to complete payment method setup...");
        
        // Redirect immediately after a brief delay to show the message
        setTimeout(() => {
          if (result.actionUrl) {
            window.location.href = result.actionUrl;
          }
        }, 1000);
      } else {
        // No action URL means subscription was created without needing redirect
        toast.success("Subscription created successfully!");
        router.push("/dashboard/space_settings");
        router.refresh();
      }
    } catch (error: any) {
      setIsRedirecting(false);
      setRedirectUrl(null);
      toast.error(error?.message || "Failed to create subscription");
    }
  };

  const handleBack = () => {
    if (currentStep === "review") {
      setCurrentStep("plan");
    }
  };

  // Show redirecting overlay if we're redirecting
  if (isRedirecting && redirectUrl) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md mx-auto px-4 text-center">
          <Card>
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-blue-900" />
                <div>
                  <h2 className="text-2xl font-semibold mb-2 text-primary">
                    Redirecting to Xendit
                  </h2>
                  <p className="text-primary">
                    Please wait while we redirect you to Xendit's secure payment page to complete your subscription setup.
                  </p>
                  <p className="text-sm text-primary mt-2">
                    If you are not redirected automatically,{" "}
                    <a
                      href={redirectUrl}
                      className="text-blue-900 underline hover:text-blue-700"
                    >
                      click here
                    </a>
                    .
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header with Back Button */}
        <div className="mb-8">
          <Link href="/dashboard/space_settings">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-primary">Create Subscription</h1>
          <p className="text-primary mt-2">
            Choose a plan to get started
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep === "plan" ? "bg-blue-900 text-white" : "bg-gray-200 text-primary"
              }`}
            >
              {currentStep !== "plan" ? <Check className="h-4 w-4" /> : "1"}
            </div>
            <span className={currentStep === "plan" ? "font-semibold" : ""}>Choose Plan</span>
          </div>
          <div className="flex-1 h-0.5 bg-gray-200 mx-4" />
          <div className="flex items-center space-x-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep === "review" ? "bg-blue-900 text-white" : "bg-gray-200 text-primary"
              }`}
            >
              2
            </div>
            <span className={currentStep === "review" ? "font-semibold" : ""}>Review</span>
          </div>
        </div>

        {/* Step 1: Choose Plan */}
        {currentStep === "plan" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2 text-primary">Select Your Plan</h2>
              <p className="text-primary">
                Choose the subscription plan that best fits your needs
              </p>
            </div>
            {isLoadingPlans ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-primary">Loading plans...</span>
              </div>
            ) : isPlansError ? (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="py-8 text-center">
                  <p className="text-red-900 mb-2">Failed to load subscription plans</p>
                  <p className="text-sm text-red-900">
                    {plansError instanceof Error ? plansError.message : "Please try again later"}
                  </p>
                </CardContent>
              </Card>
            ) : plans.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-primary">No subscription plans available at the moment.</p>
                  <p className="text-sm text-primary mt-2">Please check back later or contact support.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all h-full flex flex-col ${
                      selectedPlan?.id === plan.id
                        ? "ring-2 ring-blue-900 border-blue-900 shadow-lg scale-105"
                        : "hover:shadow-lg hover:scale-102 border-2"
                    }`}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    <CardHeader className="pb-4">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      {plan.description && (
                        <CardDescription className="mt-2">
                          {plan.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className="space-y-4 flex-1">
                        <div>
                          <div className="text-3xl font-bold text-primary">
                            {formatCurrency(plan.priceCents / 100, plan.priceCurrency)}
                          </div>
                          <div className="text-sm text-primary mt-1">
                            per {plan.interval}
                          </div>
                        </div>
                        <div className="pt-4 border-t">
                          <div className="flex items-center space-x-2">
                            <Check className="h-5 w-5 text-green-600" />
                            <span className="text-primary">
                              {plan.tokenLimit.toLocaleString()} tokens included
                            </span>
                          </div>
                        </div>
                        {selectedPlan?.id === plan.id && (
                          <div className="flex items-center justify-center text-blue-900 mt-4 pt-4 border-t">
                            <Check className="h-5 w-5 mr-2" />
                            <span className="font-semibold">Selected</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review */}
        {currentStep === "review" && selectedPlan && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Your Subscription</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-primary">Selected Plan</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-semibold text-primary">{selectedPlan.name}</p>
                    <p className="text-sm text-primary">{selectedPlan.description}</p>
                    <p className="text-lg font-bold mt-2 text-primary">
                      {formatCurrency(selectedPlan.priceCents / 100, selectedPlan.priceCurrency)}/
                      {selectedPlan.interval}
                    </p>
                    <p className="text-sm text-primary">
                      {selectedPlan.tokenLimit} tokens included
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === "plan" || isCreating}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex space-x-2">
            <Link href="/dashboard/space_settings">
              <Button variant="outline" disabled={isCreating}>
                Cancel
              </Button>
            </Link>
            {currentStep === "plan" && selectedPlan && (
              <Button onClick={() => setCurrentStep("review")}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {currentStep === "review" && (
              <Button onClick={handleCreateSubscription} disabled={isCreating || isRedirecting}>
                {isCreating || isRedirecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isRedirecting ? "Redirecting..." : "Creating..."}
                  </>
                ) : (
                  <>
                    Create Subscription
                    <Check className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateSubscriptionPage;
