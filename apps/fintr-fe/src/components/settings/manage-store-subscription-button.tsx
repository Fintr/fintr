"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PRO_ACCESS_QUERY_KEY, useProAccess } from "@/hooks/async/useProAccess";
import { manageProSubscription } from "@/lib/revenuecat/purchase-pro";

type ManageStoreSubscriptionButtonProps = {
  managementUrl?: string | null;
  onFinished: () => Promise<unknown> | unknown;
};

export function storeBillingLabel(store?: string | null): string {
  switch (store) {
    case "app_store":
    case "mac_app_store":
      return "App Store";
    case "play_store":
      return "Google Play";
    case "test_store":
      return "Test Store";
    default:
      return "app store";
  }
}

export function ManageStoreSubscriptionButton({
  managementUrl,
  onFinished,
}: ManageStoreSubscriptionButtonProps) {
  const { data } = useProAccess();
  const queryClient = useQueryClient();
  const [isManaging, setIsManaging] = useState(false);

  const handleClick = async () => {
    if (!data?.appUserId) {
      toast.error(
        "Subscription management in the store is available in the mobile app.",
      );
      return;
    }

    setIsManaging(true);
    try {
      await manageProSubscription(data.appUserId, managementUrl);
      await onFinished();
      await queryClient.invalidateQueries({ queryKey: PRO_ACCESS_QUERY_KEY });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not open subscription management.";
      toast.error(message);
    } finally {
      setIsManaging(false);
    }
  };

  return (
    <Button
      variant="destructive"
      onClick={() => {
        void handleClick();
      }}
      disabled={isManaging}
      className="w-full sm:w-auto"
      size="sm"
    >
      {isManaging ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Opening...
        </>
      ) : (
        "Manage subscription"
      )}
    </Button>
  );
}
