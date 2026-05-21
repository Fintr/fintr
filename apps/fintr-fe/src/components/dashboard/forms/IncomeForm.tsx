import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { Calendar } from "../../ui/calendar";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { PhilippinesTaxCalculator } from "../../ui/philippines-tax-calculator";
import { format, endOfMonth } from "date-fns";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { incomeCategoryOptionsAtom, accountOptionsAtom } from "@/atoms/dashboardAtoms";
import * as z from "zod"; 
import { toast } from "sonner";
import { useAuthApi } from "@/hooks/useAuthApi";
import {
  editLockedAccountLedgerCurrency,
  isAccountSelectOptionDisabledForEdit,
} from "@/utils/accountSelectEditLocks";
import { extractFieldErrors } from "@/utils/errorUtils";
import { FormError } from "@/components/ui/form-error";
import { numberFormatting } from "@/lib/utils";
import { useNumberInput } from "@/hooks/useNumberInput";
import { createTransaction, updateTransaction } from "@/services/transactions/mutation";
import { REPEAT_INTERVALS, ScheduleTypeEnum, TransactionTypeEnum } from "@/constants/transactionConstants";
import GridPicker from "./GridPicker";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import {
  categoryPickerValueFromTransaction,
  getCategoryNameForApi,
  parseCategoryPickerValue,
} from "@/types/categoryTreeTypes";
import { UpdateTransactionType } from "@/types/transactionTypes";
import NotesAutocomplete from "@/components/ui/notes-autocomplete";
import FileUploadField from "./FileUploadField";
import { DeleteButton } from "../tabs/transactions/buttons/DeleteButton";
import {
  AmountWithRatePicker,
  type ConversionSnapshot,
} from "./AmountWithRatePicker";
import { resolvePrefillAmountCurrency } from "@/utils/formUtils";

// Income form schema using Zod
const incomeFormSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) !== 0, { message: "Amount cannot be zero" }),
  description: z.string().optional(),
  categoryName: z.string().min(1, "Category is required"),
  accountName: z.string().min(1, "Account is required"),
  scheduleType: z.enum([
    ScheduleTypeEnum.ONE_TIME, 
    ScheduleTypeEnum.REPEAT
  ]),
  repeatInterval: z.string().optional(),
  file: z.any().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.scheduleType === ScheduleTypeEnum.REPEAT) {
    if (!data.repeatInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Repeat interval is required for recurring income",
        path: ["repeatInterval"]
      });
    }
  }
});

// Type for form values (derived from Zod schema)
type IncomeFormValues = z.infer<typeof incomeFormSchema>;

// Props for IncomeForm
interface IncomeFormProps {
  id?: string;
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  /** Space default currency; used as fallback and to detect when account currency differs */
  spaceCurrency?: string;
  /** When set, this currency is pre-selected when the form opens (e.g. from space settings). */
  defaultTransactionCurrency?: string | null;
  onAddCustomCategory?: (categoryName: string) => void;
  onAddCustomAccount?: (accountName: string) => void;
  onSubmitSuccess?: (data: any) => void;
  onCancel?: () => void;
  formRef?: React.RefObject<HTMLFormElement>;
  // Edit mode props
  initialData?: UpdateTransactionType & { draftId?: string };
  isEditMode?: boolean;
  onFileUpdate?: (file: File | null) => void; // New prop for file updates
  onDelete?: () => void; // New prop for delete action
}

// Main Income Form
const IncomeForm: React.FC<IncomeFormProps> = ({
  date,
  setDate,
  spaceCurrency,
  defaultTransactionCurrency,
  onAddCustomCategory,
  onAddCustomAccount,
  onSubmitSuccess,
  onCancel,
  formRef,
  id,
  initialData,
  isEditMode = false,
  onFileUpdate,
  onDelete,
}) => {
  const categoryOptions = useAtomValue(incomeCategoryOptionsAtom);
  const accountOptions = useAtomValue(accountOptionsAtom);
  const { api } = useAuthApi();

  // Use provided spaceCurrency or fallback to PHP if not provided
  const effectiveSpaceCurrency = spaceCurrency ?? "PHP";

  const amountCurrencyOptions = useMemo(() => {
    const fromAccounts = Array.from(
      new Set(
        accountOptions
          .map((a) => a.currency)
          .filter((c): c is string => Boolean(c))
      )
    );
    const codes = fromAccounts.length > 0 ? fromAccounts : ["PHP"];
    if (
      defaultTransactionCurrency &&
      defaultTransactionCurrency.length === 3 &&
      !codes.includes(defaultTransactionCurrency)
    ) {
      return [defaultTransactionCurrency, ...codes];
    }
    return codes;
  }, [accountOptions, defaultTransactionCurrency]);

  // Local state for UI elements and form handling
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [fileState, setFileState] = useState<File | null>(null);
  const [scheduleType, setScheduleType] = useState<ScheduleTypeEnum>(
    ScheduleTypeEnum.ONE_TIME
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Track whether form has been submitted (for validation display)
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  // Store draftId separately since it's not part of the form values
  const [draftId, setDraftId] = useState<string | undefined>(initialData?.draftId);
  
  // Helper function to filter schedule types for income
  const getValidIncomeScheduleType = (scheduleType?: ScheduleTypeEnum): ScheduleTypeEnum.ONE_TIME | ScheduleTypeEnum.REPEAT => {
    if (scheduleType === ScheduleTypeEnum.REPEAT) {
      return ScheduleTypeEnum.REPEAT;
    }
    return ScheduleTypeEnum.ONE_TIME; // Default for ONE_TIME or INSTALLMENT
  };

  // Form state management
  const [formState, setFormState] = useState<IncomeFormValues>({
    amount: initialData?.amount?.toString() || "",
    description: initialData?.description || "",
    categoryName: initialData
      ? categoryPickerValueFromTransaction({
          categoryId: initialData.categoryId,
          subcategoryId: initialData.subcategoryId,
          categoryName: initialData.categoryName,
        })
      : "",
    accountName: initialData?.accountName || "",
    scheduleType: getValidIncomeScheduleType(initialData?.scheduleType),
    repeatInterval: initialData?.repeatInterval || "",
    file: initialData?.file || null,
  });

  const selectedAccount = accountOptions.find((a) => a.value === formState.accountName);
  const accountLedgerCurrency =
    selectedAccount != null ? selectedAccount.currency ?? null : null;
  const editBookedCurrency =
    isEditMode && initialData
      ? String(
          (initialData as { amountCurrency?: string; amount_currency?: string })
            .amountCurrency ??
            (initialData as { amount_currency?: string }).amount_currency ??
            "",
        ).trim() || null
      : null;
  const amountPickerTargetCurrency =
    accountLedgerCurrency ?? editBookedCurrency;
  const accountCurrencyDiffersFromSpace =
    accountLedgerCurrency != null &&
    accountLedgerCurrency !== effectiveSpaceCurrency;

  const editLockedAccountLedgerCurrencyValue = useMemo(
    () =>
      editLockedAccountLedgerCurrency(
        isEditMode,
        initialData?.accountName,
        accountOptions,
        effectiveSpaceCurrency,
      ),
    [isEditMode, initialData?.accountName, accountOptions, effectiveSpaceCurrency],
  );

  const selectedAccountCurrencyForChip =
    accountLedgerCurrency ?? effectiveSpaceCurrency;

  const initialAmountCurrency =
    defaultTransactionCurrency && amountCurrencyOptions.includes(defaultTransactionCurrency)
      ? defaultTransactionCurrency
      : selectedAccountCurrencyForChip;

  // In edit mode with conversion, show original currency (e.g. PLN) from the start so the label is correct
  const [amountCurrency, setAmountCurrency] = useState(() => {
    if (isEditMode && initialData) {
      const d = initialData as unknown as Record<string, unknown>;
      const orig = d.originalDisplayCurrency ?? d.original_display_currency;
      if (orig != null && String(orig).trim() !== "") return String(orig);
      const conv = (d.currencyConversion ?? d.currency_conversion) as Record<string, unknown> | undefined;
      const fromConv = conv?.originalCurrency ?? conv?.original_currency;
      if (fromConv != null && String(fromConv).trim() !== "") return String(fromConv);
    }
    return initialAmountCurrency;
  });
  const [conversionSnapshot, setConversionSnapshot] =
    useState<ConversionSnapshot | null>(() => {
      if (!isEditMode || !initialData) return null;
      const d = initialData as any;
      const rawConv = d.currencyConversion ?? d.currency_conversion;
      const origCur = d.originalDisplayCurrency ?? d.original_display_currency;
      if (!rawConv && origCur == null) return null;
      const originalCurrency =
        origCur != null && String(origCur).trim() !== ""
          ? String(origCur)
          : String((rawConv as any)?.originalCurrency ?? (rawConv as any)?.original_currency ?? "");
      if (!originalCurrency) return null;
      const exchangeRate = Number((rawConv as any)?.exchange_rate ?? (rawConv as any)?.exchangeRate ?? 1);
      const source = (rawConv as any)?.source ?? "manual";
      const exchangeRateSource = (source === "auto" || source === "recent" ? source : "manual") as "auto" | "manual" | "recent";
      return { originalCurrency, exchangeRate, exchangeRateSource };
    });

  const defaultCurrencySetRef = useRef(false);
  useEffect(() => {
    if (defaultCurrencySetRef.current) return;
    // Do not overwrite with space/default currency when editing a transaction that has original currency (conversion)
    if (isEditMode && initialData) {
      const d = initialData as any;
      const hasOriginal =
        (d.originalDisplayCurrency ?? d.original_display_currency) != null ||
        (d.currencyConversion ?? d.currency_conversion) != null;
      if (hasOriginal) return;
      const bookedCcy = d.amountCurrency ?? d.amount_currency;
      if (bookedCcy != null && String(bookedCcy).trim() !== "") return;
    }
    if (
      defaultTransactionCurrency &&
      amountCurrencyOptions.includes(defaultTransactionCurrency)
    ) {
      setAmountCurrency(defaultTransactionCurrency);
      defaultCurrencySetRef.current = true;
    }
  }, [defaultTransactionCurrency, amountCurrencyOptions, isEditMode, initialData]);

  // Do not sync amountCurrency to selected account when account changes.
  // The user's chosen transaction currency should persist so the API
  // receives that currency and uses it for calculations/conversion.

  // Number input hook for amount field
  const amountInput = useNumberInput({
    initialValue: formState.amount,
    onValueChange: (cleanValue) => handleFieldChange("amount", cleanValue.toString())
  });
  
  // Tax calculator integration: use amount in PHP (converted output when applicable)
  const rawAmount = numberFormatting.cleanForBackend(formState.amount);
  const grossIncome =
    amountCurrency === "PHP"
      ? rawAmount
      : conversionSnapshot && accountLedgerCurrency === "PHP"
        ? rawAmount * conversionSnapshot.exchangeRate
        : 0;
  const [taxCalculation, setTaxCalculation] = useState({
    grossIncome: 0,
    sssContribution: 0,
    philhealthContribution: 0,
    pagibigContribution: 0,
    incomeTax: 0,
    totalDeductions: 0,
    netIncome: 0
  });
  
  // Deduction options state
  const [deductTaxes, setDeductTaxes] = useState(false);
  const [deductContributions, setDeductContributions] = useState(false);
  
  // Form errors
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  
  // Initialize formState from initialData
  const prevInitialDataRef = React.useRef<UpdateTransactionType | undefined>(undefined);

  useEffect(() => {
    // Helper to get a valid income schedule type (only ONE_TIME or REPEAT)
    const getValidIncomeScheduleType = (scheduleType?: ScheduleTypeEnum): ScheduleTypeEnum.ONE_TIME | ScheduleTypeEnum.REPEAT => {
      if (scheduleType === ScheduleTypeEnum.INSTALLMENT) {
        return ScheduleTypeEnum.ONE_TIME; // Default to ONE_TIME if installment (not supported for income)
      }
      return scheduleType === ScheduleTypeEnum.REPEAT ? ScheduleTypeEnum.REPEAT : ScheduleTypeEnum.ONE_TIME;
    };

    const data = initialData as Record<string, unknown> | undefined;
    const rawConv = data
      ? (data.currency_conversion ?? (initialData as any).currencyConversion) as Record<string, unknown> | undefined
      : undefined;

    const originalAmount =
      data?.original_display_amount ?? (data as any)?.originalDisplayAmount;
    const originalCurrency =
      data?.original_display_currency ?? (data as any)?.originalDisplayCurrency;
    const hasOriginal = originalAmount != null && originalCurrency != null && String(originalCurrency).trim() !== "";

    if (initialData && (initialData !== prevInitialDataRef.current)) {
      const initialAmount = hasOriginal
        ? String(originalAmount)
        : rawConv != null
          ? String((rawConv as any).original_amount ?? (rawConv as any).originalAmount ?? initialData.amount ?? "")
          : (initialData.amount?.toString() ?? "");

      const displayCurrency = hasOriginal
        ? String(originalCurrency)
        : rawConv != null
          ? String((rawConv as any).original_currency ?? (rawConv as any).originalCurrency ?? effectiveSpaceCurrency)
          : effectiveSpaceCurrency;
      const useConversion = hasOriginal || (rawConv != null);

      setFormState({
        amount: initialAmount,
        description: initialData.description || "",
        categoryName: categoryPickerValueFromTransaction({
          categoryId: initialData.categoryId,
          subcategoryId: initialData.subcategoryId,
          categoryName: initialData.categoryName,
        }),
        accountName: initialData.accountName || "",
        scheduleType: getValidIncomeScheduleType(initialData.scheduleType),
        repeatInterval: initialData.repeatInterval || "",
        file: initialData.file || null,
      });

      amountInput.setDisplayValue(
        initialAmount ? numberFormatting.formatForInput(initialAmount) : ""
      );
      setScheduleType(getValidIncomeScheduleType(initialData.scheduleType));

      if (useConversion) {
        setAmountCurrency(displayCurrency);
        setConversionSnapshot({
          originalCurrency: displayCurrency,
          exchangeRate: Number((rawConv as any)?.exchange_rate ?? (rawConv as any)?.exchangeRate ?? 1),
          exchangeRateSource: ((rawConv as any)?.source ?? "manual") as "auto" | "manual" | "recent",
        });
      } else {
        const apiCcy =
          (initialData as any).amountCurrency ??
          (initialData as any).amount_currency;
        if (apiCcy != null && String(apiCcy).trim() !== "") {
          setAmountCurrency(String(apiCcy));
        } else {
          setAmountCurrency(
            resolvePrefillAmountCurrency({
              defaultTransactionCurrency,
              amountCurrencyCodes: amountCurrencyOptions,
              accountName: initialData.accountName,
              accounts: accountOptions,
              spaceCurrency: effectiveSpaceCurrency,
            })
          );
        }
        setConversionSnapshot(null);
      }

      if (initialData.date) {
        setDate(new Date(initialData.date));
      }

      prevInitialDataRef.current = initialData;
    } else if (!initialData && prevInitialDataRef.current) {
      // If initialData becomes undefined and it was previously set, clear the form
      setFormState({
        amount: "",
        description: "",
        categoryName: "",
        accountName: "",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        repeatInterval: "",
        file: null,
      });
      // Reset number input hook
      amountInput.reset();
      setDate(undefined);
      setShowCustomAccountInput(false);
      setScheduleType(ScheduleTypeEnum.ONE_TIME);
      setFormSubmitted(false);
      setConversionSnapshot(null);
      prevInitialDataRef.current = undefined;
    }
  }, [initialData, initialData?.file]); // Add initialData?.file and setDate to dependencies
  
  // Form validation
  const validateForm = () => {
    try {
      incomeFormSchema.parse(formState);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path[0] as string;
          if (!errors[path]) errors[path] = [];
          errors[path].push(err.message);
        });
        setFormErrors(errors);
      }
      return false;
    }
  };
  
  // Handle field changes
  const handleFieldChange = (field: keyof IncomeFormValues, value: any) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value
    }));
    
    // Special handling for schedule type
    if (field === "scheduleType") {
      setScheduleType(value as ScheduleTypeEnum);
    }
    
    // If form has been submitted once, validate on change to provide immediate feedback
    if (formSubmitted) {
      validateForm();
    }
  };
  
  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark form as submitted to show validation errors
    setFormSubmitted(true);
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    if (!date) {
      toast.error("Please select a date");
      setIsSubmitting(false);
      return;
    }
    
    try {
      // Backend expects amount always in space currency; it converts to account currency when needed.
      let amountToUse: string = String(numberFormatting.cleanForBackend(formState.amount));
      if (effectiveSpaceCurrency === "PHP" && (deductTaxes || deductContributions) && taxCalculation) {
        amountToUse = String(taxCalculation.netIncome);
      }

      const categoryAssignment = parseCategoryPickerValue(formState.categoryName);
      const categoryNameForApi = getCategoryNameForApi(
        formState.categoryName,
        categoryOptions,
      );

      const transactionData = {
        amount: Number(amountToUse),
        description: formState.description || "",
        transactionType: "income" as const,
        categoryName: categoryNameForApi,
        ...(categoryAssignment && {
          categoryId: categoryAssignment.categoryId,
          subcategoryId: categoryAssignment.subcategoryId ?? undefined,
        }),
        accountName: formState.accountName,
        date: format(date, "yyyy-MM-dd"),
        scheduleType: formState.scheduleType,
        ...(formState.scheduleType === ScheduleTypeEnum.REPEAT && {
          repeatInterval: formState.repeatInterval
        }),
        ...(fileState && { file: fileState }),
        ...(draftId && { draftId }),
        ...(conversionSnapshot && {
          original_currency: conversionSnapshot.originalCurrency,
          exchange_rate: conversionSnapshot.exchangeRate,
          exchange_rate_source: conversionSnapshot.exchangeRateSource,
        }),
      };
      
      let response;
      
      if (isEditMode && id) {
        // Update existing transaction - pass the data to parent for scope handling
        const submitData = { ...transactionData, id, scheduleType: formState.scheduleType };
        response = await onSubmitSuccess?.(submitData);
        return; // Let parent handle the actual update
      } else {
        // Create new transaction
        response = await createTransaction(api, transactionData);
        toast.success("Income created successfully");
      }
      
      // Call onSubmitSuccess callback to notify parent component
      if (onSubmitSuccess && !isEditMode) {
        onSubmitSuccess(response);
      }
      
      // Reset form only if not in edit mode (edit mode closes dialog)
      if (!isEditMode) {
        setFormState({
          amount: "",
          description: "",
          categoryName: "",
          accountName: "",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
          repeatInterval: "",
          file: null,
        });
        // Reset number input hook
        amountInput.reset();
        setConversionSnapshot(null);
        setDate(undefined);
        setFileState(null);
        setShowCustomAccountInput(false);
        setScheduleType(ScheduleTypeEnum.ONE_TIME);
        setFormSubmitted(false); // Reset the form submission flag
      }
      
    } catch (error) {
      const fieldErrors = extractFieldErrors(error);
      
      toast.error(fieldErrors.detail || `Failed to create income. Please try again.`);
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

  // Handle category creation
  const handleCategoryCreated = (categoryName: string) => {
    if (categoryName) {
      handleFieldChange("categoryName", categoryName);
      if (onAddCustomCategory) onAddCustomCategory(categoryName);
    }
  };

  // Handle account creation
  const handleAccountCreated = (accountName: string) => {
    if (accountName) {
      handleFieldChange("accountName", accountName);
      if (onAddCustomAccount) onAddCustomAccount(accountName);
    }
  };

  const maxDate = endOfMonth(new Date());
  const currentYear = new Date().getFullYear();

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="space-y-4">
        {/* Income Form Essential Fields - Date on first row, Amount on second row. */}
        <div data-tutorial-target="income-form" className="grid grid-cols-1 gap-4">
          <div className="space-y-2 min-w-0">
            <Label htmlFor="date" className="text-sm">Date</Label>
            <CalendarPopover
              modal
              open={datePickerOpen}
              onOpenChange={setDatePickerOpen}
              trigger={
                <Button variant={"outline"} className="w-full justify-start text-left font-normal text-sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "MMM d, yyyy") : <span className="text-sm">Pick a date</span>}
                </Button>
              }
            >
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  setDate(d);
                  if (d) setDatePickerOpen(false);
                }}
                autoFocus
                toDate={maxDate}
                toYear={currentYear}
                defaultMonth={date || new Date()}
              />
            </CalendarPopover>
          </div>

          {/* Amount + currency + rates - own row */}
          <div className="space-y-2 min-w-0">
          <AmountWithRatePicker
            id="amount"
            label="Amount"
            amountDisplayValue={amountInput.displayValue}
            onAmountChange={(value) => amountInput.handleInputChange(value)}
            fromCurrency={amountCurrency}
            onFromCurrencyChange={setAmountCurrency}
            toCurrency={amountPickerTargetCurrency}
            amountCurrencyOptions={amountCurrencyOptions}
            accountOptions={accountOptions}
            errors={formSubmitted && formErrors.amount ? formErrors.amount : []}
            placeholder="0.00"
            inputClassName={
              formSubmitted && formErrors.amount
                ? "border-red-800 focus-visible:ring-red-800"
                : ""
            }
            lockFromCurrency={isEditMode}
            hideRatePicker={isEditMode}
            onConversionChange={setConversionSnapshot}
            date={date ? format(date, "yyyy-MM-dd") : undefined}
            initialConversion={conversionSnapshot ?? undefined}
          />
          </div>

          {/* Deduction Options - only for PHP (Philippines tax/contributions) */}
          {effectiveSpaceCurrency === "PHP" && (
            <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  data-tutorial-target="deduct-taxes"
                  onClick={() => setDeductTaxes(!deductTaxes)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                    deductTaxes 
                      ? 'bg-primary text-white border border-primary shadow-md' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  Deduct Taxes
                </button>
                <button
                  type="button"
                  data-tutorial-target="deduct-contributions"
                  onClick={() => setDeductContributions(!deductContributions)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                    deductContributions 
                      ? 'bg-primary text-white border border-primary shadow-md' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  Deduct Contributions
                </button>
            </div>
          )}
        </div>

         {/* Tax Calculator - Philippines only */}
         {effectiveSpaceCurrency === "PHP" && (deductTaxes || deductContributions) && (
           <div className="w-full animate-in slide-in-from-top-2 fade-in duration-300">
             <PhilippinesTaxCalculator 
               grossIncome={grossIncome}
               deductTaxes={deductTaxes}
               deductContributions={deductContributions}
               onCalculationChange={setTaxCalculation}
               className="w-full"
             />
           </div>
         )}

        <div className="grid grid-cols-2 gap-4">
          {/* Schedule Type Field */}
          <div className="space-y-2 min-w-0">
            <Label htmlFor="scheduleType" className="text-sm">Schedule Type</Label>
            <Select
              value={formState.scheduleType}
              onValueChange={(value) => handleFieldChange("scheduleType", value)}
            >
              <SelectTrigger 
                id="scheduleType" 
                className={`w-full min-w-0 text-sm ${formSubmitted && formErrors.scheduleType ? "border-red-800 focus-visible:ring-red-800" : ""}`}
              >
                <SelectValue placeholder="Select schedule type" className="text-sm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ScheduleTypeEnum.ONE_TIME} className="text-sm">One-Time</SelectItem>
                <SelectItem value={ScheduleTypeEnum.REPEAT} className="text-sm">Recurring</SelectItem>
              </SelectContent>
            </Select>
            {formSubmitted && formErrors.scheduleType?.map((error) => (
              <FormError key={error}>{error}</FormError>
            ))}

            {/* Repeat Interval - only show for recurring income */}
            {scheduleType === ScheduleTypeEnum.REPEAT && (
              <div className="mt-3">
                <Label htmlFor="repeatInterval" className="text-sm">Repeat Interval</Label>
                <Select
                  value={formState.repeatInterval || ""}
                  onValueChange={(value) => handleFieldChange("repeatInterval", value)}
                >
                  <SelectTrigger 
                    id="repeatInterval" 
                    className={`w-full min-w-0 text-sm ${formSubmitted && formErrors.repeatInterval ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                  >
                    <SelectValue placeholder="Select interval" className="text-sm" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPEAT_INTERVALS.map(option => (
                      <SelectItem key={option.value} value={option.value} className="text-sm">{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formSubmitted && formErrors.repeatInterval?.map((error) => (
                  <FormError key={error}>{error}</FormError>
                ))}
              </div>
            )}
          </div>
          
          {/* Category Field */}
          <GridPicker
            pickerKind="category"
            label="Income Category"
            value={formState.categoryName}
            onChange={(v) => handleFieldChange("categoryName", v)}
            categories={categoryOptions}
            error={formSubmitted && formErrors.categoryName ? formErrors.categoryName : undefined}
            categoryType={CategoryTypeEnum.INCOME}
            onCategoryCreated={handleCategoryCreated}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Account Field */}
          <div className="space-y-2 min-w-0">
            <GridPicker
              pickerKind="account"
              label="Account"
              triggerId="accountName"
              value={formState.accountName}
              onChange={(accountName) => handleFieldChange("accountName", accountName)}
              accounts={accountOptions}
              error={
                formSubmitted && formErrors.accountName
                  ? formErrors.accountName
                  : undefined
              }
              onAccountCreated={handleAccountCreated}
              allowInlineCreate={!isEditMode}
              isOptionDisabled={(acc) =>
                isAccountSelectOptionDisabledForEdit(
                  isEditMode,
                  editLockedAccountLedgerCurrencyValue,
                  acc,
                  effectiveSpaceCurrency,
                )
              }
            />
            {accountCurrencyDiffersFromSpace && selectedAccount?.currency && (
              <p className="text-xs text-muted-foreground mt-1">
                Account currency: {selectedAccount.currency} (differs from space: {effectiveSpaceCurrency})
              </p>
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-2 min-w-0">
            <Label htmlFor="description" className="text-sm">Note (Optional)</Label>
            <NotesAutocomplete
              id="description"
              value={formState.description || ""}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleFieldChange("description", e.target.value)}
              categoryName={formState.categoryName}
              transactionType="income"
              placeholder="Add additional details"
              className="text-sm"
            />
          </div>
        </div>

        {/* File Upload Field */}
        <FileUploadField
          file={formState.file}
          onFileChange={handleFileChange}
          onRemoveFile={handleRemoveFile}
        />

      </div>
      
      {/* Submit/Cancel Buttons */}
      <div className="flex justify-between gap-2 mt-4">
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
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="text-sm">
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="bg-primary hover:bg-primary/80 text-sm" 
            disabled={isSubmitting}
          >
            {isSubmitting ? (isEditMode ? "Updating Income..." : "Adding Income...") : (isEditMode ? "Update Income" : "Add Income")}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default IncomeForm;
