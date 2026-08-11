"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import AccountDetailContent from "@/components/dashboard/account-detail-content";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";

const AccountDetailInner = () => {
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId") ?? "";

  if (!accountId) {
    return (
      <div className="max-w-2xl mx-auto px-2 py-8 space-y-4">
        <p className="text-muted-foreground">No account selected.</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/space_settings/accounts">Back to accounts</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-0 pb-24 md:pb-4">
      <AccountDetailContent accountId={accountId} />
    </div>
  );
};

export default function AccountDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <LoadingSpinner size="medium" />
        </div>
      }
    >
      <AccountDetailInner />
    </Suspense>
  );
}
