"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuthApi } from "@/hooks/useAuthApi";
import {
  PRO_ACCESS_QUERY_KEY,
  useProAccess,
} from "@/hooks/async/useProAccess";
import { useNativeCheckoutGate } from "@/hooks/useNativeCheckoutGate";
import {
  presentProPaywall,
  PurchaseCancelledError,
} from "@/lib/revenuecat/purchase-pro";
import { syncRevenueCatCustomer } from "@/services/finance/pro-access";

type SubscribeProButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "onClick" | "asChild"
>;

export function SubscribeProButton({
  children,
  disabled,
  ...props
}: SubscribeProButtonProps) {
  const checkoutGate = useNativeCheckoutGate();
  const { data } = useProAccess();
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const [isPurchasing, setIsPurchasing] = useState(false);

  if (checkoutGate !== "native") {
    return (
      <Button
        asChild
        disabled={disabled}
        {...props}
      >
        <Link href="/dashboard/subscriptions/create">{children}</Link>
      </Button>
    );
  }

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

  return (
    <Button
      disabled={disabled || isPurchasing}
      onClick={handlePurchase}
      {...props}
    >
      {children}
    </Button>
  );
}
