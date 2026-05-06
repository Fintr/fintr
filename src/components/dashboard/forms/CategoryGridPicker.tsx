import React, { useState } from "react";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import { Edit2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import CategoryCreationForm from "./CategoryCreationForm";
import { CategoryTypeEnum } from "@/types/categoryTypes";

interface CategoryGridPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  categories: Array<{ label: string; value: string }>;
  error?: string[];
  categoryType: CategoryTypeEnum;
  onCategoryCreated?: (categoryName: string) => void;
  disabled?: boolean;
}

const CategoryGridPicker: React.FC<CategoryGridPickerProps> = ({
  label,
  value,
  onChange,
  categories,
  error,
  categoryType,
  onCategoryCreated,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);

  const handleCategorySelect = (categoryValue: string) => {
    onChange(categoryValue);
    setIsOpen(false);
  };

  const handleCategoryCreated = (categoryName: string) => {
    onChange(categoryName);
    if (onCategoryCreated) onCategoryCreated(categoryName);
    setShowCustomCategoryInput(false);
    setIsOpen(false);
  };

  const selectedCategory = categories.find((cat) => cat.value === value);

  return (
    <div className="space-y-2 min-w-0">
      <Label htmlFor="category" className="text-sm">{label}</Label>
      
      <Button
        type="button"
        variant="outline"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={cn(
          "w-full justify-start text-left font-normal text-sm h-10",
          !value && "text-muted-foreground",
          error && error.length > 0 && "border-red-800 focus-visible:ring-red-800"
        )}
      >
        {value ? (
          <span className="font-medium">{selectedCategory?.label}</span>
        ) : (
          <span>Select category</span>
        )}
      </Button>

      {error && error.length > 0 && (
        <p className="text-sm text-red-600">{error[0]}</p>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="text-lg font-semibold">Category</h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCustomCategoryInput(true)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                    setShowCustomCategoryInput(false);
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {showCustomCategoryInput ? (
                <div className="space-y-4">
                  <CategoryCreationForm
                    onSuccess={handleCategoryCreated}
                    categoryType={categoryType}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCustomCategoryInput(false)}
                    className="w-full"
                  >
                    Back to Categories
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {categories.map((category) => (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => handleCategorySelect(category.value)}
                      className={cn(
                        "flex items-center justify-center p-4 rounded-lg border-2 transition-all hover:border-primary/50 min-h-[60px]",
                        value === category.value
                          ? "border-primary bg-primary text-white font-semibold shadow-sm"
                          : "border-gray-200 hover:bg-gray-50 font-medium text-gray-700"
                      )}
                    >
                      <span className="text-sm text-center leading-tight">{category.label}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowCustomCategoryInput(true)}
                    className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-gray-300 transition-all hover:border-primary hover:bg-primary/5 min-h-[60px]"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">Add New</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryGridPicker;
