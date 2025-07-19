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
import { Pencil } from "lucide-react";
import { toast } from "sonner";

interface CategoryItem {
  id: string;
  name: string;
  color?: string;
  [key: string]: any;
}

interface EditCategoryDialogProps {
  category: CategoryItem;
  onUpdate: (categoryId: string, newName: string) => Promise<void>;
  isLoading?: boolean;
}

const EditCategoryDialog: React.FC<EditCategoryDialogProps> = ({
  category,
  onUpdate,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [categoryName, setCategoryName] = useState(category.name);
  const [isUpdating, setIsUpdating] = useState(false);

  // Reset form when category changes or dialog opens
  useEffect(() => {
    setCategoryName(category.name);
  }, [category.name, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryName.trim()) {
      toast.error("Category name cannot be empty");
      return;
    }

    if (categoryName.trim() === category.name) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate(category.id, categoryName.trim());
      toast.success(`Category updated to "${categoryName.trim()}"`);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to update category:", error);
      toast.error("Failed to update category");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setCategoryName(category.name); // Reset to original name
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-primary hover:bg-blue-50"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Category Name</Label>
            <Input
              id="category-name"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Enter category name"
              disabled={isUpdating}
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUpdating || !categoryName.trim()}
            >
              {isUpdating ? "Updating..." : "Update"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditCategoryDialog; 
