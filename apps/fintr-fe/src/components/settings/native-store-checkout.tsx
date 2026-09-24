"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuthApi } from "@/hooks/useAuthApi";
import {
  PRO_ACCESS_QUERY_KEY,
  useProAccess,
} from "@/hooks/async/useProAccess";
import {
  presentProPaywall,
  PurchaseCancelledError,
} from "@/lib/revenuecat/purchase-pro";
import { syncRevenueCatCustomer } from "@/services/finance/pro-access";

export function NativeStoreCheckout({
  openPaywall,
}: {
  openPaywall: boolean;
}) {
  const router = useRouter();
  const { data } = useProAccess();
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (!openPaywall || started.current || !data?.appUserId) {
      return;
    }

    started.current = true;
    const appUserId = data.appUserId;

    void (async () => {
      try {
        await presentProPaywall(appUserId);
        const access = await syncRevenueCatCustomer(api);
        queryClient.setQueryData(PRO_ACCESS_QUERY_KEY, access);
        await queryClient.invalidateQueries({ queryKey: ["currentSubscription"] });
        toast.success("Fintr Pro is active");
      } catch (error) {
        if (!(error instanceof PurchaseCancelledError)) {
          const message =
            error instanceof Error
              ? error.message
              : "Could not complete the purchase";
          toast.error(message);
        }
      } finally {
        router.replace("/dashboard/settings");
      }
    })();
  }, [
    api,
    data?.appUserId,
    openPaywall,
    queryClient,
    router,
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-lg font-medium text-primary">
        {openPaywall ? "Opening the App Store…" : "Loading checkout…"}
      </p>
    </div>
  );
}
