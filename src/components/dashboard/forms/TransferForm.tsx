import React, { useState, useEffect, useMemo } from "react";
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
import { Upload, CalendarIcon } from "lucide-react";
import { Calendar } from "../../ui/calendar";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { format, endOfMonth } from "date-fns";
import { useAtomValue } from "jotai";
import { accountOptionsAtom } from "@/atoms/dashboardAtoms";
import { createTransfer } from "@/services/transactions/transfers/mutation";
import { toast } from "sonner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { FormError } from "@/components/ui/form-error";
import { numberFormatting } from "@/lib/utils";
import { useNumberInput } from "@/hooks/useNumberInput";
import * as z from "zod";
import { ScheduleTypeEnum, REPEAT_INTERVALS } from "@/constants/transactionConstants";
import AccountCreationForm from "./AccountCreationForm";
import { updateTransfer, UpdateTransferType } from "@/services/transactions/transfers/mutation";
import ExpandableTextarea from "@/components/ui/expandable-textarea";
import FileUploadField from "./FileUploadField";
import { DeleteButton } from "../tabs/transactions/buttons/DeleteButton";
import {
  AmountWithRatePicker,
  type ConversionSnapshot,
} from "./AmountWithRatePicker";

// Transfer form schema using Zod
const transferFormSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Amount must be a positive number" }),
  transactionCost: z.string().refine(val => {
    if (!val || val.trim() === '') return true; // Empty is allowed, will default to 0
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, { message: "Transaction cost must be a non-negative number" }),
  fromAccountName: z.string().min(1, "From account is required"),
  toAccountName: z.string().min(1, "To account is required"),
  description: z.string().optional(),
  scheduleType: z.nativeEnum(ScheduleTypeEnum),
  repeatInterval: z.string().optional()
}).refine(data => data.fromAccountName !== data.toAccountName, {
  message: "From and To accounts must be different",
  path: ["toAccountName"]
}).refine(
  data => data.scheduleType !== ScheduleTypeEnum.REPEAT || (data.scheduleType === ScheduleTypeEnum.REPEAT && data.repeatInterval),
  {
    message: "Repeat interval is required for recurring transfers",
    path: ["repeatInterval"]
  }
);

// Type for form values
type TransferFormValues = z.infer<typeof transferFormSchema>;

// Updated props interface
interface TransferFormProps {
  id?: string;
  date?: Date | undefined;
  setDate?: React.Dispatch<React.SetStateAction<Date | undefined>>;
  /** Space default currency; used as fallback and to detect when account currency differs */
  spaceCurrency?: string;
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
  // Edit mode props
  initialData?: UpdateTransferType & { draftId?: string };
  isEditMode?: boolean;
  onFileUpdate?: (file: File | null) => void; // New prop for file updates
  onDelete?: () => void; // New prop for delete action
}

const TransferForm: React.FC<TransferFormProps> = ({
  date,
  setDate,
  spaceCurrency,
  onSubmitSuccess = () => {},
  onCancel = () => {},
  id,
  initialData,
  isEditMode = false,
  onFileUpdate,
  onDelete,
}) => {
  const { api } = useAuthApi();
  const accountOptions = useAtomValue(accountOptionsAtom);

  // Use provided spaceCurrency or fallback to PHP if not provided
  const effectiveSpaceCurrency = spaceCurrency ?? "PHP";

  const transferAmountCurrencyOptions = useMemo(() => {
    const codes = Array.from(
      new Set(
        accountOptions
          .map((a) => a.currency)
          .filter((c): c is string => Boolean(c))
      )
    );
    return codes.length > 0 ? codes : ["PHP"];
  }, [accountOptions]);

  // Form state management using local state
  const [formState, setFormState] = useState({
    amount: initialData?.amount?.toString() || "",
    transactionCost: initialData?.transactionCost?.toString() || "",
    description: initialData?.description || "",
    fromAccountName: initialData?.fromAccountName || "",
    toAccountName: initialData?.toAccountName || "",
    scheduleType: initialData?.scheduleType || ScheduleTypeEnum.ONE_TIME,
    repeatInterval: initialData?.repeatInterval || "",
    file: initialData?.file || null, // Add file state to formState
  });

  const fromAccount = accountOptions.find(
    (a) => a.value === formState.fromAccountName
  );
  const toAccount = accountOptions.find(
    (a) => a.value === formState.toAccountName
  );
  const fromAccountCurrency = fromAccount?.currency ?? effectiveSpaceCurrency;
  const toAccountCurrency = toAccount?.currency ?? effectiveSpaceCurrency;
  const fromAccountCurrencyDiffersFromSpace =
    fromAccount?.currency != null && fromAccount.currency !== effectiveSpaceCurrency;
  const toAccountCurrencyDiffersFromSpace =
    toAccount?.currency != null && toAccount.currency !== effectiveSpaceCurrency;

  const [conversionSnapshot, setConversionSnapshot] =
    useState<ConversionSnapshot | null>(null);

  useEffect(() => {
    setConversionSnapshot(null);
  }, [fromAccountCurrency, toAccountCurrency]);
  
  // Number input hooks for amount and transactionCost fields
  const amountInput = useNumberInput({
    initialValue: formState.amount,
    onValueChange: (cleanValue) => handleFieldChange("amount", cleanValue.toString())
  });
  
  const transactionCostInput = useNumberInput({
    initialValue: formState.transactionCost,
    onValueChange: (cleanValue) => handleFieldChange("transactionCost", cleanValue.toString())
  });
  
  // Track form submission state
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  // Store draftId separately since it's not part of the form values
  const [draftId, setDraftId] = useState<string | undefined>(initialData?.draftId);
  
  // Initialize formState from initialData
  const prevInitialDataRef = React.useRef<UpdateTransferType | undefined>(initialData);

  useEffect(() => {
    // Only proceed if initialData is provided and is a different object reference
    if (initialData && (initialData !== prevInitialDataRef.current)) {
      // Update form state with all initialData values
      setFormState({
        amount: initialData.amount?.toString() || "",
        transactionCost: initialData.transactionCost?.toString() || "",
        description: initialData.description || "",
        fromAccountName: initialData.fromAccountName || "",
        toAccountName: initialData.toAccountName || "",
        scheduleType: initialData.scheduleType || ScheduleTypeEnum.ONE_TIME,
        repeatInterval: initialData.repeatInterval || "",
        file: initialData.file || null, // Update file state
      });
      
      // Update number input hooks
      amountInput.setDisplayValue(initialData.amount?.toString() || "");
      transactionCostInput.setDisplayValue(initialData.transactionCost?.toString() || "");

      // Store the current initialData reference to prevent re-running on same object
      prevInitialDataRef.current = initialData;
    }
    // Always sync conversion snapshot when initialData is present so update payload includes exchange_rate
    if (initialData) {
      const rawConv = (initialData as any).currency_conversion ?? (initialData as any).currencyConversion;
      if (rawConv) {
        setConversionSnapshot({
          originalCurrency: rawConv.original_currency ?? rawConv.originalCurrency,
          exchangeRate: Number(rawConv.exchange_rate ?? rawConv.exchangeRate),
          exchangeRateSource: (rawConv.source ?? "manual") as "auto" | "manual" | "recent",
        });
      } else {
        setConversionSnapshot(null);
      }
    } else if (!initialData && prevInitialDataRef.current) {
      // If initialData becomes undefined and it was previously set, clear the form
      setFormState({
        amount: "",
        transactionCost: "",
        description: "",
        fromAccountName: "",
        toAccountName: "",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        repeatInterval: "",
        file: null, // Clear file state
      });
      
      // Reset number input hooks
      amountInput.reset();
      transactionCostInput.reset();
      if (setDate) setDate(undefined); // Conditionally call setDate
      setShowFromAccountCreation(false);
      setShowToAccountCreation(false);
      setFormSubmitted(false);
      setConversionSnapshot(null);
      prevInitialDataRef.current = undefined;
    }
  }, [initialData]); // Only depend on initialData reference, not nested properties
  
  // Local state
  const [fileState, setFileState] = useState<File | null>(null);
  const [showFromAccountCreation, setShowFromAccountCreation] = useState(false);
  const [showToAccountCreation, setShowToAccountCreation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  
  // Handle field changes
  const handleFieldChange = (field: keyof typeof formState, value: any) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value
    }));
    
    // If form has been submitted once, validate on change to provide immediate feedback
    if (formSubmitted) {
      validateForm();
    }
  };
  
  // Validate form using Zod
  const validateForm = () => {
    try {
      // Prepare form data with appropriate handling for transactionCost default
      const formData = {
        amount: formState.amount,
        transactionCost: formState.transactionCost,
        fromAccountName: formState.fromAccountName,
        toAccountName: formState.toAccountName,
        description: formState.description,
        scheduleType: formState.scheduleType,
        // Include repeatInterval only if scheduleType is REPEAT
        ...(formState.scheduleType === ScheduleTypeEnum.REPEAT && { repeatInterval: formState.repeatInterval }),
        file: fileState ?? undefined // Use fileState for validation
      };
      
      transferFormSchema.parse(formData);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path[0] as string;
          errors[path] = err.message;
        });
        setFormErrors(errors);
      }
      return false;
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark form as submitted to show validation errors
    setFormSubmitted(true);
    
    if (!validateForm()) {
      return;
    }
    
    if (!date) {
      toast.error("Please select a date for the transfer");
      return;
    }

    if (fromAccountCurrency !== toAccountCurrency && !conversionSnapshot) {
      toast.error("Please wait for the exchange rate or open Rates to choose one");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Update: backend stores amount as-is → send converted amount. Create: backend converts → send original amount.
      // Amount is always in from-account currency; when currencies differ, backend expects original amount (create) or converted (edit)
      const amountToSend =
        conversionSnapshot && fromAccountCurrency !== toAccountCurrency
          ? isEditMode
            ? String(numberFormatting.cleanForBackend(formState.amount) * conversionSnapshot.exchangeRate)
            : formState.amount
          : formState.amount;
      const transferData = {
        amount: numberFormatting.cleanForBackend(amountToSend),
        transactionCost:
          formState.transactionCost && formState.transactionCost.trim() !== ""
            ? numberFormatting.cleanForBackend(formState.transactionCost)
            : 0,
        fromAccountName: formState.fromAccountName,
        toAccountName: formState.toAccountName,
        description: formState.description || "",
        date: format(date, "yyyy-MM-dd"),
        scheduleType: formState.scheduleType,
        ...(formState.scheduleType === ScheduleTypeEnum.REPEAT && {
          repeatInterval: formState.repeatInterval
        }),
        file: formState.file ?? undefined,
        ...(draftId && { draftId }),
        ...(conversionSnapshot && {
          exchange_rate: conversionSnapshot.exchangeRate,
          exchange_rate_source: conversionSnapshot.exchangeRateSource,
        }),
      };
      
      let response;
      
      if (isEditMode && id) {
        // Update existing transfer - pass the data to parent for scope handling
        const submitData = { ...transferData, id, scheduleType: formState.scheduleType };
        response = await onSubmitSuccess(submitData);
        return; // Let parent handle the actual update
      } else {
        // Create new transfer
        response = await createTransfer(api, transferData);
        toast.success(`Transfer of ${transferData.amount} from ${transferData.fromAccountName} to ${transferData.toAccountName} has been recorded.`);
      }
      
      // Reset form only if not in edit mode (edit mode closes dialog)
      if (!isEditMode) {
        setFormState({
          amount: "",
          transactionCost: "",
          description: "",
          fromAccountName: "",
          toAccountName: "",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
          repeatInterval: "",
          file: null, // Clear file state on success
        });
        // Reset number input hooks
        amountInput.reset();
        transactionCostInput.reset();
        setConversionSnapshot(null);
        setFormSubmitted(false);
      }
      
      // Notify parent components of success
      if (!isEditMode) {
        onSubmitSuccess(response);
      }
    } catch (error) {
      toast.error(`Failed to create transfer. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormState(prev => ({ ...prev, file }));
      if (onFileUpdate) onFileUpdate(file); // Notify parent of file change
    } else {
      setFormState(prev => ({ ...prev, file: null }));
      if (onFileUpdate) onFileUpdate(null); // Notify parent of file removal
    }
  };

  // Handle file removal
  const handleRemoveFile = () => {
    setFormState(prev => ({ ...prev, file: null }));
    if (onFileUpdate) onFileUpdate(null); // Notify parent of file removal
  };

  // Handle account creation
  const handleFromAccountCreated = (accountName: string) => {
    if (accountName) {
      handleFieldChange("fromAccountName", accountName);
    }
    setShowFromAccountCreation(false);
  };
  
  const handleToAccountCreated = (accountName: string) => {
    if (accountName) {
      handleFieldChange("toAccountName", accountName);
    }
    setShowToAccountCreation(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Row 1: Date. Mobile full width, desktop 50%. */}
      <div className="flex flex-wrap">
        <div className="space-y-2 w-full md:w-1/2">
          <Label htmlFor="transfer-date" className="text-sm">Date</Label>
          <CalendarPopover
            modal
            open={datePickerOpen}
            onOpenChange={setDatePickerOpen}
            trigger={
              <Button
                type="button"
                variant={"outline"}
                className={`w-full justify-start text-left font-normal text-sm`}
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
              initialFocus
              toDate={endOfMonth(new Date())}
              toYear={new Date().getFullYear()}
              defaultMonth={date || new Date()}
            />
          </CalendarPopover>
        </div>
      </div>

      {/* Row 2: Amount (own row on mobile), Row 3: Transaction Cost. Desktop: Amount | Transaction Cost. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AmountWithRatePicker
          id="transfer-amount"
          label="Amount"
          amountDisplayValue={amountInput.displayValue}
          onAmountChange={(value) => amountInput.handleInputChange(value)}
          fromCurrency={fromAccountCurrency}
          onFromCurrencyChange={() => {}}
          toCurrency={toAccountCurrency}
          amountCurrencyOptions={transferAmountCurrencyOptions}
          accountOptions={accountOptions}
          lockFromCurrency={true}
          errors={
            formSubmitted && formErrors.amount ? [formErrors.amount] : []
          }
          placeholder="0.00"
          inputClassName={
            formSubmitted && formErrors.amount
              ? "border-red-800 focus-visible:ring-red-800"
              : ""
          }
          onConversionChange={setConversionSnapshot}
          date={date ? format(date, "yyyy-MM-dd") : undefined}
          hideRatePicker={isEditMode}
        />
        <div className="space-y-2">
          <Label htmlFor="transfer-transaction-cost" className="text-sm">Transaction Cost</Label>
          <CalculatorInput
            id="transfer-transaction-cost"
            value={transactionCostInput.displayValue}
            placeholder="0.00"
            onChange={(value) => transactionCostInput.handleInputChange(value)}
            className={`text-sm ${
              (formSubmitted && formErrors.transactionCost)
                ? "border-red-800 focus-visible:ring-red-800"
                : ""
            }`}
          />
          {formSubmitted && formErrors.transactionCost && (
            <FormError>{formErrors.transactionCost}</FormError>
          )}
        </div>
      </div>

      {/* Third row: From Account and To Account */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="transfer-from" className="text-sm">From Account</Label>
          <Select
            value={formState.fromAccountName}
            onValueChange={(value) => {
              if (value === "add_account") {
                setShowFromAccountCreation(true);
                handleFieldChange("fromAccountName", "");
              } else {
                setShowFromAccountCreation(false);
                handleFieldChange("fromAccountName", value);
              }
            }}
            disabled={isEditMode}
          >
            <SelectTrigger 
              id="transfer-from"
              className={`w-full min-w-0 text-sm ${
                (formSubmitted && formErrors.fromAccountName)
                  ? "border-red-800 focus-visible:ring-red-800"
                  : ""
              }`}
            >
              <SelectValue placeholder="Select account" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              {accountOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-sm">
                  {option.label}
                </SelectItem>
              ))}
              {!isEditMode && (
                <SelectItem value="add_account" className="text-sm">+ Add Account</SelectItem>
              )}
            </SelectContent>
          </Select>
          {formSubmitted && formErrors.fromAccountName && (
            <FormError>{formErrors.fromAccountName}</FormError>
          )}
          {fromAccountCurrencyDiffersFromSpace && fromAccount?.currency && (
            <p className="text-xs text-muted-foreground mt-1">
              From account currency: {fromAccount.currency} (differs from space: {effectiveSpaceCurrency})
            </p>
          )}
          {showFromAccountCreation && (
            <AccountCreationForm onSuccess={handleFromAccountCreated} />
          )}
        </div>
        <div className="space-y-2 min-w-0">
          <Label htmlFor="transfer-to" className="text-sm">To Account</Label>
          <Select
            value={formState.toAccountName}
            onValueChange={(value) => {
              if (value === "add_account") {
                setShowToAccountCreation(true);
                handleFieldChange("toAccountName", "");
              } else {
                setShowToAccountCreation(false);
                handleFieldChange("toAccountName", value);
              }
            }}
            disabled={isEditMode}
          >
            <SelectTrigger 
              id="transfer-to"
              className={`w-full min-w-0 text-sm ${
                (formSubmitted && formErrors.toAccountName)
                  ? "border-red-800 focus-visible:ring-red-800"
                  : ""
              }`}
            >
              <SelectValue placeholder="Select account" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              {accountOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-sm">
                  {option.label}
                </SelectItem>
              ))}
              {!isEditMode && (
                <SelectItem value="add_account" className="text-sm">+ Add Account</SelectItem>
              )}
            </SelectContent>
          </Select>
          {formSubmitted && formErrors.toAccountName && (
            <FormError>{formErrors.toAccountName}</FormError>
          )}
          {toAccountCurrencyDiffersFromSpace && toAccount?.currency && (
            <p className="text-xs text-muted-foreground mt-1">
              To account currency: {toAccount.currency} (differs from space: {effectiveSpaceCurrency})
            </p>
          )}
          {showToAccountCreation && (
            <AccountCreationForm onSuccess={handleToAccountCreated} />
          )}
        </div>
      </div>

      {/* Fourth row: Schedule Type and conditional Repeat Interval */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label htmlFor="transfer-schedule-type" className="text-sm">Schedule Type</Label>
          <Select
            value={formState.scheduleType}
            onValueChange={(value) => handleFieldChange("scheduleType", value as ScheduleTypeEnum)}
          >
            <SelectTrigger 
              id="transfer-schedule-type"
              className={`w-full min-w-0 text-sm ${
                (formSubmitted && formErrors.scheduleType)
                  ? "border-red-800 focus-visible:ring-red-800"
                  : ""
              }`}
            >
              <SelectValue placeholder="Select schedule type" className="text-sm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ScheduleTypeEnum.ONE_TIME} className="text-sm">One Time</SelectItem>
              <SelectItem value={ScheduleTypeEnum.REPEAT} className="text-sm">Recurring</SelectItem>
            </SelectContent>
          </Select>
          {formSubmitted && formErrors.scheduleType && (
            <FormError>{formErrors.scheduleType}</FormError>
          )}
        </div>

        {formState.scheduleType === ScheduleTypeEnum.REPEAT ? (
          <div className="space-y-2 min-w-0">
            <Label htmlFor="transfer-repeat-interval" className="text-sm">Repeat Interval</Label>
            <Select
              value={formState.repeatInterval}
              onValueChange={(value) => handleFieldChange("repeatInterval", value)}
            >
              <SelectTrigger 
                id="transfer-repeat-interval"
                className={`w-full min-w-0 text-sm ${
                  (formSubmitted && formErrors.repeatInterval)
                    ? "border-red-800 focus-visible:ring-red-800"
                    : ""
                }`}
              >
                <SelectValue placeholder="Select repeat interval" className="text-sm" />
              </SelectTrigger>
              <SelectContent>
                {REPEAT_INTERVALS.map((interval) => (
                  <SelectItem key={interval.value} value={interval.value} className="text-sm">
                    {interval.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formSubmitted && formErrors.repeatInterval && (
              <FormError>{formErrors.repeatInterval}</FormError>
            )}
          </div>
        ) : <div className="min-w-0 text-sm" />}
      </div>

      {/* Fifth row: Description */}
      <div className="w-full">
        <Label htmlFor="transfer-description" className="text-sm">Description (Optional)</Label>
        <ExpandableTextarea
          id="transfer-description"
          placeholder="Enter description"
          value={formState.description || ""}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFieldChange("description", e.target.value)}
          className="mt-1"
        />
      </div>

      {/* File Upload Field */}
      <FileUploadField
        file={formState.file}
        onFileChange={handleFileChange}
        onRemoveFile={handleRemoveFile}
      />

      {/* Action buttons */}
      <div className="flex justify-between gap-2">
        <div>
          {isEditMode && onDelete && (
            <DeleteButton
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              disabled={isSubmitting}
              title="Delete transaction"
            />
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} className="text-sm">
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-primary hover:bg-primary/80 text-sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isEditMode ? "Updating..." : "Adding..."}
              </>
            ) : (
              isEditMode ? "Update Transfer" : "Add Transfer"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default TransferForm;
