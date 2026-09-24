"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { RecurringSeriesDetailContent } from "@/components/dashboard/recurring/recurring-series-detail-content";
import { resolveDetailSearchParam } from "@/utils/detailSearchParam";

const RecurringDetailInner = () => {
  const searchParams = useSearchParams();
  const seriesId = resolveDetailSearchParam("seriesId", searchParams);

  if (!seriesId) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <p className="text-muted-foreground">No recurring series selected.</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/recurring">Back to recurring</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pt-6 pb-24 sm:px-6 md:pb-8">
      <RecurringSeriesDetailContent seriesId={seriesId} />
    </div>
  );
};

export default function RecurringDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <LoadingSpinner size="medium" />
        </div>
      }
    >
      <RecurringDetailInner />
    </Suspense>
  );
}
