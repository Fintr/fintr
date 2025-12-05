"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentSubscription, useCancelSubscription, useSimulateCyclePayment, useForceAttemptCycle, useUpdateSubscription, useSubscriptionPlans } from "@/hooks/async/useSubscriptions";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { getActionCableClient, ActionCableMessage } from "@/lib/actionCable";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { CreditCard, Loader2, Plus, X, Play, AlertCircle, Copy, Check, Zap, Pencil, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SubscriptionsPage = () => {
  const { subscriptions, isLoading: isLoadingSubscription, refetch } = useCurrentSubscription();
  const { cancelSubscription, isCancelling } = useCancelSubscription();
  const { simulateCyclePayment, isSimulating } = useSimulateCyclePayment();
  const { forceAttemptCycle, isForcing } = useForceAttemptCycle();
  const { updateSubscription, isUpdating } = useUpdateSubscription();
  const { plans, isLoading: isLoadingPlans } = useSubscriptionPlans();
  const { api, getToken } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState<string | null>(null);
  const [showSimulateDialog, setShowSimulateDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [billingCycleId, setBillingCycleId] = useState("");
  const [amount, setAmount] = useState("");
  const [copiedCycleId, setCopiedCycleId] = useState<string | null>(null);

  // Check if we're in development or staging
  const isDevOrStaging =
    process.env.NODE_ENV === "development" ||
    (typeof window !== "undefined" && (window.location.hostname.includes("staging") || window.location.hostname.includes("localhost")));

  const activeSubscription = subscriptions.find((sub) => sub.status === "active");
  const requiresActionSubscriptions = subscriptions.filter((sub) => sub.status === "requires_action");
  const pendingSubscriptions = subscriptions.filter((sub) => sub.status === "pending");
  const cancelledSubscriptions = subscriptions.filter((sub) => sub.status === "inactive");
  const hasAnySubscription = subscriptions.length > 0;
  const hasActivePendingOrRequiresAction = subscriptions.some(
    (sub) => sub.status === "active" || sub.status === "pending" || sub.status === "requires_action"
  );
  const shouldShowCreateButton = !hasActivePendingOrRequiresAction;

  // Set up Action Cable subscription for real-time updates
  useEffect(() => {
    if (!currentSpace?.id) return;

    const channel = `subscriptions:${currentSpace.id}`;
    const client = getActionCableClient(async () => {
      try {
        return await getToken();
      } catch (error) {
        console.error("Failed to get token for Action Cable:", error);
        return undefined;
      }
    });

    const handleSubscriptionUpdate = (message: ActionCableMessage) => {
      if (message.type === "subscription_updated") {
        console.log("Subscription updated via Action Cable:", message);
        toast.success(message.message || "Subscription updated successfully");
        // Invalidate queries to refetch latest data
        queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
        queryClient.invalidateQueries({ queryKey: ["subscriptionPlans"] });
        queryClient.invalidateQueries({ queryKey: ["ai", "usage"] });
      }
    };

    // Connect and subscribe
    client.connect();
    client.subscribe(channel, handleSubscriptionUpdate);

    // Cleanup on unmount
    return () => {
      client.unsubscribe(channel);
    };
  }, [currentSpace?.id, getToken, queryClient]);

  // Debug logging
  console.log("isDevOrStaging:", isDevOrStaging);
  console.log("activeSubscription:", activeSubscription);
  console.log("subscriptions:", subscriptions);

  const handleCancelSubscription = async () => {
    if (!showCancelDialog) return;

    try {
      await cancelSubscription(showCancelDialog);
      toast.success("Subscription cancelled successfully");
      setShowCancelDialog(null);
      await refetch();
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel subscription");
    }
  };

  const handleUpdateSubscription = async () => {
    if (!showUpdateDialog || !selectedPlanId) return;

    try {
      const result = await updateSubscription({
        subscriptionId: showUpdateDialog,
        data: { subscriptionPlanId: selectedPlanId },
      });

      toast.success("Subscription updated successfully");
      setShowUpdateDialog(null);
      setSelectedPlanId("");

      // If there's a payment session URL (for upgrades), open it in a new tab
      if (result.paymentSessionUrl) {
        window.open(result.paymentSessionUrl, "_blank", "noopener,noreferrer");
        await refetch();
      } else {
        await refetch();
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.details?.subscription || 
                          error?.response?.data?.message || 
                          error?.message || 
                          "Failed to update subscription";
      toast.error(errorMessage);
    }
  };

  const handleSimulateCyclePayment = async () => {
    if (!billingCycleId.trim()) {
      toast.error("Please enter a billing cycle ID");
      return;
    }

    if (!amount.trim() || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    try {
      await simulateCyclePayment({ 
        billingCycleId: billingCycleId.trim(),
        amount: parseFloat(amount)
      });
      toast.success("Cycle payment simulated successfully");
      setShowSimulateDialog(false);
      setBillingCycleId("");
      setAmount("");
      await refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to simulate cycle payment");
    }
  };

  const handleCopyCycleId = async (cycleId: string) => {
    try {
      if (typeof window !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(cycleId);
        setCopiedCycleId(cycleId);
        toast.success("Cycle ID copied to clipboard!");
        setTimeout(() => setCopiedCycleId(null), 2000);
      }
    } catch (err) {
      toast.error("Failed to copy cycle ID");
    }
  };

  if (isLoadingSubscription) {
    return (
      <div className="container mx-auto py-8 px-0 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4 sm:py-8 -mx-4 sm:mx-auto sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold">Subscriptions</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">
            Manage your subscription plan and payment methods
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0 z-10 relative">
          {isDevOrStaging && (
            <Button
              variant="outline"
              onClick={() => setShowSimulateDialog(true)}
              className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 w-full sm:w-auto flex items-center justify-center min-h-[40px]"
            >
              <Play className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Simulate Payment</span>
              <span className="sm:hidden">Simulate</span>
            </Button>
          )}
          {shouldShowCreateButton && (
            <Button asChild className="w-full sm:w-auto flex items-center justify-center min-h-[40px]">
              <Link href="/dashboard/subscriptions/create" className="flex items-center justify-center w-full">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Create Subscription</span>
                <span className="sm:hidden">Create</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {hasAnySubscription ? (
        <div className="space-y-4">
          {activeSubscription && (
            <Card>
              <CardHeader>
                <CardTitle>Current Subscription</CardTitle>
                <CardDescription>Your active subscription plan</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold">{activeSubscription.subscriptionPlan.name}</h3>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">{activeSubscription.subscriptionPlan.description}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Price</p>
                      <p className="text-base sm:text-lg font-semibold">
                        {formatCurrency(
                          activeSubscription.subscriptionPlan.priceCents / 100,
                          activeSubscription.subscriptionPlan.priceCurrency
                        )}{" "}
                        / {activeSubscription.subscriptionPlan.interval}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Token Limit</p>
                      <p className="text-base sm:text-lg font-semibold">{activeSubscription.subscriptionPlan.tokenLimit}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Status</p>
                      <p className="text-base sm:text-lg font-semibold capitalize">{activeSubscription.status}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Current Cycle</p>
                      <p className="text-base sm:text-lg font-semibold">{activeSubscription.currentCycleCount}</p>
                    </div>
                  </div>
                  {activeSubscription.billingCycles && activeSubscription.billingCycles.length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Billing Cycles</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[180px] overflow-y-auto">
                          <Table>
                          <TableHeader className="bg-gray-50">
                            <TableRow className="hover:bg-gray-50">
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Cycle</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Status</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Scheduled Payment</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Start Date</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">End Date</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Tokens Allocated</TableHead>
                              {(activeSubscription.billingCycles?.some((c) => c.status === "failed" && c.actionUrl) || 
                                (isDevOrStaging && activeSubscription.billingCycles?.some((c) => c.xenditCycleId))) && (
                                <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Actions</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeSubscription.billingCycles
                              ?.sort((a, b) => (b.cycleNumber || 0) - (a.cycleNumber || 0))
                              .map((cycle) => (
                              <TableRow key={cycle.id} className="hover:bg-gray-50">
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span>{cycle.cycleNumber}</span>
                                    <button
                                      onClick={() => handleCopyCycleId(cycle.id)}
                                      className="text-gray-500 hover:text-gray-700 transition-colors"
                                      title={copiedCycleId === cycle.id ? "Copied!" : "Copy billing cycle ID"}
                                    >
                                      {copiedCycleId === cycle.id ? (
                                        <Check className="h-3 w-3 text-green-600" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                  <span className={`px-2 py-1 rounded capitalize ${
                                    cycle.status === "paid" ? "bg-green-100 text-green-800" :
                                    cycle.status === "failed" ? "bg-red-100 text-red-800" :
                                    "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    {cycle.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.scheduledTimestamp ? new Date(cycle.scheduledTimestamp).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.startedAt ? new Date(cycle.startedAt).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.endsAt ? new Date(cycle.endsAt).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.tokensAllocated ? cycle.tokensAllocated.toLocaleString() : "-"}
                                </TableCell>
                                {(activeSubscription.billingCycles?.some((c) => c.status === "failed" && c.actionUrl) || 
                                  (isDevOrStaging && activeSubscription.billingCycles?.some((c) => c.xenditCycleId))) && (
                                  <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      {cycle.status === "failed" && cycle.actionUrl && activeSubscription.status !== "inactive" ? (
                                        <Button
                                          onClick={() => {
                                            if (cycle.actionUrl) {
                                              window.location.href = cycle.actionUrl;
                                            }
                                          }}
                                          className="text-xs px-2 py-1 h-auto rounded-sm"
                                          size="sm"
                                        >
                                          <CreditCard className="h-3 w-3" />
                                          Pay
                                        </Button>
                                      ) : (
                                        <span className="text-gray-400">-</span>
                                      )}
                                      {isDevOrStaging && cycle.xenditCycleId && (
                                        <Button
                                          onClick={async () => {
                                            try {
                                              await forceAttemptCycle({
                                                billingCycleId: cycle.id,
                                              });
                                              toast.success("Force attempt initiated", {
                                                description: "The cycle force attempt has been initiated successfully.",
                                              });
                                              refetch();
                                            } catch (error: any) {
                                              toast.error("Force attempt failed", {
                                                description: error?.response?.data?.error?.message || error.message || "Failed to force attempt cycle",
                                              });
                                            }
                                          }}
                                          variant="outline"
                                          className="text-xs px-2 py-1 h-auto rounded-sm"
                                          size="sm"
                                          disabled={isForcing}
                                        >
                                          {isForcing ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <RefreshCw className="h-3 w-3" />
                                          )}
                                          Force
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="pt-4 border-t flex flex-col sm:flex-row gap-2">
                    {activeSubscription.canChangePlan !== false && (
                      <Button
                        variant="outline"
                        onClick={() => setShowUpdateDialog(activeSubscription.id)}
                        disabled={isLoadingPlans || isUpdating}
                        className="w-full sm:w-auto"
                        size="sm"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Change Plan</span>
                        <span className="sm:hidden">Change</span>
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() => setShowCancelDialog(activeSubscription.id)}
                      disabled={isCancelling}
                      className="w-full sm:w-auto"
                      size="sm"
                    >
                      {isCancelling ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          <span className="hidden sm:inline">Cancelling...</span>
                          <span className="sm:hidden">Cancelling</span>
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-2" />
                          <span className="hidden sm:inline">Cancel Subscription</span>
                          <span className="sm:hidden">Cancel</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {requiresActionSubscriptions.map((subscription) => (
            <Card key={subscription.id}>
              <CardHeader>
                <CardTitle>Subscription Requires Action</CardTitle>
                <CardDescription>
                  Your subscription requires action to complete setup. Please complete the payment authorization to activate your subscription.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold">{subscription.subscriptionPlan.name}</h3>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">{subscription.subscriptionPlan.description}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Price</p>
                      <p className="text-base sm:text-lg font-semibold">
                        {formatCurrency(
                          subscription.subscriptionPlan.priceCents / 100,
                          subscription.subscriptionPlan.priceCurrency
                        )}{" "}
                        / {subscription.subscriptionPlan.interval}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Token Limit</p>
                      <p className="text-base sm:text-lg font-semibold">{subscription.subscriptionPlan.tokenLimit}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Status</p>
                      <p className="text-base sm:text-lg font-semibold capitalize">{subscription.status}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Current Cycle</p>
                      <p className="text-base sm:text-lg font-semibold">{subscription.currentCycleCount}</p>
                    </div>
                  </div>
                  {subscription.billingCycles && subscription.billingCycles.length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Billing Cycles</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[180px] overflow-y-auto">
                          <Table>
                          <TableHeader className="bg-gray-50">
                            <TableRow className="hover:bg-gray-50">
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Cycle</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Status</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Scheduled Payment</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Start Date</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">End Date</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Tokens Allocated</TableHead>
                              {subscription.billingCycles.some((c) => c.status === "failed" && c.actionUrl) && (
                                <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Action</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {subscription.billingCycles.map((cycle) => (
                              <TableRow key={cycle.id} className="hover:bg-gray-50">
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span>{cycle.cycleNumber}</span>
                                    <button
                                      onClick={() => handleCopyCycleId(cycle.id)}
                                      className="text-gray-500 hover:text-gray-700 transition-colors"
                                      title={copiedCycleId === cycle.id ? "Copied!" : "Copy billing cycle ID"}
                                    >
                                      {copiedCycleId === cycle.id ? (
                                        <Check className="h-3 w-3 text-green-600" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                  <span className={`px-2 py-1 rounded capitalize ${
                                    cycle.status === "paid" ? "bg-green-100 text-green-800" :
                                    cycle.status === "failed" ? "bg-red-100 text-red-800" :
                                    "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    {cycle.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.scheduledTimestamp ? new Date(cycle.scheduledTimestamp).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.startedAt ? new Date(cycle.startedAt).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.endsAt ? new Date(cycle.endsAt).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.tokensAllocated ? cycle.tokensAllocated.toLocaleString() : "-"}
                                </TableCell>
                                {subscription.billingCycles.some((c) => c.status === "failed" && c.actionUrl) && (
                                  <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      {cycle.status === "failed" && cycle.actionUrl && subscription.status !== "inactive" && (
                                        <Button
                                          onClick={() => {
                                            if (cycle.actionUrl) {
                                              window.location.href = cycle.actionUrl;
                                            }
                                          }}
                                          className="text-xs px-2 py-1 h-auto rounded-sm"
                                          size="sm"
                                        >
                                          <CreditCard className="h-3 w-3" />
                                          Pay
                                        </Button>
                                      )}
                                      {isDevOrStaging && cycle.xenditCycleId && (
                                        <Button
                                          onClick={async () => {
                                            try {
                                              await forceAttemptCycle({
                                                billingCycleId: cycle.id,
                                              });
                                              toast.success("Force attempt initiated", {
                                                description: "The cycle force attempt has been initiated successfully.",
                                              });
                                              refetch();
                                            } catch (error: any) {
                                              toast.error("Force attempt failed", {
                                                description: error?.response?.data?.error?.message || error.message || "Failed to force attempt cycle",
                                              });
                                            }
                                          }}
                                          variant="outline"
                                          className="text-xs px-2 py-1 h-auto rounded-sm"
                                          size="sm"
                                          disabled={isForcing}
                                        >
                                          {isForcing ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <RefreshCw className="h-3 w-3" />
                                          )}
                                          Force
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        </div>
                      </div>
                    </div>
                  )}
                  {subscription.actionUrl && (
                    <div className="pt-4 border-t">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-blue-900 mb-1">
                              Action Required
                            </h4>
                            <p className="text-sm text-blue-800 mb-3">
                              Please complete the payment authorization to activate your subscription.
                            </p>
                            <Button
                              onClick={() => {
                                if (subscription.actionUrl) {
                                  window.location.href = subscription.actionUrl;
                                }
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              size="sm"
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              Complete Authorization
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {pendingSubscriptions.map((subscription) => (
            <Card key={subscription.id}>
              <CardHeader>
                <CardTitle>Pending Subscription</CardTitle>
                <CardDescription>
                  Your subscription is being set up. It will be activated shortly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold">{subscription.subscriptionPlan.name}</h3>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">{subscription.subscriptionPlan.description}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Price</p>
                      <p className="text-base sm:text-lg font-semibold">
                        {formatCurrency(
                          subscription.subscriptionPlan.priceCents / 100,
                          subscription.subscriptionPlan.priceCurrency
                        )}{" "}
                        / {subscription.subscriptionPlan.interval}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Token Limit</p>
                      <p className="text-base sm:text-lg font-semibold">{subscription.subscriptionPlan.tokenLimit}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Status</p>
                      <p className="text-base sm:text-lg font-semibold capitalize">{subscription.status}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Current Cycle</p>
                      <p className="text-base sm:text-lg font-semibold">{subscription.currentCycleCount}</p>
                    </div>
                  </div>
                  {subscription.billingCycles && subscription.billingCycles.length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Billing Cycles</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[180px] overflow-y-auto">
                          <Table>
                          <TableHeader className="bg-gray-50">
                            <TableRow className="hover:bg-gray-50">
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Cycle</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Status</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Scheduled Payment</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Start Date</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">End Date</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Tokens Allocated</TableHead>
                              {subscription.billingCycles.some((c) => c.status === "failed" && c.actionUrl) && (
                                <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Action</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {subscription.billingCycles.map((cycle) => (
                              <TableRow key={cycle.id} className="hover:bg-gray-50">
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span>{cycle.cycleNumber}</span>
                                    <button
                                      onClick={() => handleCopyCycleId(cycle.id)}
                                      className="text-gray-500 hover:text-gray-700 transition-colors"
                                      title={copiedCycleId === cycle.id ? "Copied!" : "Copy billing cycle ID"}
                                    >
                                      {copiedCycleId === cycle.id ? (
                                        <Check className="h-3 w-3 text-green-600" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                  <span className={`px-2 py-1 rounded capitalize ${
                                    cycle.status === "paid" ? "bg-green-100 text-green-800" :
                                    cycle.status === "failed" ? "bg-red-100 text-red-800" :
                                    "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    {cycle.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.scheduledTimestamp ? new Date(cycle.scheduledTimestamp).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.startedAt ? new Date(cycle.startedAt).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.endsAt ? new Date(cycle.endsAt).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.tokensAllocated ? cycle.tokensAllocated.toLocaleString() : "-"}
                                </TableCell>
                                {subscription.billingCycles.some((c) => c.status === "failed" && c.actionUrl) && (
                                  <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                    {cycle.status === "failed" && cycle.actionUrl && subscription.status !== "inactive" ? (
                                      <Button
                                        onClick={() => {
                                          if (cycle.actionUrl) {
                                            window.location.href = cycle.actionUrl;
                                          }
                                        }}
                                        className="text-xs px-2 py-1 h-auto"
                                        size="sm"
                                      >
                                        <CreditCard className="h-3 w-3" />
                                        Pay
                                      </Button>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {cancelledSubscriptions.map((subscription) => (
            <Card key={subscription.id}>
              <CardHeader>
                <CardTitle>Cancelled Subscription</CardTitle>
                <CardDescription>
                  {subscription.gracePeriodEndsAt
                    ? `Your subscription has been cancelled. You will continue to have access until ${new Date(subscription.gracePeriodEndsAt).toLocaleDateString()}.`
                    : "Your subscription has been cancelled."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold">{subscription.subscriptionPlan.name}</h3>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">{subscription.subscriptionPlan.description}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Price</p>
                      <p className="text-base sm:text-lg font-semibold">
                        {formatCurrency(
                          subscription.subscriptionPlan.priceCents / 100,
                          subscription.subscriptionPlan.priceCurrency
                        )}{" "}
                        / {subscription.subscriptionPlan.interval}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Token Limit</p>
                      <p className="text-base sm:text-lg font-semibold">{subscription.subscriptionPlan.tokenLimit}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Status</p>
                      <p className="text-base sm:text-lg font-semibold capitalize">{subscription.status}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500">Current Cycle</p>
                      <p className="text-base sm:text-lg font-semibold">{subscription.currentCycleCount}</p>
                    </div>
                    {subscription.gracePeriodEndsAt && (
                      <div className="col-span-1 sm:col-span-2">
                        <p className="text-xs sm:text-sm text-gray-500">Subscription Ends</p>
                        <p className="text-base sm:text-lg font-semibold text-red-900">
                          {new Date(subscription.gracePeriodEndsAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                  {subscription.billingCycles && subscription.billingCycles.length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Billing Cycles</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[180px] overflow-y-auto">
                          <Table>
                          <TableHeader className="bg-gray-50">
                            <TableRow className="hover:bg-gray-50">
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Cycle</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Status</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Scheduled Payment</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Start Date</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">End Date</TableHead>
                              <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Tokens Allocated</TableHead>
                              {subscription.billingCycles.some((c) => c.status === "failed" && c.actionUrl) && (
                                <TableHead className="text-xs font-medium text-gray-600 whitespace-nowrap px-3 py-2">Action</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {subscription.billingCycles.map((cycle) => (
                              <TableRow key={cycle.id} className="hover:bg-gray-50">
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span>{cycle.cycleNumber}</span>
                                    <button
                                      onClick={() => handleCopyCycleId(cycle.id)}
                                      className="text-gray-500 hover:text-gray-700 transition-colors"
                                      title={copiedCycleId === cycle.id ? "Copied!" : "Copy billing cycle ID"}
                                    >
                                      {copiedCycleId === cycle.id ? (
                                        <Check className="h-3 w-3 text-green-600" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                  <span className={`px-2 py-1 rounded capitalize ${
                                    cycle.status === "paid" ? "bg-green-100 text-green-800" :
                                    cycle.status === "failed" ? "bg-red-100 text-red-800" :
                                    "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    {cycle.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.scheduledTimestamp ? new Date(cycle.scheduledTimestamp).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.startedAt ? new Date(cycle.startedAt).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.endsAt ? new Date(cycle.endsAt).toLocaleDateString() : "-"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700 whitespace-nowrap px-3 py-2">
                                  {cycle.tokensAllocated ? cycle.tokensAllocated.toLocaleString() : "-"}
                                </TableCell>
                                {subscription.billingCycles.some((c) => c.status === "failed" && c.actionUrl) && (
                                  <TableCell className="text-xs whitespace-nowrap px-3 py-2">
                                    {cycle.status === "failed" && cycle.actionUrl && subscription.status !== "inactive" ? (
                                      <Button
                                        onClick={() => {
                                          if (cycle.actionUrl) {
                                            window.location.href = cycle.actionUrl;
                                          }
                                        }}
                                        className="text-xs px-2 py-1 h-auto"
                                        size="sm"
                                      >
                                        <CreditCard className="h-3 w-3" />
                                        Pay
                                      </Button>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        shouldShowCreateButton && (
          <Card>
            <CardHeader>
              <CardTitle>No Active Subscription</CardTitle>
              <CardDescription>
                Create a subscription to unlock premium features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/subscriptions/create" className="block">
                <Button className="w-full sm:w-auto" size="sm">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Create Subscription</span>
                  <span className="sm:hidden">Create</span>
                </Button>
              </Link>
            </CardContent>
          </Card>
        )
      )}

      <Dialog open={showCancelDialog !== null} onOpenChange={(open) => setShowCancelDialog(open ? showCancelDialog : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription className="text-sm">
              Are you sure you want to cancel your subscription? This will stop all future billing cycles.
              You will continue to have access until the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(null)}
              disabled={isCancelling}
              className="w-full sm:w-auto order-2 sm:order-1"
              size="sm"
            >
              Keep Subscription
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="w-full sm:w-auto order-1 sm:order-2"
              size="sm"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Yes, Cancel Subscription"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSimulateDialog} onOpenChange={setShowSimulateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Simulate Cycle Payment</DialogTitle>
            <DialogDescription className="text-sm">
              This feature is only available in development and staging environments.
              Enter the billing cycle ID to simulate a payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="billingCycleId" className="text-sm">Billing Cycle ID</Label>
              <Input
                id="billingCycleId"
                placeholder="Enter billing cycle ID"
                value={billingCycleId}
                onChange={(e) => setBillingCycleId(e.target.value)}
                disabled={isSimulating}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Enter amount (e.g., 10000 for 100.00)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isSimulating}
                className="text-sm"
              />
              <p className="text-xs text-gray-500">
                Enter amount in cents (e.g., 10000 = 100.00). Use a low amount to test failures.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowSimulateDialog(false);
                setBillingCycleId("");
                setAmount("");
              }}
              disabled={isSimulating}
              className="w-full sm:w-auto order-2 sm:order-1"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSimulateCyclePayment}
              disabled={isSimulating || !billingCycleId.trim() || !amount.trim() || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
              className="bg-yellow-500 hover:bg-yellow-600 text-white w-full sm:w-auto order-1 sm:order-2"
              size="sm"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Simulate Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showUpdateDialog} onOpenChange={(open) => !open && setShowUpdateDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription className="text-sm">
              Select a new plan to change your subscription. Upgrades take effect immediately with prorated billing.
              Downgrades will take effect on your next billing cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isLoadingPlans ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {plans
                  .filter((plan) => plan.id !== activeSubscription?.subscriptionPlan?.id)
                  .map((plan) => (
                    <Card
                      key={plan.id}
                      className={`cursor-pointer transition-all border-2 ${
                        selectedPlanId === plan.id
                          ? "ring-2 ring-blue-600 border-blue-600 border-blue-600"
                          : "border-gray-300 hover:border-gray-400 hover:shadow-md"
                      }`}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold">{plan.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                            <div className="mt-2 space-y-1">
                              <p className="text-sm font-medium">
                                {formatCurrency(plan.priceCents / 100, plan.priceCurrency)} / {plan.interval}
                              </p>
                              <p className="text-xs text-gray-500">{plan.tokenLimit} tokens included</p>
                            </div>
                          </div>
                          {selectedPlanId === plan.id && (
                            <Check className="h-5 w-5 text-blue-600 flex-shrink-0 ml-2" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                {plans.filter((plan) => plan.id !== activeSubscription?.subscriptionPlan?.id).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No other plans available</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowUpdateDialog(null);
                setSelectedPlanId("");
              }}
              disabled={isUpdating}
              className="w-full sm:w-auto order-2 sm:order-1"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSubscription}
              disabled={isUpdating || !selectedPlanId || isLoadingPlans}
              className="w-full sm:w-auto order-1 sm:order-2"
              size="sm"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 mr-2" />
                  Update Plan
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionsPage;


