"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import LoanDetailContent from "@/components/dashboard/loan-detail-content";

const LoanDetailInner = () => {
  const searchParams = useSearchParams();
  const loanId = searchParams.get("loanId") ?? "";

  if (!loanId) {
    return (
      <div className="max-w-2xl mx-auto px-2 py-8 space-y-4">
        <p className="text-muted-foreground">No loan selected.</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/loans">Back to loans</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-24 md:pb-4">
      <LoanDetailContent loanId={loanId} />
    </div>
  );
};

export default function LoanDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <LoadingSpinner size="medium" />
        </div>
      }
    >
      <LoanDetailInner />
    </Suspense>
  );
}
