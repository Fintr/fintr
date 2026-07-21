import React, { useState, useCallback, useEffect } from "react";
import { CustomModal } from "@/components/ui/custom-modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SquarePen, Edit } from "lucide-react";
import { toast } from "sonner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useQueryClient } from "@tanstack/react-query";
import { Loan } from "@/services/loans/queries";
import { updateLoan } from "@/services/loans/mutation";
import { ComboBox } from "@/components/ui/combobox";
import { fetchEntities, createEntity } from "@/services/entities/mutation";
import EntityCreationForm from "./EntityCreationForm";
import { extractFieldErrors } from "@/utils/errorUtils";
import { FormError } from "@/components/ui/form-error";
import { handleMultilineNotesKeyDown } from "@/lib/multiline-notes-keydown";
import { LOAN_DETAIL_KEY } from "@/hooks/async/useLoan";
import { StickyFormActions, pinnedFormScrollAreaClassName } from "./StickyFormActions";

interface EditLoanModalProps {
  loan: Loan;
  onUpdated?: () => void;
  triggerVariant?: "inline" | "toolbar";
}

const EditLoanModal: React.FC<EditLoanModalProps> = ({
  loan,
  onUpdated,
  triggerVariant = "inline",
}) => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [entityName, setEntityName] = useState(loan.entityName);
  const [description, setDescription] = useState(loan.description || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string | string[]>>({});
  const [showEntityCreation, setShowEntityCreation] = useState(false);
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);

  const isBorrowed = loan.loanType === "borrowed";
  const entityLabel = isBorrowed ? "Lender" : "Borrower";

  useEffect(() => {
    if (!isOpen) return;
    setEntityName(loan.entityName);
    setDescription(loan.description || "");
    setFormSubmitted(false);
    setValidationErrors({});
    setShowEntityCreation(false);
  }, [isOpen, loan.entityName, loan.description]);

  const fetchEntityOptions = useCallback(
    async (query: string): Promise<Array<{ label: string; value: string }>> => {
      try {
        const response = await fetchEntities(api, {
          entityType: "loan",
          search: query,
        });
        const entities = response?.data || [];
        return entities.map((entity: { id: string; fullName: string }) => ({
          label: entity.fullName || "",
          value: entity.fullName || "",
        }));
      } catch {
        return [];
      }
    },
    [api]
  );

  const handleEntityCreated = (fullName: string) => {
    if (fullName) {
      setEntityName(fullName);
    }
    setShowEntityCreation(false);
  };

  const handleAutoCreateEntity = async (
    fullName: string,
    onSuccess?: () => void
  ) => {
    if (!fullName.trim()) return;

    setIsCreatingEntity(true);
    try {
      const response = await createEntity(api, {
        fullName: fullName.trim(),
        entityType: "loan",
      });

      const createdEntityName = response?.data?.fullName || fullName.trim();
      queryClient.invalidateQueries({ queryKey: ["entities"] });
      setEntityName(createdEntityName);
      toast.success(`"${createdEntityName}" has been created and selected.`);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: unknown) {
      const fieldErrors = extractFieldErrors(error);
      const message =
        fieldErrors.fullName ||
        fieldErrors.full_name ||
        "Failed to create entity. Please try again.";
      toast.error(Array.isArray(message) ? message[0] : String(message));
    } finally {
      setIsCreatingEntity(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!entityName.trim()) {
      errors.entityName = `${entityLabel} name is required`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setFormSubmitted(true);

    if (!validateForm()) {
      return;
    }

    const trimmedEntity = entityName.trim();
    const trimmedDescription = description.trim();
    const entityChanged = trimmedEntity !== loan.entityName;
    const descriptionChanged = trimmedDescription !== (loan.description || "");

    if (!entityChanged && !descriptionChanged) {
      setIsOpen(false);
      return;
    }

    setIsSubmitting(true);
    setValidationErrors({});

    try {
      await updateLoan(api, {
        id: loan.id,
        entityName: entityChanged ? trimmedEntity : undefined,
        description: descriptionChanged ? trimmedDescription : undefined,
      });

      toast.success("Loan updated successfully");
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: [LOAN_DETAIL_KEY, loan.id] });
      onUpdated?.();
      setIsOpen(false);
    } catch (error: unknown) {
      const fieldErrors = extractFieldErrors(error);
      setValidationErrors(fieldErrors);

      if (Object.keys(fieldErrors).length === 0) {
        toast.error("Failed to update loan. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isToolbarTrigger = triggerVariant === "toolbar";

  return (
    <>
      <Button
        type="button"
        size={isToolbarTrigger ? "icon" : "sm"}
        variant={isToolbarTrigger ? "outline" : "ghost"}
        className={
          isToolbarTrigger
            ? "rounded-lg border-muted-foreground/25 text-foreground hover:bg-muted/60"
            : "h-6 w-6 p-0 text-primary hover:text-primary hover:bg-primary/10"
        }
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        aria-label={`Edit loan with ${loan.entityName}`}
      >
        {isToolbarTrigger ? (
          <SquarePen className="h-4 w-4" aria-hidden />
        ) : (
          <Edit className="h-3 w-3" />
        )}
      </Button>

      <CustomModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Edit Loan"
        maxWidth="lg"
        className="p-0"
        pinBodyLayout
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className={pinnedFormScrollAreaClassName}>
            <p className="text-left text-sm text-muted-foreground">
              You can update the {entityLabel.toLowerCase()} and notes for this loan.
              Principal, interest rate, term, and other loan terms cannot be changed here.
            </p>

            <div className="space-y-2">
              <Label htmlFor="edit-loan-entity" className="text-sm">
                {entityLabel}
              </Label>
              {!showEntityCreation ? (
                <>
                  <ComboBox
                    filterType="backend"
                    fetchOptions={fetchEntityOptions}
                    debounceTime={300}
                    placeholder={
                      isBorrowed
                        ? "Type to search lender..."
                        : "Type to search borrower..."
                    }
                    value={entityName || undefined}
                    onChange={(value) => {
                      setEntityName(value);
                      if (formSubmitted && validationErrors.entityName) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          entityName: "",
                        }));
                      }
                    }}
                    renderNotFound={(searchValue, selectValue) => (
                      <div className="p-2">
                        <div className="text-sm text-gray-500 mb-2">
                          No entity found for &quot;{searchValue}&quot;
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            handleAutoCreateEntity(searchValue, selectValue);
                          }}
                          disabled={isCreatingEntity}
                          className="w-full"
                        >
                          {isCreatingEntity
                            ? "Creating..."
                            : `+ Create "${searchValue}"`}
                        </Button>
                      </div>
                    )}
                    className={
                      formSubmitted && validationErrors.entityName
                        ? "border-red-800 focus-visible:ring-red-800"
                        : ""
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEntityCreation(true)}
                    className="text-xs text-primary mt-1"
                  >
                    + Add New {entityLabel}
                  </Button>
                </>
              ) : (
                <EntityCreationForm
                  onSuccess={handleEntityCreated}
                  entityType="loan"
                />
              )}
              {formSubmitted && validationErrors.entityName && (
                <FormError
                  message={
                    Array.isArray(validationErrors.entityName)
                      ? validationErrors.entityName[0]
                      : validationErrors.entityName
                  }
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-loan-notes" className="text-sm">
                Note (Optional)
              </Label>
              <Textarea
                id="edit-loan-notes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleMultilineNotesKeyDown}
                placeholder="Add additional details"
                className="text-sm min-h-[80px]"
              />
            </div>
          </div>

          <StickyFormActions className="justify-end">
            <div className="flex gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </StickyFormActions>
        </div>
      </CustomModal>
    </>
  );
};

export default EditLoanModal;
