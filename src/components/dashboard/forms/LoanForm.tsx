import React, { useState, useCallback } from "react";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Button } from "../../ui/button";
import { Upload, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Calendar } from "../../ui/calendar";
import { format } from "date-fns";
import ExpandableTextarea from "../../ui/expandable-textarea";
import { toast } from "sonner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useQueryClient } from "@tanstack/react-query";
import { createLoan } from "@/services/loans/mutation";
import { numberFormatting } from "@/lib/utils";
import { useNumberInput } from "@/hooks/useNumberInput";
import { extractFieldErrors } from "@/utils/errorUtils";
import { FormError } from "@/components/ui/form-error";
import { ComboBox } from "@/components/ui/combobox";
import { fetchEntities, createEntity } from "@/services/entities/mutation";
import EntityCreationForm from "./EntityCreationForm";
import { useAtomValue } from "jotai";
import { accountOptionsAtom } from "@/atoms/dashboardAtoms";
import AccountCreationForm from "./AccountCreationForm";

interface LoanFormProps {
  date?: Date | undefined;
  setDate?: React.Dispatch<React.SetStateAction<Date | undefined>>;
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
}

const LoanForm: React.FC<LoanFormProps> = ({
  date,
  setDate,
  onSubmitSuccess = () => {},
  onCancel = () => {},
}) => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  
  // Internal state for the form
  const [loanForm, setLoanForm] = useState({
    amount: "",
    description: "",
    type: "borrowed" as "borrowed" | "lent",
    entityName: "",
    accountName: "",
    interestRate: "",
    loanTerm: "",
    receipt: null as File | null,
  });

  const accountOptions = useAtomValue(accountOptionsAtom);
  const [showCustomAccountInput, setShowCustomAccountInput] = useState(false);

  // Number input hook for principal amount field
  const principalAmountInput = useNumberInput({
    initialValue: loanForm.amount,
    onValueChange: (cleanValue) => {
      setLoanForm((prev) => ({ ...prev, amount: cleanValue.toString() }));
    }
  });

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string | string[]>>({});
  const [showEntityCreation, setShowEntityCreation] = useState(false);
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);

  const fetchEntityOptions = useCallback(async (query: string): Promise<Array<{ label: string; value: string }>> => {
    try {
      const response = await fetchEntities(api, {
        entityType: 'loan',
        search: query
      });
      // Response structure from fetchEntities: { success: true, data: [...] }
      // The data array contains entities with camelCase keys (fullName)
      const entities = response?.data || [];
      return entities.map((entity: { id: string; fullName: string }) => {
        const fullName = entity.fullName || '';
        return {
          label: fullName,
          value: fullName
        };
      });
    } catch (error: any) {
      // Silently handle errors to prevent console spam and stack frame requests
      // Only log if it's not a validation error (422) or auth error
      if (error?.error?.message !== "Unprocessable Entity" && error?.status !== 422) {
        console.error('Error fetching entities:', error);
      }
      return [];
    }
  }, [api]);

  const handleEntityCreated = (fullName: string) => {
    if (fullName) {
      setLoanForm((prev) => ({ ...prev, entityName: fullName }));
    }
    setShowEntityCreation(false);
  };

  const handleAutoCreateEntity = async (fullName: string, onSuccess?: () => void) => {
    if (!fullName.trim()) return;
    
    setIsCreatingEntity(true);
    try {
      const response = await createEntity(api, {
        fullName: fullName.trim(),
        entityType: 'loan'
      });
      
      const createdEntityName = response?.data?.fullName || fullName.trim();
      
      // Invalidate queries to refresh the entity list
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      
      // Update the form with the created entity
      setLoanForm((prev) => ({ ...prev, entityName: createdEntityName }));
      
      toast.success(`"${createdEntityName}" has been created and selected.`);
      
      // Call success callback to close combobox
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Failed to create entity:", error);
      
      // Extract and show validation errors
      const fieldErrors = extractFieldErrors(error);
      if (fieldErrors.fullName || fieldErrors.full_name) {
        const errorMessage = Array.isArray(fieldErrors.fullName) 
          ? fieldErrors.fullName[0]
          : Array.isArray(fieldErrors.full_name)
          ? fieldErrors.full_name[0]
          : String(fieldErrors.fullName || fieldErrors.full_name || "Failed to create entity");
        toast.error(errorMessage);
      } else {
        toast.error("Failed to create entity. Please try again.");
      }
    } finally {
      setIsCreatingEntity(false);
    }
  };

  // Handle file upload for this form
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLoanForm((prev) => ({ ...prev, receipt: file }));
    } else {
      setLoanForm((prev) => ({ ...prev, receipt: null }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const amountValue = numberFormatting.cleanForBackend(principalAmountInput.displayValue);
    if (!principalAmountInput.displayValue || amountValue <= 0) {
      errors.amount = "Principal amount is required and must be greater than 0";
    }

    const interestRateValue = parseFloat(loanForm.interestRate);
    if (!loanForm.interestRate || isNaN(interestRateValue) || interestRateValue < 0 || interestRateValue > 100) {
      errors.interestRate = "Interest rate must be between 0 and 100";
    }

    if (!loanForm.loanTerm || parseInt(loanForm.loanTerm) <= 0) {
      errors.loanTerm = "Loan term is required and must be greater than 0";
    }

            if (!loanForm.entityName.trim()) {
              errors.entityName = `${loanForm.type === "borrowed" ? "Lender" : "Borrower"} name is required`;
            }

            if (!loanForm.accountName.trim()) {
              errors.accountName = "Account is required";
            }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setFormSubmitted(true);
    
    if (!validateForm()) {
      return;
    }

    if (!date) {
      toast.error("Please select a date");
      return;
    }

    setIsSubmitting(true);
    setValidationErrors({});

            try {
              const loanData = {
                principalAmount: numberFormatting.cleanForBackend(principalAmountInput.displayValue),
                interestRate: parseFloat(loanForm.interestRate),
                date: format(date, "yyyy-MM-dd"),
                loanType: loanForm.type,
                entityName: loanForm.entityName.trim(),
                accountName: loanForm.accountName.trim(),
                loanTermMonths: parseInt(loanForm.loanTerm),
                description: loanForm.description || "",
                ...(loanForm.receipt && { file: loanForm.receipt })
              };

      const response = await createLoan(api, loanData);
      toast.success("Loan created successfully");
      
      if (onSubmitSuccess) {
        onSubmitSuccess(response);
      }

              // Reset form
              setLoanForm({
                amount: "",
                description: "",
                type: "borrowed",
                entityName: "",
                accountName: "",
                interestRate: "",
                loanTerm: "",
                receipt: null,
              });
              setShowCustomAccountInput(false);
              principalAmountInput.reset();
              setFormSubmitted(false);
    } catch (error) {
      console.error("Failed to create loan:", error);
      const fieldErrors = extractFieldErrors(error);
      setValidationErrors(fieldErrors);
      
      if (Object.keys(fieldErrors).length === 0) {
        toast.error("Failed to create loan. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* First row: Date and Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan-date" className="text-sm">Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className="w-full justify-start text-left font-normal text-sm"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "MMM d, yyyy") : <span className="text-sm">Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
                <div className="space-y-2">
                  <Label htmlFor="loan-amount" className="text-sm">Principal Amount</Label>
                  <Input
                    id="loan-amount"
                    type="text"
                    placeholder="0.00"
                    value={principalAmountInput.displayValue}
                    onChange={(e) => {
                      principalAmountInput.handleInputChange(e.target.value);
                      if (formSubmitted && validationErrors.amount) {
                        setValidationErrors({ ...validationErrors, amount: "" });
                      }
                    }}
                    className={`text-sm ${formSubmitted && validationErrors.amount ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                  />
                  {formSubmitted && validationErrors.amount && (
                    <FormError message={Array.isArray(validationErrors.amount) ? validationErrors.amount[0] : validationErrors.amount} />
                  )}
                </div>
      </div>

      {/* Second row: Interest Rate and Loan Term */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan-interest-rate" className="text-sm">Interest Rate (%)</Label>
          <Input
            id="loan-interest-rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="0.00"
            value={loanForm.interestRate}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = parseFloat(value);
              
              // Allow empty string for deletion
              if (value === "" || value === "-" || value === ".") {
                setLoanForm({ ...loanForm, interestRate: value });
                if (formSubmitted && validationErrors.interestRate) {
                  setValidationErrors({ ...validationErrors, interestRate: "" });
                }
                return;
              }
              
              // Prevent values outside 0-100 range
              if (!isNaN(numValue)) {
                if (numValue < 0) {
                  setLoanForm({ ...loanForm, interestRate: "0" });
                } else if (numValue > 100) {
                  setLoanForm({ ...loanForm, interestRate: "100" });
                } else {
                  setLoanForm({ ...loanForm, interestRate: value });
                }
                
                if (formSubmitted && validationErrors.interestRate) {
                  setValidationErrors({ ...validationErrors, interestRate: "" });
                }
              }
            }}
            onBlur={(e) => {
              const value = e.target.value;
              const numValue = parseFloat(value);
              
              // Clamp value on blur if it's outside range
              if (value && !isNaN(numValue)) {
                if (numValue < 0) {
                  setLoanForm({ ...loanForm, interestRate: "0" });
                } else if (numValue > 100) {
                  setLoanForm({ ...loanForm, interestRate: "100" });
                }
              }
            }}
            className={`text-sm ${formSubmitted && validationErrors.interestRate ? "border-red-800 focus-visible:ring-red-800" : ""}`}
          />
          {formSubmitted && validationErrors.interestRate && (
            <FormError message={Array.isArray(validationErrors.interestRate) ? validationErrors.interestRate[0] : validationErrors.interestRate} />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="loan-term" className="text-sm">Loan Term (Months)</Label>
          <div className="relative">
            <Input
              id="loan-term"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="0"
              value={loanForm.loanTerm}
              onChange={(e) => {
                setLoanForm({ ...loanForm, loanTerm: e.target.value });
                if (formSubmitted && validationErrors.loanTerm) {
                  setValidationErrors({ ...validationErrors, loanTerm: "" });
                }
              }}
              className="pr-16 text-sm"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500 text-sm">
              Month{parseInt(loanForm.loanTerm) !== 1 ? "s" : ""}
            </div>
          </div>
          {formSubmitted && validationErrors.loanTerm && (
            <FormError message={Array.isArray(validationErrors.loanTerm) ? validationErrors.loanTerm[0] : validationErrors.loanTerm} />
          )}
        </div>
      </div>

      {/* Third row: Loan Type and Person */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan-type" className="text-sm">Loan Type</Label>
          <Select
            value={loanForm.type}
            onValueChange={(value) => {
              setLoanForm((prev) => ({ ...prev, type: value as "borrowed" | "lent" }));
            }}
          >
            <SelectTrigger id="loan-type" className="text-sm w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="borrowed" className="text-sm">Money Borrowed</SelectItem>
              <SelectItem value="lent" className="text-sm">Money Lent</SelectItem>
            </SelectContent>
          </Select>
        </div>
                <div className="space-y-2">
                  <Label htmlFor="loan-entity" className="text-sm">
                    {loanForm.type === "borrowed" ? "Lender" : "Borrower"}
                  </Label>
                  {!showEntityCreation ? (
                    <>
                      <ComboBox
                        filterType="backend"
                        fetchOptions={fetchEntityOptions}
                        debounceTime={300}
                        placeholder={
                          loanForm.type === "borrowed"
                            ? "Type to search lender..."
                            : "Type to search borrower..."
                        }
                        value={loanForm.entityName || undefined}
                        onChange={(value) => {
                          setLoanForm((prev) => ({ ...prev, entityName: value }));
                          if (formSubmitted && validationErrors.entityName) {
                            setValidationErrors((prev) => ({ ...prev, entityName: "" }));
                          }
                        }}
                        renderNotFound={(searchValue, selectValue) => (
                          <div className="p-2">
                            <div className="text-sm text-gray-500 mb-2">
                              No entity found for "{searchValue}"
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
                              {isCreatingEntity ? "Creating..." : `+ Create "${searchValue}"`}
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
                        + Add New {loanForm.type === "borrowed" ? "Lender" : "Borrower"}
                      </Button>
                    </>
                  ) : (
                    <EntityCreationForm
                      onSuccess={handleEntityCreated}
                      entityType="loan"
                    />
                  )}
                  {formSubmitted && validationErrors.entityName && (
                    <FormError message={Array.isArray(validationErrors.entityName) ? validationErrors.entityName[0] : validationErrors.entityName} />
                  )}
                </div>
      </div>

      {/* Fourth row: Account */}
      <div className="space-y-2">
        <Label htmlFor="loan-account" className="text-sm">Account</Label>
        <Select
          value={loanForm.accountName}
          onValueChange={(value) => {
            if (value === "add_account") {
              setShowCustomAccountInput(true);
            } else {
              setShowCustomAccountInput(false);
              setLoanForm((prev) => ({ ...prev, accountName: value }));
              if (formSubmitted && validationErrors.accountName) {
                setValidationErrors({ ...validationErrors, accountName: "" });
              }
            }
          }}
        >
          <SelectTrigger
            id="loan-account"
            className={`text-sm w-full ${formSubmitted && validationErrors.accountName ? "border-red-800 focus-visible:ring-red-800" : ""}`}
          >
            <SelectValue placeholder="Select Account" />
          </SelectTrigger>
          <SelectContent>
            {accountOptions.map((acc) => (
              <SelectItem key={acc.value} value={acc.value} className="text-sm">
                {acc.label}
              </SelectItem>
            ))}
            <SelectItem value="add_account" className="text-sm">+ Add Account</SelectItem>
          </SelectContent>
        </Select>
        {formSubmitted && validationErrors.accountName && (
          <FormError message={Array.isArray(validationErrors.accountName) ? validationErrors.accountName[0] : validationErrors.accountName} />
        )}

        {showCustomAccountInput && (
          <AccountCreationForm
            onSuccess={(accountName) => {
              setLoanForm((prev) => ({ ...prev, accountName }));
              setShowCustomAccountInput(false);
              queryClient.invalidateQueries({ queryKey: ['accounts'] });
            }}
          />
        )}
      </div>

      {/* Fifth row: Description */}
      <div className="w-full">
        <Label htmlFor="loan-description" className="text-sm">Note (Optional)</Label>
        <ExpandableTextarea
          id="loan-description"
          value={loanForm.description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLoanForm({ ...loanForm, description: e.target.value })}
          placeholder="Add additional details"
          className="mt-1"
        />
      </div>

      {/* Sixth row: Attachment field (full width) */}
      <div className="space-y-2">
        <Label className="text-sm">Attach Doc (Optional)</Label>
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() =>
            document.getElementById("loan-receipt-upload")?.click()
          }
        >
          <div className="flex flex-col items-center">
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              Drag & drop your document here or{" "}
              <span className="text-primary font-medium">browse files</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supports: JPG, PNG, PDF (Max 5MB)
            </p>
            {loanForm.receipt && (
              <p className="text-sm text-teal-600 mt-2">
                File selected: {loanForm.receipt.name}
              </p>
            )}
          </div>
          <input
            id="loan-receipt-upload"
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,application/pdf"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Submit and Cancel Buttons */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create Loan"}
        </Button>
      </div>
    </form>
  );
};

export default LoanForm;
