"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { EntityDetailContent } from "@/components/dashboard/entities/entity-detail-content";

const EntityDetailInner = () => {
  const searchParams = useSearchParams();
  const entityId = searchParams.get("entityId") ?? "";

  if (!entityId) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-2 py-8">
        <p className="text-muted-foreground">No entity selected.</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/space_settings/entities">Back to entities</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-2 pt-4 pb-24 md:pb-4">
      <EntityDetailContent entityId={entityId} />
    </div>
  );
};

export default function EntityDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <LoadingSpinner size="medium" />
        </div>
      }
    >
      <EntityDetailInner />
    </Suspense>
  );
}
