"use client";

import React from "react";
import { CustomModal } from "@/components/ui/custom-modal";
import CategoryActionsMenu, {
  CategoryMenuItem,
} from "@/components/dashboard/category-actions-menu";
import { CategoryIconBadge } from "@/components/dashboard/category-icon-badge";

type ManageSubcategory = {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
};

type CategoryManageSubcategoriesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentName: string;
  subcategories: ManageSubcategory[];
  onEdit: (item: CategoryMenuItem) => void;
  onDelete: (item: CategoryMenuItem) => void;
  onConvertToParent: (item: CategoryMenuItem) => void;
};

export function CategoryManageSubcategoriesSheet({
  open,
  onOpenChange,
  parentName,
  subcategories,
  onEdit,
  onDelete,
  onConvertToParent,
}: CategoryManageSubcategoriesSheetProps) {
  return (
    <CustomModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Manage subcategories"
      maxWidth="md"
    >
      <div className="px-6 pb-6">
        <p className="mb-4 text-sm text-muted-foreground">
          Edit names and icons for {parentName} subcategories.
        </p>
        {subcategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No subcategories yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {subcategories.map((sub) => (
              <li
                key={sub.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CategoryIconBadge
                    icon={sub.icon}
                    color={sub.color}
                    size="sm"
                  />
                  <span className="truncate text-sm text-foreground">
                    {sub.name}
                  </span>
                </div>
                <CategoryActionsMenu
                  item={{
                    id: sub.id,
                    name: sub.name,
                    icon: sub.icon ?? undefined,
                    color: sub.color ?? undefined,
                  }}
                  variant="subcategory"
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onConvertToParent={onConvertToParent}
                  triggerClassName="h-7 w-7"
                />
            </li>
          ))}
        </ul>
        )}
      </div>
    </CustomModal>
  );
}
