import React, { useEffect, useRef, useState, useMemo } from "react";
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
import { Upload, CalendarIcon, Receipt } from "lucide-react";
import { Calendar } from "../../ui/calendar";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { FormControlField } from "@/components/ui/form-control-field";
import { formControlInteractiveSurfaceClassName } from "@/components/ui/form-control-surface";
import { cn, numberFormatting } from "@/lib/utils";
import { format, endOfMonth } from "date-fns";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { expenseCategoryOptionsAtom, accountOptionsAtom } from "@/atoms/dashboardAtoms";
import { toast } from "sonner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { extractFieldErrors } from "@/utils/errorUtils";
import { FormError } from "@/components/ui/form-error";
import { useNumberInput } from "@/hooks/useNumberInput";
import * as z from "zod"; 
import { createTransactionLocalFirst } from "@/services/transactions/create-local-first";
import { updateTransaction, deleteTransaction } from "@/services/transactions/mutation";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { ScheduleTypeEnum, TransactionTypeEnum, DeleteScopeEnum, EXPENSE_SCHEDULE_TYPE_OPTIONS } from "@/constants/transactionConstants";
import GridPicker from "./GridPicker";
import { TagMultiPicker } from "./TagMultiPicker";
import { useTransactionTags } from "@/hooks/async/useTransactionTags";
import { useInitializeDefaultTransactionTags } from "@/hooks/useInitializeDefaultTransactionTags";
import TransactionScheduleFields from "./TransactionScheduleFields";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import {
  buildTransactionCategoryFields,
  categoryPickerValueFromReceiptOrTransaction,
  parseCategoryPickerValue,
} from "@/types/categoryTreeTypes";
import { UpdateTransactionType } from "@/types/transactionTypes";
import NotesAutocomplete from "@/components/ui/notes-autocomplete";
import FileUploadField from "./FileUploadField";
import TransactionEntityField from "./TransactionEntityField";
import { createDisplayFileFromDraft } from "@/utils/fileUtils";
import { useTransactionDrafts } from "@/hooks/async/useTransactionDrafts";
import DraftItems from "./DraftItems";
import { useQueryClient } from "@tanstack/react-query";
import { DeleteButton } from "../tabs/transactions/buttons/DeleteButton";
import { StickyFormActions, pinnedFormScrollAreaClassName } from "./StickyFormActions";
import {
  AmountWithRatePicker,
  type ConversionSnapshot,
} from "./AmountWithRatePicker";
import { resolvePrefillAmountCurrency, isUploadableFile, buildTransactionFileUpdateFields } from "@/utils/formUtils";
import {
  editLockedAccountLedgerCurrency,
  isAccountSelectOptionDisabledForEdit,
} from "@/utils/accountSelectEditLocks";
import {
  ensureLockedCategoryInTreeOptions,
  isLockedExpenseCategoryName,
  lockedCategoryRefForExpenseEdit,
} from "@/utils/lockedSystemCategories";
import {
  conversionSnapshotMatchesAmountCurrency,
  conversionSnapshotMatchesTarget,
  createTransactionNeedsConversion,
  resolveAmountPickerTargetCurrency,
  transactionNeedsConversion,
  shouldShowAmountFxInEdit,
  shouldUseStoredConversionForPreview,
  transactionHadStoredConversion,
} from "@/utils/amountPickerTargetCurrency";
import { positiveTransactionFormAmountString } from "@/utils/transactionFormAmount";

// Keep Zod schemas as they are used by the adapter and nested forms
const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
});

// Main expense form schema using Zod
const expenseFormSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) !== 0, { message: "Amount cannot be zero" }),
  description: z.string().optional(),
  categoryName: z.string().min(1, "Category is required"),
  accountName: z.string().min(1, "Account is required"),
  scheduleType: z.enum([
    ScheduleTypeEnum.ONE_TIME, 
    ScheduleTypeEnum.REPEAT, 
    ScheduleTypeEnum.INSTALLMENT
  ]),
  repeatInterval: z.string().optional(),
  // Ensure installmentPeriod is treated as a number for validation
  installmentPeriod: z.string().optional().refine((val) => !val || /^\d+$/.test(val), {
    message: "Installment period must be a whole number",
  }), 
  file: z.any().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.scheduleType === ScheduleTypeEnum.REPEAT) {
    if (!data.repeatInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Repeat interval is required for recurring expenses",
        path: ["repeatInterval"]
      });
    }
  }
  if (data.scheduleType === ScheduleTypeEnum.INSTALLMENT) {
    const period = data.installmentPeriod ? parseInt(data.installmentPeriod, 10) : 0;
    if (isNaN(period) || period <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Number of months is required and must be positive for installment expenses",
        path: ["installmentPeriod"]
      });
    }
  }
});

// Type for TanStack Form values (derived from Zod schema)
type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

// Props remain largely the same, but adjusted for TanStack form conventions if needed
interface ExpenseFormProps {
  // Keep props for managing the UI state outside the form if necessary
  date: Date | undefined;
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  suggestedDate?: Date; // AI-suggested date to display as a clickable suggestion
  /** Space default currency; used as fallback and to detect when account currency differs */
  spaceCurrency?: string;
  /** When set, this currency is pre-selected when the form opens (e.g. from space settings). */
  defaultTransactionCurrency?: string | null;
  onAddCustomCategory?: (categoryName: string) => void;
  onAddCustomAccount?: (accountName: string) => void;
  onSubmitSuccess?: (data: any) => void | Promise<void>; // Renamed for clarity
  onCancel?: () => void;
  formRef?: React.RefObject<HTMLFormElement | null>; // Keep if needed for external interaction
  // Edit mode props
  id?: string;
  initialData?: UpdateTransactionType & {
    draftId?: string;
    receiptMerchantDetected?: string;
  };
  isEditMode?: boolean;
  onFileUpdate?: (file: File | null) => void; // New prop for file updates
  onDelete?: () => void; // New prop for delete action
  /** When set, all fields are read-only (another user is editing via presence). */
  editingLockedReason?: string | null;
  /** Amount carried across Add Transaction tabs (expense/income/transfer/loan). */
  prefillAmount?: string;
  onPrefillAmountChange?: (amount: string) => void;
}

// Main Expense Form using @tanstack/react-form
const ExpenseForm: React.FC<ExpenseFormProps> = ({
  date,
  setDate,
  suggestedDate,
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
  editingLockedReason = null,
  prefillAmount,
  onPrefillAmountChange,
}) => {
  // Get options from atoms
  const categoryOptionsRaw = useAtomValue(expenseCategoryOptionsAtom);
  const { tags: availableTags, createTag } = useTransactionTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    () => initialData?.tags?.map((tag) => tag.id) ?? initialData?.tagIds ?? [],
  );

  useInitializeDefaultTransactionTags({
    tags: availableTags,
    isEditMode,
    hasInitialTags: Boolean(
      initialData?.tags?.length || initialData?.tagIds?.length,
    ),
    setSelectedTagIds,
  });
  const accountOptionsRaw = useAtomValue(accountOptionsAtom);
  const [spaceCode] = useLocalStorage("spaceCode", "");

  // Use provided spaceCurrency or fallback to PHP if not provided
  const effectiveSpaceCurrency = spaceCurrency ?? "PHP";

  // Deduplicate account options to prevent React key warnings
  const accountOptions = useMemo(() => {
    const seen = new Set();
    return accountOptionsRaw.filter(option => {
      if (seen.has(option.value)) {
        return false;
      }
      seen.add(option.value);
      return true;
    });
  }, [accountOptionsRaw]);

  const amountCurrencyOptions = useMemo(() => {
    const fromAccounts = Array.from(
      new Set(
        accountOptions
          .map((a) => a.currency)
          .filter((c): c is string => Boolean(c))
      )
    );
    const codes = fromAccounts.length > 0 ? fromAccounts : ["PHP"];
    // Include space default so it can be pre-selected even if no account uses it yet
    if (
      defaultTransactionCurrency &&
      defaultTransactionCurrency.length === 3 &&
      !codes.includes(defaultTransactionCurrency)
    ) {
      return [defaultTransactionCurrency, ...codes];
    }
    return codes;
  }, [accountOptions, defaultTransactionCurrency]);

  const { api } = useAuthApi();

  // Local state for UI elements not directly part of the form data
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  // Removed fileState, will use formState.file directly
  const [scheduleType, setScheduleType] = useState<ScheduleTypeEnum>(
    initialData?.scheduleType || ScheduleTypeEnum.ONE_TIME
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reference to track when a new category or account is created
  const [refreshOptionsFlag, setRefreshOptionsFlag] = useState(0);
  
  // Track whether form has been submitted (for validation display)
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [entityName, setEntityName] = useState(initialData?.entityName || "");
  const [receiptMerchantDetected, setReceiptMerchantDetected] = useState(
    initialData?.receiptMerchantDetected,
  );
  
  // Form state management
  const [formState, setFormState] = useState<ExpenseFormValues>({
    amount:
      prefillAmount
      || (initialData?.amount != null
        ? positiveTransactionFormAmountString(initialData.amount)
        : ""),
    description: initialData?.description || "",
    categoryName: initialData?.categoryName || "",
    accountName: initialData?.accountName || "",
    scheduleType: initialData?.scheduleType || ScheduleTypeEnum.ONE_TIME,
    repeatInterval: initialData?.repeatInterval || "",
    installmentPeriod: initialData?.installmentPeriod?.toString() || "",
    file: initialData?.file || null,
  });

  const lockedCategoryForEdit = useMemo(
    () =>
      lockedCategoryRefForExpenseEdit(
        isEditMode,
        initialData?.categoryName,
        initialData?.categoryId,
      ),
    [isEditMode, initialData?.categoryId, initialData?.categoryName],
  );

  const categoryOptions = useMemo(
    () =>
      ensureLockedCategoryInTreeOptions(
        categoryOptionsRaw,
        lockedCategoryForEdit,
      ),
    [categoryOptionsRaw, lockedCategoryForEdit],
  );

  const isCategoryLockedForEdit =
    isEditMode && isLockedExpenseCategoryName(initialData?.categoryName);

  const selectedAccount = accountOptions.find((a) => a.value === formState.accountName);
  /** Ledger currency for the selected account only — never use space as a stand-in for FX (CURR1→CURR2). */
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

  const initialAmountCurrency = resolvePrefillAmountCurrency({
    defaultTransactionCurrency,
    amountCurrencyCodes: amountCurrencyOptions,
    accountName: formState.accountName,
    accounts: accountOptions,
    spaceCurrency: effectiveSpaceCurrency,
  });

  // In edit mode with conversion, show original currency (e.g. PLN) from the start so the label is correct
  const [amountCurrency, setAmountCurrency] = useState(() => {
    if (isEditMode && initialData) {
      const d = initialData as unknown as Record<string, unknown>;
      const orig = d.originalDisplayCurrency ?? d.original_display_currency;
      if (orig != null && String(orig).trim() !== "") return String(orig);
      const conv = (d as any).currencyConversion ?? (d as any).currency_conversion;
      const fromConv = (conv as Record<string, unknown>)?.originalCurrency ?? (conv as Record<string, unknown>)?.original_currency;
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
      const targetCurrency = String(
        (rawConv as any)?.converted_currency ??
          (rawConv as any)?.convertedCurrency ??
          "",
      ).trim();
      return {
        originalCurrency,
        targetCurrency: targetCurrency || originalCurrency,
        exchangeRate,
        exchangeRateSource,
      };
    });

  /** Target for amount conversion preview + rate API — always account ledger when it differs from amount. */
  const amountPickerTargetCurrency = useMemo(
    () =>
      resolveAmountPickerTargetCurrency({
        amountCurrency,
        accountLedgerCurrency,
        editBookedCurrency,
        effectiveSpaceCurrency,
        isEditMode,
      }),
    [
      amountCurrency,
      accountLedgerCurrency,
      editBookedCurrency,
      effectiveSpaceCurrency,
      isEditMode,
    ],
  );

  const hadStoredConversion = useMemo(
    () =>
      isEditMode &&
      transactionHadStoredConversion(
        initialData as unknown as Record<string, unknown> | undefined,
      ),
    [isEditMode, initialData],
  );

  const amountPickerInitialConversion = useMemo(() => {
    if (
      !shouldUseStoredConversionForPreview({
        isEditMode,
        hadStoredConversion,
        conversionSnapshot,
        amountCurrency,
        targetCurrency: amountPickerTargetCurrency,
        accountLedgerCurrency,
        effectiveSpaceCurrency,
      })
    ) {
      return undefined;
    }

    return conversionSnapshot ?? undefined;
  }, [
    isEditMode,
    hadStoredConversion,
    conversionSnapshot,
    amountPickerTargetCurrency,
    accountLedgerCurrency,
    effectiveSpaceCurrency,
  ]);

  const showAmountFxInEdit = shouldShowAmountFxInEdit({
    isEditMode,
    conversionSnapshot,
    amountCurrency,
    targetCurrency: amountPickerTargetCurrency,
  });

  useEffect(() => {
    if (!conversionSnapshot) return;

    const targetMismatch =
      amountPickerTargetCurrency != null &&
      !conversionSnapshotMatchesTarget(
        conversionSnapshot,
        amountPickerTargetCurrency,
      );
    const amountMismatch = !conversionSnapshotMatchesAmountCurrency(
      conversionSnapshot,
      amountCurrency,
    );

    if (targetMismatch || amountMismatch) {
      setConversionSnapshot(null);
    }
  }, [amountPickerTargetCurrency, amountCurrency, conversionSnapshot]);

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
  // The user's chosen transaction currency (e.g. AED) should persist so the API
  // receives that currency and uses it for calculations/conversion.

  // Number input hook for amount field
  const amountInput = useNumberInput({
    initialValue: formState.amount,
    onValueChange: (cleanValue) => {
      handleFieldChange("amount", cleanValue.toString());
      onPrefillAmountChange?.(cleanValue !== 0 ? String(cleanValue) : "");
    },
  });
  
  // Store draftId separately since it's not part of the form values
  const [draftId, setDraftId] = useState<string | undefined>(initialData?.draftId);
  
  // Store fileId separately for handling draft files
  const [fileId, setFileId] = useState<string | null>(null);
  
  // Flag to prevent form submission when deleting draft
  const [isDeletingDraft, setIsDeletingDraft] = useState(false);
  
  // Draft functionality
  const [showDrafts, setShowDrafts] = useState(false);
  const { data: drafts = [], refetch: refetchDrafts } = useTransactionDrafts();
  const queryClient = useQueryClient();

  // Invalidate drafts query when form is loaded with initial data from Add Receipt
  useEffect(() => {
    if (initialData && initialData.draftId) {
      // When loading from Add Receipt with a draftId, invalidate the drafts query
      // to ensure we have the latest draft data
      queryClient.invalidateQueries({ queryKey: ['transactionDrafts'] });
      console.log('Invalidated transactionDrafts query due to Add Receipt initial data');
    }
  }, [initialData?.draftId, queryClient]);
  
  // Form errors
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  
  // Initialize formState from initialData (ref must start undefined so first run syncs original amount/currency for edit)
  const prevInitialDataRef = React.useRef<UpdateTransactionType | undefined>(undefined);
  const hadAttachmentOnLoadRef = useRef(false);

  useEffect(() => {
    if (initialData?.file) {
      hadAttachmentOnLoadRef.current = true;
    }
  }, [initialData?.file]);

  useEffect(() => {
    const data = initialData as Record<string, unknown> | undefined;
    const rawConv = data
      ? (data.currency_conversion ?? (initialData as any).currencyConversion) as Record<string, unknown> | undefined
      : undefined;

    // Backend sends original_display_amount / original_display_currency when there is a conversion; prefer those so edit form shows e.g. PLN and original amount.
    const originalAmount =
      data?.original_display_amount ?? (data as any)?.originalDisplayAmount;
    const originalCurrency =
      data?.original_display_currency ?? (data as any)?.originalDisplayCurrency;
    const hasOriginal = originalAmount != null && originalCurrency != null && String(originalCurrency).trim() !== "";

    if (initialData && (initialData !== prevInitialDataRef.current)) {
      const rawInitialAmount = hasOriginal
        ? originalAmount
        : rawConv != null
          ? (rawConv as any).original_amount ?? (rawConv as any).originalAmount ?? initialData.amount ?? ""
          : (initialData.amount ?? "");

      const initialAmount = positiveTransactionFormAmountString(rawInitialAmount);

      const displayCurrency = hasOriginal
        ? String(originalCurrency)
        : rawConv != null
          ? String((rawConv as any).original_currency ?? (rawConv as any).originalCurrency ?? effectiveSpaceCurrency)
          : effectiveSpaceCurrency;
      const useConversion = hasOriginal || (rawConv != null);

      setFormState({
        amount: initialAmount,
        description: initialData.description || "",
        categoryName: categoryPickerValueFromReceiptOrTransaction(
          {
            categoryId: initialData.categoryId,
            subcategoryId: initialData.subcategoryId,
            categoryName: initialData.categoryName,
          },
          categoryOptionsRaw,
        ),
        accountName: initialData.accountName || "",
        scheduleType: initialData.scheduleType || ScheduleTypeEnum.ONE_TIME,
        repeatInterval: initialData.repeatInterval || "",
        installmentPeriod: initialData.installmentPeriod?.toString() || "",
        file: initialData.file || null,
      });
      setEntityName(initialData.entityName || "");
      setReceiptMerchantDetected(initialData.receiptMerchantDetected);
      const nextTagIds =
        initialData.tags?.map((tag) => tag.id) ?? initialData.tagIds ?? [];
      const hasTagsInPayload =
        (initialData.tags?.length ?? 0) > 0 ||
        (initialData.tagIds?.length ?? 0) > 0;
      if (hasTagsInPayload) {
        setSelectedTagIds(nextTagIds);
      }

      if (initialAmount) {
        amountInput.setDisplayValue(numberFormatting.formatForInput(initialAmount));
      } else {
        amountInput.setDisplayValue("");
      }

      if (useConversion) {
        const editAccount = accountOptions.find(
          (a) => a.value === initialData.accountName,
        );
        setAmountCurrency(displayCurrency);
        setConversionSnapshot({
          originalCurrency: displayCurrency,
          targetCurrency: String(
            (rawConv as any)?.converted_currency ??
              (rawConv as any)?.convertedCurrency ??
              editAccount?.currency ??
              effectiveSpaceCurrency,
          ),
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

      setScheduleType(initialData.scheduleType || ScheduleTypeEnum.ONE_TIME);
      setDraftId(initialData.draftId);

      prevInitialDataRef.current = initialData;
    }

    if (!initialData && prevInitialDataRef.current) {
      // If initialData becomes undefined and it was previously set, clear the form
      setFormState({
        amount: "",
        description: "",
        categoryName: "",
        accountName: "",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        repeatInterval: "",
        installmentPeriod: "",
        file: null,
      });
      setEntityName("");
      amountInput.reset();
      setDate(undefined);
      setScheduleType(ScheduleTypeEnum.ONE_TIME);
      setFormSubmitted(false);
      setConversionSnapshot(null);
      prevInitialDataRef.current = undefined;
    }
  }, [initialData, initialData?.file, categoryOptionsRaw]);

  useEffect(() => {
    if (!initialData || categoryOptionsRaw.length === 0) {
      return;
    }

    const resolved = categoryPickerValueFromReceiptOrTransaction(
      {
        categoryId: initialData.categoryId,
        subcategoryId: initialData.subcategoryId,
        categoryName: initialData.categoryName,
      },
      categoryOptionsRaw,
    );

    if (!resolved || parseCategoryPickerValue(formState.categoryName)) {
      return;
    }

    if (resolved !== formState.categoryName) {
      handleFieldChange("categoryName", resolved);
    }
  }, [categoryOptionsRaw, initialData?.categoryId, initialData?.categoryName, initialData?.subcategoryId]);

  // Effect to force re-render when new categories or accounts are added
  useEffect(() => {
    // This dependency array includes categoryOptions and accountOptions
    // When they change (due to a new item being added), this comes in here
  }, [categoryOptions, accountOptions, refreshOptionsFlag]);
  
  // Form validation
  const validateForm = () => {
    try {
      expenseFormSchema.parse(formState);
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
  const handleFieldChange = (field: keyof ExpenseFormValues, value: any) => {
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

    if (editingLockedReason) {
      return;
    }
    
    // Prevent form submission if we're deleting a draft
    if (isDeletingDraft) {
      return;
    }
    
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

    if (
      createTransactionNeedsConversion({
        amountCurrency,
        targetCurrency: amountPickerTargetCurrency,
      }) &&
      !conversionSnapshot
    ) {
      toast.error("Exchange rate is still loading. Please wait a moment and try again.");
      setIsSubmitting(false);
      return;
    }

    if (
      transactionNeedsConversion({
        amountCurrency,
        targetCurrency: amountPickerTargetCurrency,
      }) &&
      conversionSnapshot &&
      !conversionSnapshotMatchesTarget(conversionSnapshot, amountPickerTargetCurrency)
    ) {
      toast.error(
        "Exchange rate does not match the selected account. Wait for the rate to refresh or re-open the Rates picker.",
      );
      setIsSubmitting(false);
      return;
    }
    
    let transactionCreated = false;

    try {
      const categoryFields = buildTransactionCategoryFields(
        formState.categoryName,
        categoryOptionsRaw,
      );

      const fileFields = buildTransactionFileUpdateFields({
        isEditMode,
        hadAttachmentOnLoad: hadAttachmentOnLoadRef.current,
        file: formState.file,
      });

      const transactionData = {
        amount: numberFormatting.cleanForBackend(formState.amount),
        description: formState.description || "",
        transactionType: "expense" as const,
        ...categoryFields,
        accountName: formState.accountName,
        date: format(date, "yyyy-MM-dd"),
        scheduleType: formState.scheduleType,
        ...(formState.scheduleType === ScheduleTypeEnum.REPEAT && {
          repeatInterval: formState.repeatInterval
        }),
        ...(formState.scheduleType === ScheduleTypeEnum.INSTALLMENT && {
          installmentPeriod: formState.installmentPeriod
            ? parseInt(formState.installmentPeriod, 10)
            : undefined
        }),
        ...(fileId && { fileId }),
        ...fileFields,
        ...(draftId && { draftId }),
        ...(conversionSnapshot && {
          original_currency: conversionSnapshot.originalCurrency,
          exchange_rate: conversionSnapshot.exchangeRate,
          exchange_rate_source: conversionSnapshot.exchangeRateSource,
        }),
        ...(isEditMode
          ? { entityName: entityName.trim() }
          : entityName.trim()
            ? { entityName: entityName.trim() }
            : {}),
        ...(receiptMerchantDetected?.trim()
          ? { receiptMerchantDetected: receiptMerchantDetected.trim() }
          : {}),
        tagIds: selectedTagIds,
        ...(selectedTagIds.length > 0
          ? {
              tags: availableTags.filter((tag) => selectedTagIds.includes(tag.id)),
            }
          : {}),
      };
      
      let response;
      
      if (isEditMode && id) {
        // Update existing transaction - pass the data to parent for scope handling
        const submitData = { ...transactionData, id, scheduleType: formState.scheduleType };
        response = await onSubmitSuccess?.(submitData);
        return; // Let parent handle the actual update
      } else {
        // Optimistic: patch list immediately after client validation; sync in background.
        response = await createTransactionLocalFirst(
          api,
          {
            spaceId: spaceCode,
            data: transactionData,
            amountCurrency: effectiveSpaceCurrency,
          },
          {
            queryClient,
            waitForSync: false,
          },
        );
        transactionCreated = true;
        toast.success("Expense created successfully");
        void response.syncPromise.then((synced) => {
          if (synced.pendingSync) {
            toast.message("Expense saved on this device. Will sync when online.");
          }
        }).catch((error) => {
          const fieldErrors = extractFieldErrors(error);
          toast.error(
            fieldErrors.detail || "Failed to create expense. Please try again.",
          );
        });
      }
      
      // Call onSubmitSuccess callback to notify parent component
      if (onSubmitSuccess && !isEditMode) {
        onSubmitSuccess(response);
      }
      
      // Invalidate drafts query after successful submission
      queryClient.invalidateQueries({ queryKey: ['transactionDrafts'] });
      console.log('Invalidated transactionDrafts query after successful submission');
      
      // Reset form only if not in edit mode (edit mode closes dialog)
      if (!isEditMode) {
        setFormState({
          amount: "",
          description: "",
          categoryName: "",
          accountName: "",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
          repeatInterval: "",
          installmentPeriod: "",
          file: null, // Reset file in formState
        });
        setEntityName("");
        // Reset number input hook
        amountInput.reset();
        setConversionSnapshot(null);
        setFileId(null);
        setDate(undefined);
        // setFileState(null); // Removed
        setScheduleType(ScheduleTypeEnum.ONE_TIME);
        setFormSubmitted(false); // Reset the form submission flag
      }
      
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} expense:`, error);
      if (transactionCreated) {
        return;
      }
      const fieldErrors = extractFieldErrors(error);
      
      toast.error(fieldErrors.detail || `Failed to ${isEditMode ? 'update' : 'create'} expense. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormState(prev => ({ ...prev, file }));
      setFileId(null);
      if (onFileUpdate) onFileUpdate(file); // Notify parent of file change
    } else {
      setFormState(prev => ({ ...prev, file: null }));
      setFileId(null);
      if (onFileUpdate) onFileUpdate(null); // Notify parent of file removal
    }
  };

  // Handle file removal
  const handleRemoveFile = () => {
    setFormState(prev => ({ ...prev, file: null }));
    setFileId(null);
    if (onFileUpdate) onFileUpdate(null); // Notify parent of file removal
  };

  // Handle draft selection
  const handleDraftSelect = async (draft: any) => {
    console.log('Draft selected:', draft);
    
    // Handle file transfer from draft using the same logic as EditTransactionDialog
    let displayFile = null;
    let draftFileId = null;
    
    if (draft.files && draft.files.length > 0) {
      const firstFile = draft.files[0];
      console.log('First file from draft:', firstFile);
      
      // Use the reusable utility to create display file object
      displayFile = createDisplayFileFromDraft({
        id: firstFile.id,
        url: firstFile.url,
        name: firstFile.name || `receipt-${draft.id}.jpg`,
        contentType: firstFile.contentType || 'image/jpeg'
      });
      
      draftFileId = firstFile.id;
      
      console.log('Using fileId for draft file:', draftFileId);
      console.log('Created display file:', displayFile);
      toast.success('Draft file loaded successfully');
    } else {
      console.log('No files found in draft');
    }

    const draftAmount = typeof draft.amount === 'number' ? draft.amount.toString() : String(draft.amount || "");
    
    const newFormState = {
      amount: draftAmount,
      description: draft.description || "",
      categoryName: categoryPickerValueFromReceiptOrTransaction(
        {
          categoryId: draft.categoryId,
          subcategoryId: draft.subcategoryId,
          categoryName: draft.categoryName || "",
        },
        categoryOptionsRaw,
      ),
      accountName: draft.accountName || "",
      scheduleType: draft.scheduleType || ScheduleTypeEnum.ONE_TIME,
      repeatInterval: draft.repeatInterval || "",
      installmentPeriod: draft.installmentPeriod?.toString() || "",
      file: displayFile, // Set the display file for preview
    };
    
    console.log('Setting new form state:', newFormState);
    setFormState(newFormState);
    
    // Update the amount input display value to reflect the draft amount
    if (draftAmount) {
      const formattedAmount = numberFormatting.formatForInput(draftAmount);
      amountInput.setDisplayValue(formattedAmount);
    }
    
    // Set file ID for submission
    setFileId(draftFileId);
    
    // Notify parent with file info for preview
    if (onFileUpdate && displayFile) {
      console.log('Notifying parent of file info:', displayFile);
      onFileUpdate(displayFile);
    }
    
    if (draft.date) {
      setDate(new Date(draft.date));
    }
    
    setDraftId(draft.id);
    setShowDrafts(false);
  };

  // Handle drafts invalidation
  const handleDraftsInvalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['transactionDrafts'] });
    console.log('Invalidated transactionDrafts query via handleDraftsInvalidate');
  };

  // Handle delete draft
  const handleDeleteDraft = async (e?: React.MouseEvent) => {
    // Prevent form submission
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!draftId) return;
    
    // Set flag to prevent form submission
    setIsDeletingDraft(true);
    
    try {
      await deleteTransaction(api, { id: draftId, deleteScope: DeleteScopeEnum.THIS_ONLY });
      toast.success('Draft deleted successfully');
      
      // Reset form
      setFormState({
        amount: "",
        description: "",
        categoryName: "",
        accountName: "",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        repeatInterval: "",
        installmentPeriod: "",
        file: null,
      });
      setEntityName("");
      setDate(new Date());
      setDraftId(undefined);
      
      // Notify parent of file removal
      if (onFileUpdate) {
        onFileUpdate(null);
      }
      
      // Invalidate drafts query
      handleDraftsInvalidate();
      
      // Close the form after deleting the draft
      // Use setTimeout to ensure the delete operation completes before closing
      setTimeout(() => {
        setIsDeletingDraft(false);
        if (onCancel) {
          onCancel();
        }
      }, 100);
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast.error('Failed to delete draft');
      setIsDeletingDraft(false);
    }
  };

  // Handle category creation
  const handleCategoryCreated = (categoryName: string) => {
    if (categoryName) {
      // Update the form state with the new category name
      handleFieldChange("categoryName", categoryName);
      
      // Notify parent component if callback provided
      if (onAddCustomCategory) onAddCustomCategory(categoryName);
      
      // Trigger a refresh of options
      setRefreshOptionsFlag(prev => prev + 1);
      
      
    }
  };

  // Handle account creation
  const handleAccountCreated = (accountName: string) => {
    if (accountName) {
      // Update the form state with the new account name
      handleFieldChange("accountName", accountName);
      
      // Notify parent component if callback provided
      if (onAddCustomAccount) onAddCustomAccount(accountName);
      
      // Trigger a refresh of options
      setRefreshOptionsFlag(prev => prev + 1);
      
      
    }
  };

  const maxDate = endOfMonth(new Date());
  const currentYear = new Date().getFullYear();

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {/* Scroll on a div — fieldset ignores overflow-y in most browsers. */}
      <div className={pinnedFormScrollAreaClassName}>
      <fieldset
        disabled={Boolean(editingLockedReason)}
        className="min-w-0 space-y-4 border-0 p-0 m-0 disabled:pointer-events-none disabled:opacity-70"
      >
        {!isEditMode && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="default"
                onClick={() => setShowDrafts(!showDrafts)}
              >
                <Receipt className="w-4 h-4 mr-2" />
                Receipt Drafts
              </Button>

              {draftId && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteDraft}
                  className="bg-destructive text-white hover:text-white"
                >
                  Delete Draft
                </Button>
              )}
            </div>

            {showDrafts && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <DraftItems
                  drafts={drafts.slice(0, 5)}
                  onDraftSelect={handleDraftSelect}
                  onDraftsInvalidate={handleDraftsInvalidate}
                />
              </div>
            )}
          </div>
        )}

        {/* Date + Amount: on mobile stack (Date row, then Amount row); on desktop side-by-side */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <FormControlField label="Date" htmlFor="date">
              <CalendarPopover
                modal
                open={datePickerOpen}
                onOpenChange={setDatePickerOpen}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-full w-full justify-start text-left font-normal text-sm",
                      formControlInteractiveSurfaceClassName,
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {date ? (
                      format(date, "MMM d, yyyy")
                    ) : (
                      <span className="text-sm">Pick a date</span>
                    )}
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
            </FormControlField>
            {suggestedDate && date && suggestedDate.toDateString() !== date.toDateString() && (
              <div className="mt-2 flex justify-end md:justify-start">
                <button
                  type="button"
                  onClick={() => setDate(suggestedDate)}
                  className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 cursor-pointer"
                >
                  Use AI date: {format(suggestedDate, "MMM d, yyyy")}
                </button>
              </div>
            )}
          </div>

          <div className="min-w-0">
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
            lockFromCurrency={false}
            hideRatePicker={isEditMode && !showAmountFxInEdit}
            previewOnly={false}
            onConversionChange={setConversionSnapshot}
            date={date ? format(date, "yyyy-MM-dd") : undefined}
            initialConversion={amountPickerInitialConversion}
          />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TransactionScheduleFields
            scheduleType={formState.scheduleType}
            onScheduleTypeChange={(value) => handleFieldChange("scheduleType", value)}
            scheduleTypeOptions={EXPENSE_SCHEDULE_TYPE_OPTIONS}
            repeatInterval={formState.repeatInterval}
            onRepeatIntervalChange={(value) => handleFieldChange("repeatInterval", value)}
            showRepeatInterval={scheduleType === ScheduleTypeEnum.REPEAT}
            scheduleTypeErrors={formSubmitted ? formErrors.scheduleType : undefined}
            repeatIntervalErrors={formSubmitted ? formErrors.repeatInterval : undefined}
          >
            {scheduleType === ScheduleTypeEnum.INSTALLMENT && (
              <div className="space-y-2">
                <Label htmlFor="installmentPeriod" className="text-sm">Number of Months</Label>
                <Input
                  id="installmentPeriod"
                  name="installmentPeriod"
                  value={formState.installmentPeriod || ""}
                  onChange={(e) => handleFieldChange("installmentPeriod", e.target.value)}
                  type="number"
                  placeholder="Number of months"
                  className={`text-sm ${formSubmitted && formErrors.installmentPeriod ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                />
                {formSubmitted && formErrors.installmentPeriod?.map((error) => (
                  <FormError key={error}>{error}</FormError>
                ))}
              </div>
            )}
          </TransactionScheduleFields>

          <FormControlField label="Expense Category" htmlFor="category">
            <GridPicker
              pickerKind="category"
              label="Expense Category"
              hideLabel
              value={formState.categoryName}
              onChange={(v) => handleFieldChange("categoryName", v)}
              categories={categoryOptions}
              error={formSubmitted && formErrors.categoryName ? formErrors.categoryName : undefined}
              categoryType={CategoryTypeEnum.EXPENSE}
              onCategoryCreated={handleCategoryCreated}
              disabled={isCategoryLockedForEdit}
            />
          </FormControlField>
        </div>
        {formSubmitted && formErrors.categoryName?.map((error) => (
          <FormError key={error}>{error}</FormError>
        ))}

        <div className="min-w-0">
          <FormControlField label="Account" htmlFor="accountName">
            <GridPicker
              pickerKind="account"
              label="Account"
              hideLabel
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
          </FormControlField>
          {accountCurrencyDiffersFromSpace && selectedAccount?.currency && (
            <p className="mt-1 text-xs text-muted-foreground">
              Account currency: {selectedAccount.currency} (differs from space: {effectiveSpaceCurrency})
            </p>
          )}
        </div>

        <TransactionEntityField
          id="expense-entity"
          kind="merchant"
          value={entityName}
          onChange={setEntityName}
        />

        <TagMultiPicker
          tags={availableTags}
          value={selectedTagIds}
          onChange={setSelectedTagIds}
          onCreateTag={async (name, color) => {
            const created = await createTag({ name, color });
            const id = created?.data?.id as string | undefined;
            if (id) {
              return { id, name, color };
            }
            return undefined;
          }}
          disabled={Boolean(editingLockedReason)}
        />

        <div className="min-w-0 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <Label htmlFor="description" className="text-sm font-medium text-primary">
              Note
            </Label>
            <span className="text-xs text-muted-foreground">Optional</span>
          </div>
          <NotesAutocomplete
            id="description"
            value={formState.description || ""}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              handleFieldChange("description", e.target.value)
            }
            categoryName={formState.categoryName}
            transactionType="expense"
            placeholder="Add additional details"
            className="text-sm"
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
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="text-sm">
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="bg-primary hover:bg-primary/80 text-sm" 
            disabled={isSubmitting || Boolean(editingLockedReason)}
            title={editingLockedReason ?? undefined}
            data-tutorial-target="add-expense-button"
          >
            {isSubmitting ? (isEditMode ? "Updating Expense..." : "Adding Expense...") : (isEditMode ? "Update Expense" : "Add Expense")}
          </Button>
        </div>
      </StickyFormActions>
    </form>
  );
};

export default ExpenseForm;
