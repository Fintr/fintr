import React, { useState } from "react";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { CalculatorInput } from "../../ui/calculator-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Button } from "../../ui/button";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { Calendar } from "../../ui/calendar";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { format } from "date-fns";
import ExpandableTextarea from "../../ui/expandable-textarea";
import { toast } from "sonner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useQueryClient } from "@tanstack/react-query";
import { createLoanLocalFirst } from "@/services/loans/create-local-first";
import { numberFormatting } from "@/lib/utils";
import { useNumberInput } from "@/hooks/useNumberInput";
import { extractFieldErrors } from "@/utils/errorUtils";
import { FormError } from "@/components/ui/form-error";
import LoanEntityField from "./LoanEntityField";
import { useAtomValue } from "jotai";
import { accountOptionsAtom } from "@/atoms/dashboardAtoms";
import GridPicker from "./GridPicker";
import FileUploadField from "./FileUploadField";
import { AdjustAccountBalanceSwitchRow } from "@/components/dashboard/forms/adjust-account-balance-switch-row";
import { StickyFormActions, pinnedFormScrollAreaClassName } from "./StickyFormActions";
import {
  convertLoanTermDisplay,
  formatLoanTermUnitLabel,
  loanTermToMonths,
  type LoanTermUnit,
} from "@/utils/formatLoanTerm";

interface LoanFormProps {
  date?: Date | undefined;
  setDate?: React.Dispatch<React.SetStateAction<Date | undefined>>;
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
  /** Amount carried across Add Transaction tabs (expense/income/transfer/loan). */
  prefillAmount?: string;
  onPrefillAmountChange?: (amount: string) => void;
}

const LoanForm: React.FC<LoanFormProps> = ({
  date,
  setDate,
  onSubmitSuccess = () => {},
  onCancel = () => {},
  prefillAmount,
  onPrefillAmountChange,
}) => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  
  // Internal state for the form
  const [loanForm, setLoanForm] = useState({
    amount: prefillAmount || "",
    description: "",
    type: "borrowed" as "borrowed" | "lent",
    entityName: "",
    accountName: "",
    interestRate: "",
    loanTerm: "",
    receipt: null as File | null,
  });

  const accountOptions = useAtomValue(accountOptionsAtom);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Number input hook for principal amount field
  const principalAmountInput = useNumberInput({
    initialValue: loanForm.amount,
    onValueChange: (cleanValue) => {
      setLoanForm((prev) => ({ ...prev, amount: cleanValue.toString() }));
      onPrefillAmountChange?.(cleanValue !== 0 ? String(cleanValue) : "");
    },
  });

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string | string[]>>({});
  const [adjustsAccountBalance, setAdjustsAccountBalance] = useState(true);
  const [loanTermUnit, setLoanTermUnit] = useState<LoanTermUnit>("years");

  const toggleLoanTermUnit = () => {
    const currentUnit = loanTermUnit;
    const nextUnit: LoanTermUnit =
      currentUnit === "months" ? "years" : "months";
    const nextTerm = convertLoanTermDisplay(
      loanForm.loanTerm,
      currentUnit,
      nextUnit,
    );

    setLoanTermUnit(nextUnit);
    setLoanForm((prev) => ({
      ...prev,
      loanTerm: nextTerm,
    }));
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
      errors.amount = "Principal amount must be a positive number";
    }

    const interestRateValue = parseFloat(loanForm.interestRate);
    if (!loanForm.interestRate || isNaN(interestRateValue) || interestRateValue < 0 || interestRateValue > 100) {
      errors.interestRate = "Interest rate must be between 0 and 100";
    }

    const loanTermMonths = loanTermToMonths(loanForm.loanTerm, loanTermUnit);

    if (!loanForm.loanTerm || loanTermMonths <= 0) {
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
              const loanTermMonths = loanTermToMonths(
                loanForm.loanTerm,
                loanTermUnit,
              );

              const loanData = {
                principalAmount: numberFormatting.cleanForBackend(principalAmountInput.displayValue),
                interestRate: parseFloat(loanForm.interestRate),
                date: format(date, "yyyy-MM-dd"),
                loanType: loanForm.type,
                entityName: loanForm.entityName.trim(),
                accountName: loanForm.accountName.trim(),
                loanTermMonths,
                description: loanForm.description || "",
                adjustsAccountBalance,
                ...(loanForm.receipt && { file: loanForm.receipt })
              };

      const response = await createLoanLocalFirst(
        api,
        {
          spaceId: spaceCode,
          data: loanData,
        },
        {
          queryClient,
          waitForSync: false,
        },
      );
      toast.success("Loan created successfully");
      void response.syncPromise.then((synced) => {
        if (synced.pendingSync) {
          toast.message("Loan saved on this device. Will sync when online.");
        }
      }).catch((error) => {
        const fieldErrors = extractFieldErrors(error);
        toast.error(
          fieldErrors.detail || "Failed to create loan. Please try again.",
        );
      });

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
              setLoanTermUnit("years");
              principalAmountInput.reset();
              setAdjustsAccountBalance(true);
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
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={pinnedFormScrollAreaClassName}>
      {/* First row: Date and Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan-date" className="text-sm">Date</Label>
          <CalendarPopover
            open={datePickerOpen}
            onOpenChange={setDatePickerOpen}
            trigger={
              <Button
                variant={"outline"}
                className="w-full justify-start text-left font-normal text-sm"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "MMM d, yyyy") : <span className="text-sm">Pick a date</span>}
              </Button>
            }
          >
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                setDate?.(d);
                if (d) setDatePickerOpen(false);
              }}
              autoFocus
            />
          </CalendarPopover>
        </div>
                <div className="space-y-2">
                  <Label htmlFor="loan-amount" className="text-sm">Principal Amount</Label>
                  <CalculatorInput
                    id="loan-amount"
                    placeholder="0.00"
                    value={principalAmountInput.displayValue}
                    onChange={(value) => {
                      principalAmountInput.handleInputChange(value);
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
          <Label htmlFor="loan-term" className="text-sm">Loan Term</Label>
          <div className="relative">
            <Input
              id="loan-term"
              type="number"
              inputMode="decimal"
              min={loanTermUnit === "months" ? "1" : "0.1"}
              step={loanTermUnit === "months" ? "1" : "0.1"}
              placeholder="0"
              value={loanForm.loanTerm}
              onChange={(e) => {
                setLoanForm({ ...loanForm, loanTerm: e.target.value });
                if (formSubmitted && validationErrors.loanTerm) {
                  setValidationErrors({ ...validationErrors, loanTerm: "" });
                }
              }}
              className="pr-20 text-sm"
            />
            <button
              type="button"
              onClick={toggleLoanTermUnit}
              className="absolute inset-y-0 right-0 flex cursor-pointer items-center gap-0.5 pr-3 text-sm text-muted-foreground hover:text-foreground"
              aria-label={`Switch loan term unit to ${loanTermUnit === "months" ? "years" : "months"}`}
            >
              {formatLoanTermUnitLabel(loanTermUnit, loanForm.loanTerm)}
              <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
          </div>
          {formSubmitted && validationErrors.loanTerm && (
            <FormError message={Array.isArray(validationErrors.loanTerm) ? validationErrors.loanTerm[0] : validationErrors.loanTerm} />
          )}
        </div>
      </div>

      {/* Third row: Loan Type */}
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

      {/* Fourth row: Lender / Borrower */}
      <div className="space-y-2">
        <LoanEntityField
          id="loan-entity"
          loanType={loanForm.type}
          value={loanForm.entityName}
          onChange={(entityName) => {
            setLoanForm((prev) => ({ ...prev, entityName }));
            if (formSubmitted && validationErrors.entityName) {
              setValidationErrors((prev) => ({ ...prev, entityName: "" }));
            }
          }}
          hasError={formSubmitted && Boolean(validationErrors.entityName)}
        />
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

      {/* Fifth row: Account */}
      <div className="space-y-2">
        <GridPicker
          pickerKind="account"
          label="Account"
          triggerId="loan-account"
          value={loanForm.accountName}
          onChange={(accountName) => {
            setLoanForm((prev) => ({ ...prev, accountName }));
            if (formSubmitted && validationErrors.accountName) {
              setValidationErrors({ ...validationErrors, accountName: "" });
            }
          }}
          accounts={accountOptions}
          error={
            formSubmitted && validationErrors.accountName
              ? [
                  Array.isArray(validationErrors.accountName)
                    ? validationErrors.accountName[0]
                    : String(validationErrors.accountName),
                ]
              : undefined
          }
          onAccountCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["accounts"] });
          }}
        />
      </div>

      <AdjustAccountBalanceSwitchRow
        id="loan-adjusts-account-balance"
        checked={adjustsAccountBalance}
        onCheckedChange={setAdjustsAccountBalance}
        label="Update account balance"
        infoAriaLabel="Help: update account balance when creating this loan"
        switchAriaLabel="Update account balance when creating this loan"
        popoverTitle="Account balance and this loan"
      >
        <p>
          When <span className="font-medium">on</span>, Fintr updates the selected account by the principal (borrowed adds funds you received; lent subtracts funds you put out).
        </p>
        <p>
          When <span className="font-medium">off</span>, use this for a loan that already exists in your books. The loan is still tracked with principal, rate, and schedule, but the account balance is not changed.
        </p>
      </AdjustAccountBalanceSwitchRow>

      {/* Fifth row: Description */}
      <div className="w-full">
        <Label htmlFor="loan-description" className="text-sm">Note (Optional)</Label>
        <ExpandableTextarea
          id="loan-description"
          value={loanForm.description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setLoanForm({ ...loanForm, description: e.target.value })}
          placeholder="Add additional details"
          className="mt-1"
          blurOnEnterKey
        />
      </div>

      {/* Sixth row: Attachment field (full width) */}
      <FileUploadField
        file={loanForm.receipt}
        onFileChange={handleFileUpload}
        onRemoveFile={() =>
          setLoanForm((prev) => ({ ...prev, receipt: null }))
        }
        label="Attach Doc (Optional)"
      />
      </div>

      <StickyFormActions className="justify-end">
        <div className="flex gap-2">
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
      </StickyFormActions>
    </form>
  );
};

export default LoanForm;
