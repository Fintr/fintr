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
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { FormError } from "@/components/ui/form-error";
import { numberFormatting } from "@/lib/utils";
import { useNumberInput } from "@/hooks/useNumberInput";
import * as z from "zod";
import { ScheduleTypeEnum, BASIC_SCHEDULE_TYPE_OPTIONS } from "@/constants/transactionConstants";
import GridPicker from "./GridPicker";
import TransactionScheduleFields from "./TransactionScheduleFields";
import { createTransferLocalFirst } from "@/services/transactions/transfers/create-local-first";
import { updateTransfer, UpdateTransferType } from "@/services/transactions/transfers/mutation";
import ExpandableTextarea from "@/components/ui/expandable-textarea";
import FileUploadField from "./FileUploadField";
import { DeleteButton } from "../tabs/transactions/buttons/DeleteButton";
import { StickyFormActions, pinnedFormScrollAreaClassName } from "./StickyFormActions";
import {
  AmountWithRatePicker,
  type ConversionSnapshot,
} from "./AmountWithRatePicker";
import {
  editLockedAccountLedgerCurrency,
  isAccountSelectOptionDisabledForEdit,
} from "@/utils/accountSelectEditLocks";
import { extractFieldErrors } from "@/utils/errorUtils";
import { buildTransactionFileUpdateFields } from "@/utils/formUtils";
import {
  conversionSnapshotFromTransferInitialData,
  shouldIncludeTransferExchangeRate,
  transferInitialDataSignature,
} from "./transfer-form-initial-data";

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
  onSubmitSuccess?: (data: any) => void | Promise<void>;
  onCancel?: () => void;
  // Edit mode props
  initialData?: UpdateTransferType & { draftId?: string };
  isEditMode?: boolean;
  onFileUpdate?: (file: File | null) => void; // New prop for file updates
  onDelete?: () => void; // New prop for delete action
  /** When set, all fields are read-only (another user is editing via presence). */
  editingLockedReason?: string | null;
  /** Amount carried across Add Transaction tabs (expense/income/transfer/loan). */
  prefillAmount?: string;
  onPrefillAmountChange?: (amount: string) => void;
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
  editingLockedReason = null,
  prefillAmount,
  onPrefillAmountChange,
}) => {
  const { api } = useAuthApi();
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");
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
    amount: prefillAmount || initialData?.amount?.toString() || "",
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

  const editFromLedgerCurrencyLock = useMemo(
    () =>
      editLockedAccountLedgerCurrency(
        isEditMode,
        initialData?.fromAccountName,
        accountOptions,
        effectiveSpaceCurrency,
      ),
    [isEditMode, initialData?.fromAccountName, accountOptions, effectiveSpaceCurrency],
  );

  const editToLedgerCurrencyLock = useMemo(
    () =>
      editLockedAccountLedgerCurrency(
        isEditMode,
        initialData?.toAccountName,
        accountOptions,
        effectiveSpaceCurrency,
      ),
    [isEditMode, initialData?.toAccountName, accountOptions, effectiveSpaceCurrency],
  );

  const [conversionSnapshot, setConversionSnapshot] =
    useState<ConversionSnapshot | null>(null);

  useEffect(() => {
    setConversionSnapshot(null);
  }, [fromAccountCurrency, toAccountCurrency]);
  
  // Number input hooks for amount and transactionCost fields
  const amountInput = useNumberInput({
    initialValue: formState.amount,
    onValueChange: (cleanValue) => {
      handleFieldChange("amount", cleanValue.toString());
      onPrefillAmountChange?.(cleanValue !== 0 ? String(cleanValue) : "");
    },
  });
  
  const transactionCostInput = useNumberInput({
    initialValue: formState.transactionCost,
    onValueChange: (cleanValue) => handleFieldChange("transactionCost", cleanValue.toString())
  });
  
  // Track form submission state
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  // Store draftId separately since it's not part of the form values
  const [draftId, setDraftId] = useState<string | undefined>(initialData?.draftId);
  
  const initialDataSignature = transferInitialDataSignature(initialData);
  const prevInitialDataSignatureRef = React.useRef<string | null>(null);
  const hadAttachmentOnLoadRef = React.useRef(false);

  useEffect(() => {
    if (initialData?.file) {
      hadAttachmentOnLoadRef.current = true;
    }
  }, [initialData?.file]);

  useEffect(() => {
    if (
      initialData &&
      initialDataSignature &&
      initialDataSignature !== prevInitialDataSignatureRef.current
    ) {
      setFormState({
        amount: initialData.amount?.toString() || "",
        transactionCost: initialData.transactionCost?.toString() || "",
        description: initialData.description || "",
        fromAccountName: initialData.fromAccountName || "",
        toAccountName: initialData.toAccountName || "",
        scheduleType: initialData.scheduleType || ScheduleTypeEnum.ONE_TIME,
        repeatInterval: initialData.repeatInterval || "",
        file: initialData.file || null,
      });

      amountInput.setDisplayValue(initialData.amount?.toString() || "");
      transactionCostInput.setDisplayValue(
        initialData.transactionCost?.toString() || "",
      );
      setConversionSnapshot(
        conversionSnapshotFromTransferInitialData(initialData),
      );
      prevInitialDataSignatureRef.current = initialDataSignature;
      return;
    }

    if (!initialData && prevInitialDataSignatureRef.current) {
      setFormState({
        amount: "",
        transactionCost: "",
        description: "",
        fromAccountName: "",
        toAccountName: "",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        repeatInterval: "",
        file: null,
      });

      amountInput.reset();
      transactionCostInput.reset();
      if (setDate) setDate(undefined);
      setFormSubmitted(false);
      setConversionSnapshot(null);
      prevInitialDataSignatureRef.current = null;
    }
  }, [initialData, initialDataSignature]);
  
  // Local state
  const [fileState, setFileState] = useState<File | null>(null);
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

    if (editingLockedReason) {
      return;
    }

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
      // Amount is always in from-account currency; backend converts using exchange_rate when currencies differ.
      const fileFields = buildTransactionFileUpdateFields({
        isEditMode,
        hadAttachmentOnLoad: hadAttachmentOnLoadRef.current,
        file: formState.file,
      });

      const transferData = {
        amount: numberFormatting.cleanForBackend(formState.amount),
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
        ...fileFields,
        ...(draftId && { draftId }),
        ...(shouldIncludeTransferExchangeRate(
          fromAccountCurrency,
          toAccountCurrency,
          conversionSnapshot,
        ) && {
          exchange_rate: conversionSnapshot!.exchangeRate,
          exchange_rate_source: conversionSnapshot!.exchangeRateSource,
        }),
      };
      
      let response;
      
      if (isEditMode && id) {
        // Update existing transfer - pass the data to parent for scope handling
        const submitData = { ...transferData, id, scheduleType: formState.scheduleType };
        response = await onSubmitSuccess(submitData);
        return; // Let parent handle the actual update
      } else {
        response = await createTransferLocalFirst(
          api,
          {
            spaceId: spaceCode,
            data: transferData,
            amountCurrency: fromAccountCurrency,
          },
          {
            queryClient,
            waitForSync: false,
          },
        );
        toast.success(
          `Transfer of ${transferData.amount} from ${transferData.fromAccountName} to ${transferData.toAccountName} has been recorded.`,
        );
        void response.syncPromise.then((synced) => {
          if (synced.pendingSync) {
            toast.message("Transfer saved on this device. Will sync when online.");
          }
        }).catch((error) => {
          const fieldErrors = extractFieldErrors(error);
          toast.error(
            fieldErrors.detail || "Failed to create transfer. Please try again.",
          );
        });
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
      const fieldErrors = extractFieldErrors(error);
      toast.error(
        fieldErrors.detail || "Failed to create transfer. Please try again.",
      );
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
  };

  const handleToAccountCreated = (accountName: string) => {
    if (accountName) {
      handleFieldChange("toAccountName", accountName);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Scroll on a div — fieldset ignores overflow-y in most browsers. */}
      <div className={pinnedFormScrollAreaClassName}>
      <fieldset
        disabled={Boolean(editingLockedReason)}
        className="min-w-0 space-y-4 border-0 p-0 m-0 disabled:pointer-events-none disabled:opacity-70"
      >
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
              autoFocus
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
          hideRatePicker={fromAccountCurrency === toAccountCurrency}
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
          <GridPicker
            pickerKind="account"
            label="From Account"
            triggerId="transfer-from"
            modalTitle="From account"
            value={formState.fromAccountName}
            onChange={(name) => handleFieldChange("fromAccountName", name)}
            accounts={accountOptions}
            error={
              formSubmitted && formErrors.fromAccountName
                ? [formErrors.fromAccountName]
                : undefined
            }
            onAccountCreated={handleFromAccountCreated}
            allowInlineCreate={!isEditMode}
            isOptionDisabled={(option) =>
              isAccountSelectOptionDisabledForEdit(
                isEditMode,
                editFromLedgerCurrencyLock,
                option,
                effectiveSpaceCurrency,
              )
            }
          />
          {fromAccountCurrencyDiffersFromSpace && fromAccount?.currency && (
            <p className="text-xs text-muted-foreground mt-1">
              From account currency: {fromAccount.currency} (differs from space: {effectiveSpaceCurrency})
            </p>
          )}
        </div>
        <div className="space-y-2 min-w-0">
          <GridPicker
            pickerKind="account"
            label="To Account"
            triggerId="transfer-to"
            modalTitle="To account"
            value={formState.toAccountName}
            onChange={(name) => handleFieldChange("toAccountName", name)}
            accounts={accountOptions}
            error={
              formSubmitted && formErrors.toAccountName
                ? [formErrors.toAccountName]
                : undefined
            }
            onAccountCreated={handleToAccountCreated}
            allowInlineCreate={!isEditMode}
            isOptionDisabled={(option) =>
              isAccountSelectOptionDisabledForEdit(
                isEditMode,
                editToLedgerCurrencyLock,
                option,
                effectiveSpaceCurrency,
              )
            }
          />
          {toAccountCurrencyDiffersFromSpace && toAccount?.currency && (
            <p className="text-xs text-muted-foreground mt-1">
              To account currency: {toAccount.currency} (differs from space: {effectiveSpaceCurrency})
            </p>
          )}
        </div>
      </div>

      <TransactionScheduleFields
        scheduleType={formState.scheduleType}
        onScheduleTypeChange={(value) => handleFieldChange("scheduleType", value)}
        scheduleTypeOptions={BASIC_SCHEDULE_TYPE_OPTIONS}
        repeatInterval={formState.repeatInterval}
        onRepeatIntervalChange={(value) => handleFieldChange("repeatInterval", value)}
        showRepeatInterval={formState.scheduleType === ScheduleTypeEnum.REPEAT}
        scheduleTypeId="transfer-schedule-type"
        repeatIntervalId="transfer-repeat-interval"
        scheduleTypeErrors={
          formSubmitted && formErrors.scheduleType
            ? [formErrors.scheduleType]
            : undefined
        }
        repeatIntervalErrors={
          formSubmitted && formErrors.repeatInterval
            ? [formErrors.repeatInterval]
            : undefined
        }
      />

      {/* Fifth row: Description */}
      <div className="w-full">
        <Label htmlFor="transfer-description" className="text-sm">Description (Optional)</Label>
        <ExpandableTextarea
          id="transfer-description"
          placeholder="Enter description"
          value={formState.description || ""}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFieldChange("description", e.target.value)}
          className="mt-1"
          blurOnEnterKey
        />
      </div>

      {/* File Upload Field */}
      <FileUploadField
        file={formState.file}
        onFileChange={handleFileChange}
        onRemoveFile={handleRemoveFile}
      />
      </fieldset>
      </div>

      <StickyFormActions>
        <div>
          {isEditMode && onDelete && (
            <DeleteButton
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              disabled={isSubmitting || Boolean(editingLockedReason)}
              title={editingLockedReason ?? "Delete transaction"}
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
            disabled={isSubmitting || Boolean(editingLockedReason)}
            title={editingLockedReason ?? undefined}
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
      </StickyFormActions>
    </form>
  );
};

export default TransferForm;
