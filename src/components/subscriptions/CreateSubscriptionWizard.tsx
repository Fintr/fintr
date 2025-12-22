"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscriptionPlans, useCreateSubscription } from "@/hooks/async/useSubscriptions";
import { SubscriptionPlan } from "@/services/finance/subscriptions/queries";
import { formatCurrency } from "@/lib/utils";
import { buildSubscriptionRedirectUrl, openUrl } from "@/lib/capacitor";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface CreateSubscriptionWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

type WizardStep = "plan" | "review";

const CreateSubscriptionWizard: React.FC<CreateSubscriptionWizardProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>("plan");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  const { plans, isLoading: isLoadingPlans } = useSubscriptionPlans();
  const { createSubscription, isCreating, data: subscriptionData } = useCreateSubscription();

  useEffect(() => {
    if (subscriptionData?.actionUrl) {
      // Redirect to Xendit action URL if needed
      openUrl(subscriptionData.actionUrl, {
        inNewTab: false,
        title: 'Complete Payment'
      });
    }
    if (subscriptionData?.subscription) {
      toast.success("Subscription created successfully!");
      onClose();
      router.refresh();
    }
  }, [subscriptionData, onClose, router]);

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
      await createSubscription({
        subscriptionPlanId: selectedPlan.id,
        successReturnUrl: buildSubscriptionRedirectUrl('/dashboard/subscriptions?success=true'),
        failureReturnUrl: buildSubscriptionRedirectUrl('/dashboard/subscriptions?failure=true'),
      });
    } catch (error: any) {
      toast.error(error?.message || "Failed to subscribe");
    }
  };

  const handleBack = () => {
    if (currentStep === "review") {
      setCurrentStep("plan");
    }
  };

  const handleClose = () => {
    setCurrentStep("plan");
    setSelectedPlan(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subscribe</DialogTitle>
          <DialogDescription>
            Choose a plan to get started
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep === "plan" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
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
                currentStep === "review" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
              }`}
            >
              2
            </div>
            <span className={currentStep === "review" ? "font-semibold" : ""}>Review</span>
          </div>
        </div>

        {/* Step 1: Choose Plan */}
        {currentStep === "plan" && (
          <div className="space-y-4">
            {isLoadingPlans ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all ${
                      selectedPlan?.id === plan.id
                        ? "ring-2 ring-blue-600 border-blue-600"
                        : "hover:shadow-md"
                    }`}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    <CardHeader>
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="text-2xl font-bold">
                          {formatCurrency(plan.priceCents / 100, plan.priceCurrency)}/
                          {plan.interval}
                        </div>
                        <div className="text-sm text-gray-600">
                          {plan.tokenLimit} tokens included
                        </div>
                        {selectedPlan?.id === plan.id && (
                          <div className="flex items-center text-blue-600 mt-2">
                            <Check className="h-4 w-4 mr-1" />
                            <span className="text-sm font-medium">Selected</span>
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
                  <h4 className="font-semibold mb-2">Selected Plan</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-semibold">{selectedPlan.name}</p>
                    <p className="text-sm text-gray-600">{selectedPlan.description}</p>
                    <p className="text-lg font-bold mt-2">
                      {formatCurrency(selectedPlan.priceCents / 100, selectedPlan.priceCurrency)}/
                      {selectedPlan.interval}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedPlan.tokenLimit} tokens included
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === "plan" || isCreating}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleClose} disabled={isCreating}>
              Cancel
            </Button>
            {currentStep === "plan" && selectedPlan && (
              <Button onClick={() => setCurrentStep("review")}>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
            {currentStep === "review" && (
              <Button onClick={handleCreateSubscription} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Subscribe
                    <Check className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateSubscriptionWizard;

