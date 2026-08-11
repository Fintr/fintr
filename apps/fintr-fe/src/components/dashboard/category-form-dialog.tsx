import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import { CategoryAppearancePicker } from "@/components/dashboard/category-appearance-picker";
import { resolveCategoryAppearance } from "@/utils/categoryAppearance";
import { toast } from "sonner";

interface CategoryItem {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  categoryType?: CategoryTypeEnum;
  [key: string]: unknown;
}

interface CategoryFormDialogProps {
  category?: CategoryItem;
  categoryType?: CategoryTypeEnum;
  parentId?: string | null;
  parentName?: string;
  onUpdate?: (
    categoryId: string,
    updateData: {
      name: string;
      icon: string;
      color: string;
    },
  ) => Promise<void>;
  onAdd?: (
    name: string,
    categoryType: CategoryTypeEnum,
    parentId: string | null | undefined,
    appearance: {
      icon: string;
      color: string;
    },
  ) => Promise<void>;
  isLoading?: boolean;
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CategoryFormDialog: React.FC<CategoryFormDialogProps> = ({
  category,
  categoryType,
  parentId = null,
  parentName,
  onUpdate,
  onAdd,
  isLoading = false,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled
    ? (open: boolean) => controlledOnOpenChange?.(open)
    : setInternalOpen;

  const resolvedCategoryType =
    category?.categoryType ?? categoryType ?? CategoryTypeEnum.EXPENSE;

  const initialAppearance = resolveCategoryAppearance({
    name: category?.name ?? "",
    categoryType: resolvedCategoryType,
    icon: category?.icon,
    color: category?.color,
  });

  const [categoryName, setCategoryName] = useState(category?.name || "");
  const [icon, setIcon] = useState(initialAppearance.icon);
  const [color, setColor] = useState(initialAppearance.color);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const appearance = resolveCategoryAppearance({
      name: category?.name ?? "",
      categoryType: resolvedCategoryType,
      icon: category?.icon,
      color: category?.color,
    });

    setCategoryName(category?.name || "");
    setIcon(appearance.icon);
    setColor(appearance.color);
  }, [
    category?.color,
    category?.icon,
    category?.name,
    isOpen,
    resolvedCategoryType,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryName.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const appearance = resolveCategoryAppearance({
        name: categoryName.trim(),
        categoryType: resolvedCategoryType,
        icon,
        color,
      });

      if (category && onUpdate) {
        const unchanged =
          categoryName.trim() === category.name &&
          appearance.icon === category.icon &&
          appearance.color === category.color?.toUpperCase();

        if (unchanged) {
          setIsOpen(false);
          return;
        }

        await onUpdate(category.id, {
          name: categoryName.trim(),
          icon: appearance.icon,
          color: appearance.color,
        });
        toast.success(`Category updated to "${categoryName.trim()}"`);
      } else if (onAdd && categoryType) {
        await onAdd(
          categoryName.trim(),
          categoryType,
          parentId,
          appearance,
        );
        const label = parentId
          ? `Subcategory "${categoryName.trim()}" created`
          : `New ${categoryType} category "${categoryName.trim()}" created`;
        toast.success(label);
      } else {
        console.error("Invalid operation for CategoryFormDialog");
        return;
      }
      setIsOpen(false);
      setCategoryName("");
    } catch (error) {
      console.error("Failed to save category:", error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setCategoryName(category?.name || "");
    setIsOpen(false);
  };

  const isSubcategoryCreate = !category && Boolean(parentId);
  const typeLabel =
    categoryType === CategoryTypeEnum.INCOME ? "Income" : "Expense";

  const dialogTitle = category
    ? "Edit category"
    : isSubcategoryCreate
      ? `Add subcategory to ${parentName ?? "category"}`
      : `Add new ${typeLabel.toLowerCase()} category`;

  const submitButtonText = category
    ? isSubmitting || isLoading
      ? "Updating..."
      : "Update"
    : isSubmitting || isLoading
      ? "Creating..."
      : "Create";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Enter category name"
              disabled={isSubmitting || isLoading}
              autoFocus
            />
          </div>

          <CategoryAppearancePicker
            icon={icon}
            color={color}
            onIconChange={setIcon}
            onColorChange={setColor}
            disabled={isSubmitting || isLoading}
          />

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting || isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || isLoading || !categoryName.trim()
              }
            >
              {submitButtonText}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryFormDialog;
