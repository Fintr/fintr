import React, { useState } from "react";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { FormError } from "@/components/ui/form-error";
import { useAuthApi } from "@/hooks/useAuthApi";
import { createEntity } from "@/services/entities/mutation";
import { toast } from "sonner";
import { extractFieldErrors } from "@/utils/errorUtils";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useQueryClient } from "@tanstack/react-query";

interface EntityCreationFormProps {
  onSuccess: (fullName: string) => void;
  entityType?: 'loan';
}

const EntityCreationForm: React.FC<EntityCreationFormProps> = ({
  onSuccess,
  entityType = 'loan'
}) => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const [entityName, setEntityName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localErrors, setLocalErrors] = useState<{ fullName?: string }>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string | string[]>>({});

  const handleAddEntity = async () => {
    if (!entityName.trim()) {
      setLocalErrors({ fullName: "Entity name is required" });
      return;
    }
    setLocalErrors({});
    setIsLoading(true);
    setValidationErrors({});

    try {
      const response = await createEntity(api, {
        fullName: entityName.trim(),
        entityType
      });
      
      toast.success(`"${entityName}" has been added.`);
      
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      
      const finalEntityName = response?.data?.full_name || entityName;
      setEntityName('');
      
      setTimeout(() => {
        onSuccess(finalEntityName);
      }, 100);
    } catch (error: any) {
      console.error("Failed to create entity:", error);
      
      // Handle nested error structure: error.error.details.errors.fullName
      let fieldErrors: Record<string, string | string[]> = {};
      
      if (error?.error?.details?.errors) {
        // Extract errors from the nested structure
        const errorDetails = error.error.details.errors;
        Object.keys(errorDetails).forEach((key) => {
          fieldErrors[key] = errorDetails[key];
        });
      } else {
        // Fallback to the standard extractFieldErrors
        fieldErrors = extractFieldErrors(error);
      }
      
      setValidationErrors(fieldErrors);
      
      if (Object.keys(fieldErrors).length === 0) {
        toast.error("Failed to create entity.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-3 p-3 border border-gray-200 rounded-md bg-gray-50">
      <div className="space-y-2">
        <Label htmlFor="new-entity-name">Full Name</Label>
        <Input
          id="new-entity-name"
          placeholder="Enter full name"
          value={entityName}
          onChange={(e) => {
            setEntityName(e.target.value);
            if (localErrors.fullName) setLocalErrors({});
            if (validationErrors.full_name || validationErrors.fullName) {
              setValidationErrors({});
            }
          }}
          className={
            localErrors.fullName || validationErrors.full_name || validationErrors.fullName
              ? "border-red-800 focus-visible:ring-red-800 bg-white"
              : "bg-white"
          }
          disabled={isLoading}
        />
        {localErrors.fullName && (
          <FormError className="text-red-900">{localErrors.fullName}</FormError>
        )}
        {(validationErrors.full_name || validationErrors.fullName) && (
          <FormError className="text-red-900">
            {Array.isArray(validationErrors.full_name)
              ? validationErrors.full_name[0]
              : Array.isArray(validationErrors.fullName)
              ? validationErrors.fullName[0]
              : String(validationErrors.full_name || validationErrors.fullName)}
          </FormError>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEntityName('');
            setLocalErrors({});
            setValidationErrors({});
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
          onClick={handleAddEntity}
        >
          {isLoading ? <LoadingSpinner size="small" className="mr-2" /> : "Add"}
        </Button>
      </div>
    </div>
  );
};

export default EntityCreationForm;
