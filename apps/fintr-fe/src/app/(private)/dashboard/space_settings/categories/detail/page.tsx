"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import CategoryDetailContent from "@/components/dashboard/category-detail-content";
import { CategoryKind } from "@/utils/categoryManagement";

const CategoryDetailInner = () => {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId") ?? "";
  const kindParam = searchParams.get("kind");
  const kind: CategoryKind | null =
    kindParam === "income" || kindParam === "expense" ? kindParam : null;

  if (!categoryId || !kind) {
    return (
      <div className="max-w-2xl mx-auto px-2 py-8 space-y-4">
        <p className="text-muted-foreground">No category selected.</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/space_settings/categories">
            Back to categories
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-2 pt-4 pb-24 md:pb-4">
      <CategoryDetailContent categoryId={categoryId} kind={kind} />
    </div>
  );
};

export default function CategoryDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <LoadingSpinner size="medium" />
        </div>
      }
    >
      <CategoryDetailInner />
    </Suspense>
  );
}
