"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionCategory } from "@/types/transactionCategoryTypes";
import {
  buildCategoryDetailHref,
  CategoryKind,
  subcategoryCountLabel,
} from "@/utils/categoryManagement";

type CategoryListProps = {
  categories: TransactionCategory[];
  kind: CategoryKind;
  onAddRoot: () => void;
  addButtonLabel: string;
};

const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  kind,
  onAddRoot,
  addButtonLabel,
}) => {
  return (
    <div className="space-y-4">
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg bg-muted/20">
          No categories yet. Add your first category below.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories.map((category) => {
            const subCount = category.children?.length ?? 0;
            const hasSubcategories = subCount > 0;

            return (
              <Link
                key={category.id}
                href={buildCategoryDetailHref(category.id, kind)}
                className="flex items-center justify-between gap-2 px-3 py-3.5 min-h-0 bg-white rounded-lg hover:bg-muted/20 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-primary leading-tight">
                    {category.name}
                  </p>
                  {hasSubcategories ? (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {subcategoryCountLabel(subCount)}
                    </p>
                  ) : null}
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      )}

      <Button
        type="button"
        className="bg-primary hover:bg-primary/90 text-primary-foreground w-full"
        onClick={onAddRoot}
      >
        <Plus className="mr-2 h-5 w-5" />
        {addButtonLabel}
      </Button>
    </div>
  );
};

export default CategoryList;
