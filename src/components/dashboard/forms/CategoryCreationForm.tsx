import React, { useState } from "react";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { FormError } from "@/components/ui/form-error";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useAtom, useSetAtom } from "jotai";
import { createCategoryAtom, categoryValidationErrorsAtom } from "@/atoms/transactionCategoryAtoms";
import { toast } from "sonner";
import { extractFieldErrors } from "@/utils/errorUtils";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface CategoryCreationFormProps {
  onSuccess: (name: string) => void;
  categoryType: CategoryTypeEnum;
  horizontal?: boolean; // Whether to display in horizontal layout (similar to AccountCreationForm)
}

const CategoryCreationForm: React.FC<CategoryCreationFormProps> = ({
  onSuccess,
  categoryType,
  horizontal = false
}) => {
  const { api } = useAuthApi();
  const addCategory = useSetAtom(createCategoryAtom);
  const [categoryValidationErrors, setCategoryValidationErrors] = useAtom(categoryValidationErrorsAtom);
  const [categoryName, setCategoryName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localErrors, setLocalErrors] = useState<{ name?: string }>({});

  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      setLocalErrors({ name: "Category name is required" });
      return;
    }
    setLocalErrors({}); 
    setIsLoading(true);
    setCategoryValidationErrors({}); 

    try {
      const createdCategoryName = await addCategory({
        api,
        categoryData: { name: categoryName, categoryType: categoryType }
      });
      toast.success(`"${categoryName}" has been added.`);

      // Ensure we call onSuccess with the correct category name
      const finalCategoryName = createdCategoryName || categoryName;
      setCategoryName(''); 
      
      // Delay onSuccess to ensure state updates complete first
      setTimeout(() => {
        onSuccess(finalCategoryName);
      }, 100);
    } catch (error) {
      console.error("Failed to create category:", error);
      const fieldErrors = extractFieldErrors(error);
      setCategoryValidationErrors(fieldErrors); 
      if (!fieldErrors.name) {
        toast.error("Failed to create category.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const placeholderText = categoryType === CategoryTypeEnum.INCOME 
    ? "Enter new income category" 
    : "Enter new expense category";
  
  return (
    <div className="mt-3 p-3 border border-gray-200 rounded-md bg-gray-50">
      <div className={horizontal ? "flex gap-4 items-end" : ""}>
        <div className={horizontal ? "flex-1" : "space-y-2"}>
          <Label htmlFor="new-category-name">Category Name</Label>
          <Input
            id="new-category-name"
            placeholder={placeholderText}
            value={categoryName}
            onChange={(e) => {
              setCategoryName(e.target.value);
              if (localErrors.name) setLocalErrors({}); 
            }}
            className={localErrors.name || categoryValidationErrors.name ? "border-red-800 focus-visible:ring-red-800 bg-white" : "bg-white"}
            disabled={isLoading}
          />
          {localErrors.name && <FormError>{localErrors.name}</FormError>}
          {!localErrors.name && categoryValidationErrors.name && (
            <FormError>
              {Array.isArray(categoryValidationErrors.name) 
                ? categoryValidationErrors.name[0] 
                : String(categoryValidationErrors.name)}
            </FormError>
          )}
        </div>
        
        {horizontal && (
          <div className="flex">
            <Button 
              type="button" 
              size="sm" 
              disabled={isLoading} 
              className="bg-primary hover:bg-primary/80 h-10" 
              onClick={handleAddCategory}
            >
              {isLoading ? <LoadingSpinner size="small" className="mr-2" /> : "Add"}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              className="ml-2 h-10" 
              onClick={() => { 
                setCategoryName(''); 
                setLocalErrors({}); 
                setCategoryValidationErrors({}); 
                onSuccess(""); 
              }} 
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
      
      {!horizontal && (
        <div className="flex gap-2 mt-3">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => { 
              setCategoryName(''); 
              setLocalErrors({}); 
              setCategoryValidationErrors({}); 
              onSuccess(""); 
            }} 
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            size="sm" 
            disabled={isLoading} 
            className="bg-primary hover:bg-primary/80" 
            onClick={handleAddCategory}
          >
            {isLoading ? <LoadingSpinner size="small" className="mr-2" /> : "Add"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CategoryCreationForm; 
