"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthApi } from "@/hooks/useAuthApi";
import {
  PRO_ACCESS_QUERY_KEY,
  useProAccess,
} from "@/hooks/async/useProAccess";
import { useSubscriptionPlans } from "@/hooks/async/useSubscriptions";
import { detectPlatform } from "@/lib/platform-detection";
import { useNativeCheckoutGate } from "@/hooks/useNativeCheckoutGate";
import { PRO_FEATURES } from "@/lib/pro-features";
import {
  presentProCustomerCenter,
  presentProPaywall,
  PurchaseCancelledError,
} from "@/lib/revenuecat/purchase-pro";
import { syncRevenueCatCustomer } from "@/services/finance/pro-access";
import { proYearlySavingsPercent } from "@/lib/pro-plan-pricing";
import { formatProGrantDate } from "@/components/settings/pro-grant-thank-you-dialog";
import { formatCurrency } from "@/lib/utils";

export function ProPlanCard() {
  const { data, isPending } = useProAccess();
  const { plans } = useSubscriptionPlans();
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const [isPurchasing, setIsPurchasing] = useState(false);

  const pricedPlans = plans.length === 0 ? FALLBACK_PRO_PLANS : plans;
  const priceLabel = proPriceLabel(pricedPlans);
  const yearlySavings = proYearlySavingsPercent(pricedPlans);

  const checkoutGate = useNativeCheckoutGate();
  const isNative =
    checkoutGate === "native" ||
    (
      typeof navigator !== "undefined" &&
      detectPlatform(navigator.userAgent, document.documentElement).isNative
    );
  const hasPro = data?.pro === true;
  const isTrial = data?.source === "trial";
  const isPaidPro = hasPro && !isTrial;

  const statusCopy = statusMessage({
    hasData: Boolean(data),
    isPending,
    isPaidPro,
    isTrial,
    source: data?.source,
    proExpiresAt: data?.proExpiresAt ?? null,
    trialDaysRemaining: data?.trialDaysRemaining ?? 0,
  });

  const handlePurchase = async () => {
    if (!data?.appUserId) {
      toast.error("Sign in again before buying Fintr Pro.");
      return;
    }

    setIsPurchasing(true);
    try {
      await presentProPaywall(data.appUserId);
      const access = await syncRevenueCatCustomer(api);
      queryClient.setQueryData(PRO_ACCESS_QUERY_KEY, access);
      await queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
      toast.success("Fintr Pro is active");
    } catch (error) {
      if (!(error instanceof PurchaseCancelledError)) {
        const message =
          error instanceof Error ? error.message : "Could not complete the purchase";
        toast.error(message);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!data?.appUserId) {
      toast.error("Sign in again before managing Fintr Pro.");
      return;
    }

    setIsPurchasing(true);
    try {
      await presentProCustomerCenter(data.appUserId);
      const access = await syncRevenueCatCustomer(api);
      queryClient.setQueryData(PRO_ACCESS_QUERY_KEY, access);
      await queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not open subscription management";
      toast.error(message);
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <Card className="px-2">
      <CardHeader>
        <CardTitle>Fintr Pro</CardTitle>
        <CardDescription>{statusCopy}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-2xl font-semibold">
          {priceLabel}
          {yearlySavings == null ? null : (
            <span className="text-base font-medium text-teal-600 dark:text-teal-500">
              {` (saves ${yearlySavings}%)`}
            </span>
          )}
        </p>
        <ul className="space-y-3 text-sm">
          {PRO_FEATURES.map((feature) => (
            <li key={feature.key} className="flex items-start justify-between gap-3">
              <span>
                <span className="font-medium">{feature.name}</span>
                <span className="mt-0.5 block text-muted-foreground">
                  {feature.description}
                </span>
              </span>
              {feature.available ? null : (
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                  Soon
                </span>
              )}
            </li>
          ))}
        </ul>
        {isNative && data?.source === "revenuecat" ? (
          <Button
            variant="outline"
            onClick={handleManageSubscription}
            disabled={isPurchasing}
          >
            {isPurchasing ? "Opening subscription management…" : "Manage subscription"}
          </Button>
        ) : isPaidPro ? null : isNative ? (
          <Button
            onClick={handlePurchase}
            disabled={isPurchasing || (!data && isPending)}
          >
            {isPurchasing ? "Opening the store…" : "Get Fintr Pro"}
          </Button>
        ) : (
          <Button asChild>
            <Link href="/dashboard/subscriptions/create">Get Fintr Pro</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

const FALLBACK_PRO_PLANS = [
  {
    interval: "month",
    priceCents: 10_000,
    priceCurrency: "PHP",
  },
  {
    interval: "year",
    priceCents: 100_000,
    priceCurrency: "PHP",
  },
];

function proPriceLabel(
  plans: Array<{
    priceCents: number;
    priceCurrency: string;
    interval: string;
  }>,
): string {
  return [...plans]
    .sort((left, right) => left.priceCents - right.priceCents)
    .map(
      (plan) =>
        `${formatCurrency(plan.priceCents / 100, plan.priceCurrency)} / ${plan.interval}`,
    )
    .join(" or ");
}

function statusMessage({
  hasData,
  isPending,
  isPaidPro,
  isTrial,
  source,
  proExpiresAt,
  trialDaysRemaining,
}: {
  hasData: boolean;
  isPending: boolean;
  isPaidPro: boolean;
  isTrial: boolean;
  source?: string;
  proExpiresAt: string | null;
  trialDaysRemaining: number;
}): string {
  if (!hasData && isPending) {
    return "Checking your Fintr Pro access…";
  }

  if (source === "grant" && proExpiresAt) {
    const through = formatProGrantDate(proExpiresAt);
    return through
      ? `Fintr Pro is active through ${through}.`
      : "Fintr Pro is active on this account.";
  }

  if (isPaidPro) {
    return "Fintr Pro is active on this account.";
  }

  if (isTrial) {
    return trialDaysRemaining === 1
      ? "1 day left in your free trial."
      : `${trialDaysRemaining} days left in your free trial.`;
  }

  return "Your 7-day trial has ended.";
}
