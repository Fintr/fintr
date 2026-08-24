"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SubcategoryChipOption = {
  id: string;
  name: string;
};

type CategorySubcategoryChipsProps = {
  subcategories: SubcategoryChipOption[];
  selectedSubcategoryId: string | null;
  onSelect: (subcategoryId: string | null) => void;
};

export function CategorySubcategoryChips({
  subcategories,
  selectedSubcategoryId,
  onSelect,
}: CategorySubcategoryChipsProps) {
  if (subcategories.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Filter by subcategory"
    >
      <Button
        type="button"
        variant={selectedSubcategoryId === null ? "default" : "outline"}
        size="sm"
        className={cn("h-8 rounded-full px-3")}
        aria-pressed={selectedSubcategoryId === null}
        onClick={() => onSelect(null)}
      >
        All
      </Button>
      {subcategories.map((sub) => {
        const isSelected = selectedSubcategoryId === sub.id;

        return (
          <Button
            key={sub.id}
            type="button"
            variant={isSelected ? "default" : "outline"}
            size="sm"
            className="h-8 rounded-full px-3"
            aria-pressed={isSelected}
            onClick={() => onSelect(sub.id)}
          >
            {sub.name}
          </Button>
        );
      })}
    </div>
  );
}
