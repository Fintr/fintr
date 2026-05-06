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
import { Pencil } from "lucide-react"; // Removed Plus as it will be in the trigger
import { toast } from "sonner";
import { createTransactionCategory, updateTransactionCategory } from "@/services/transactions/categories/mutation";
import { CategoryTypeEnum } from "@/types/categoryTypes";

interface CategoryItem {
  id: string;
  name: string;
  color?: string;
  [key: string]: any;
}

interface CategoryFormDialogProps {
  category?: CategoryItem; // Optional for creation
  categoryType?: CategoryTypeEnum; // Required for creation
  onUpdate?: (categoryId: string, newName: string) => Promise<void>;
  onAdd?: (name: string, categoryType: CategoryTypeEnum) => Promise<void>;
  isLoading?: boolean;
  trigger: React.ReactNode; // New prop for the trigger element
}

const CategoryFormDialog: React.FC<CategoryFormDialogProps> = ({
  category,
  categoryType,
  onUpdate,
  onAdd,
  isLoading = false,
  trigger,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [categoryName, setCategoryName] = useState(category?.name || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when category changes or dialog opens
  useEffect(() => {
    setCategoryName(category?.name || "");
  }, [category?.name, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryName.trim()) {
      toast.error("Category name cannot be empty");
      return;
    }

    setIsSubmitting(true);
    try {
      if (category && onUpdate) { // Editing existing category
        if (categoryName.trim() === category.name) {
          setIsOpen(false);
          return;
        }
        await onUpdate(category.id, categoryName.trim());
        toast.success(`Category updated to "${categoryName.trim()}"`);
      } else if (onAdd && categoryType) { // Adding new category
        await onAdd(categoryName.trim(), categoryType);
        toast.success(`New ${categoryType} category "${categoryName.trim()}" created!`);
      } else {
        console.error("Invalid operation for CategoryFormDialog");
        toast.error("Invalid operation");
      }
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to save category:", error);
      toast.error("Failed to save category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setCategoryName(category?.name || ""); // Reset to original name or empty
    setIsOpen(false);
  };

  const dialogTitle = category ? "Edit Category" : `Add New ${categoryType === CategoryTypeEnum.EXPENSE ? 'Expense' : 'Income'} Category`;
  const submitButtonText = category ? (isSubmitting ? "Updating..." : "Update") : (isSubmitting ? "Creating..." : "Create");

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Category Name</Label>
            <Input
              id="category-name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Enter category name"
              disabled={isSubmitting}
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !categoryName.trim()}
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
