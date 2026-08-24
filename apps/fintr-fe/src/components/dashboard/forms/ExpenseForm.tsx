import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
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
import { Upload, CalendarIcon, Receipt, ChevronDown } from "lucide-react";
import { Calendar } from "../../ui/calendar";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { FormControlField } from "@/components/ui/form-control-field";
import { formControlInteractiveSurfaceClassName } from "@/components/ui/form-control-surface";
import { cn, formatCurrency, formatWithDelimiters, numberFormatting } from "@/lib/utils";
import { format, endOfMonth } from "date-fns";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { accountOptionsAtom } from "@/atoms/dashboardAtoms";
import { useTransactionCategories } from "@/hooks/async/useTransactionCategories";
import { toast } from "sonner";
import { useAuthApi } from "@/hooks/useAuthApi";
import { extractFieldErrors } from "@/utils/errorUtils";
import { FormError } from "@/components/ui/form-error";
import { useNumberInput } from "@/hooks/useNumberInput";
import * as z from "zod"; 
import { createTransactionLocalFirst } from "@/services/transactions/create-local-first";
import { updateTransaction, deleteTransaction } from "@/services/transactions/mutation";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { ScheduleTypeEnum, TransactionTypeEnum, DeleteScopeEnum, EXPENSE_SCHEDULE_TYPE_OPTIONS, UpdateScopeEnum } from "@/constants/transactionConstants";
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
import FileUploadField from "./FileUploadField";
import TransactionEntityField from "./TransactionEntityField";
import TransactionDescriptionField from "./TransactionDescriptionField";
import { createDisplayFileFromDraft } from "@/utils/fileUtils";
import { useTransactionDrafts } from "@/hooks/async/useTransactionDrafts";
import DraftItems from "./DraftItems";
import { useQueryClient } from "@tanstack/react-query";
import { DeleteButton } from "../tabs/transactions/buttons/DeleteButton";
import { StickyFormActions, pinnedFormScrollAreaClassName } from "./StickyFormActions";
import {
  convertLoanTermDisplay,
  formatLoanTermUnitLabel,
  loanTermToMonths,
  type LoanTermUnit,
} from "@/utils/formatLoanTerm";
import {
  AmountWithRatePicker,
  type ConversionSnapshot,
} from "./AmountWithRatePicker";
import { resolvePrefillAmountCurrency, buildTransactionFileUpdateFields } from "@/utils/formUtils";
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
  conversionSnapshotFromTransactionData,
  createTransactionNeedsConversion,
  resolveAmountPickerTargetCurrency,
  storedConversionForEditForm,
  shouldUseStoredConversionForPreview,
  transactionNeedsConversion,
  shouldShowAmountFxInEdit,
  transactionHadStoredConversion,
  withEditOriginalCurrency,
} from "@/utils/amountPickerTargetCurrency";
import { getLocalIsoDateKey } from "@/utils/dateUtils";
import {
  positiveTransactionFormAmount,
  positiveTransactionFormAmountString,
} from "@/utils/transactionFormAmount";
import {
  amountDirtySignature,
  conversionDirtySignature,
  dateDirtySignature,
  fileDirtySignature,
  isEditSnapshotDirty,
  tagIdsDirtySignature,
  useAttachmentDirtyBaseline,
} from "@/utils/transactionEditDirty";
import type { InstallmentRevisionSeriesContext } from "@/utils/installmentPlanRevision";
import { resolveInstallmentThisOnlyPlanTotal } from "@/utils/installmentPlanRevision";
import {
  adjustInstallmentTotalForSinglePaymentChange,
  adjustInstallmentThisPaymentForPlanTotalChange,
  resolveInstallmentFormInitialAmounts,
  resolveInstallmentSubmitAmount,
  resolveRemainingInstallmentCount,
  roundInstallmentPerPayment,
  syncInstallmentAmounts,
  syncInstallmentRevisionAmounts,
  installmentRemainingPaymentsLabel,
  resolveInstallmentDisplayedPlanTotal,
  resolveInstallmentStoredPlanTotal,
  type InstallmentAmountAnchor,
} from "@/utils/installmentFormAmounts";
import { installmentRemainingOccurrenceDates } from "@fintr/domain";
import InstallmentUpdateScopeSelector from "./InstallmentUpdateScopeSelector";
import type { UpdateScope } from "./ScopeModal";

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
  installmentPeriod: z.string().optional(),
  installmentTermUnit: z.enum(["months", "years"]).optional(),
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
    const months = loanTermToMonths(
      data.installmentPeriod ?? "",
      data.installmentTermUnit ?? "months",
    );
    if (months <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Installment term is required and must be positive",
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
  onDirtyChange?: (dirty: boolean) => void;
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
  /** Paid installment rows in the series — used to keep committed amounts out of edits. */
  installmentSeriesContext?: InstallmentRevisionSeriesContext | null;
  /** When editing an installment in a series, scope is chosen before the form fields. */
  showInstallmentScopeSelector?: boolean;
  installmentUpdateScope?: UpdateScope;
  onInstallmentUpdateScopeChange?: (scope: UpdateScope) => void;
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
  onDirtyChange,
  formRef,
  id,
  initialData,
  isEditMode = false,
  onFileUpdate,
  onDelete,
  editingLockedReason = null,
  prefillAmount,
  onPrefillAmountChange,
  installmentSeriesContext = null,
  showInstallmentScopeSelector = false,
  installmentUpdateScope = UpdateScopeEnum.THIS_ONLY,
  onInstallmentUpdateScopeChange,
}) => {
  // Get options from atoms and the shared category list
  const { expenseCategoryOptions: categoryOptionsRaw } = useTransactionCategories();
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
    let codes = fromAccounts.length > 0 ? fromAccounts : ["PHP"];
    // Include space default so it can be pre-selected even if no account uses it yet
    if (
      defaultTransactionCurrency &&
      defaultTransactionCurrency.length === 3 &&
      !codes.includes(defaultTransactionCurrency)
    ) {
      codes = [defaultTransactionCurrency, ...codes];
    }

    if (!isEditMode || !initialData) {
      return codes;
    }

    const data = initialData as Record<string, unknown>;
    const conversion = (
      data.currencyConversion ?? data.currency_conversion
    ) as Record<string, unknown> | undefined;

    return withEditOriginalCurrency(
      codes,
      String(
        data.originalDisplayCurrency
        ?? data.original_display_currency
        ?? conversion?.originalCurrency
        ?? conversion?.original_currency
        ?? "",
      ),
    );
  }, [accountOptions, defaultTransactionCurrency, isEditMode, initialData]);

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
    installmentTermUnit: "months" as LoanTermUnit,
    file: initialData?.file || null,
  });
  const [installmentMonthlyAmount, setInstallmentMonthlyAmount] = useState("");
  const [installmentThisPaymentAmount, setInstallmentThisPaymentAmount] = useState("");
  const installmentAmountAnchorRef = useRef<InstallmentAmountAnchor>("total");

  const toggleInstallmentTermUnit = () => {
    const currentUnit = formState.installmentTermUnit ?? "months";
    const nextUnit: LoanTermUnit =
      currentUnit === "months" ? "years" : "months";
    const nextTerm = convertLoanTermDisplay(
      formState.installmentPeriod ?? "",
      currentUnit,
      nextUnit,
    );

    setFormState((prev) => ({
      ...prev,
      installmentTermUnit: nextUnit,
      installmentPeriod: nextTerm,
    }));
  };

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
          (initialData as { bookedAmountCurrency?: string; booked_amount_currency?: string })
            .bookedAmountCurrency
          ?? (initialData as { booked_amount_currency?: string }).booked_amount_currency
          ?? (initialData as { originalDisplayCurrency?: string; original_display_currency?: string })
            .originalDisplayCurrency
          ?? (initialData as { original_display_currency?: string }).original_display_currency
          ?? "",
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
      return conversionSnapshotFromTransactionData(
        initialData as unknown as Record<string, unknown>,
      );
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

  const storedTransactionConversion = useMemo(
    () =>
      storedConversionForEditForm({
        data: initialData as unknown as Record<string, unknown> | undefined,
        targetCurrency: amountPickerTargetCurrency,
      }),
    [initialData, amountPickerTargetCurrency],
  );

  const isCrossCurrencyEdit = useMemo(
    () => {
      if (!isEditMode) return false;
      if (hadStoredConversion) return true;
      if (
        amountPickerTargetCurrency != null
        && amountCurrency.trim().toUpperCase()
          !== amountPickerTargetCurrency.trim().toUpperCase()
      ) {
        return true;
      }

      return (
        amountCurrency.trim().toUpperCase()
        !== effectiveSpaceCurrency.trim().toUpperCase()
      );
    },
    [
      isEditMode,
      hadStoredConversion,
      amountCurrency,
      amountPickerTargetCurrency,
      effectiveSpaceCurrency,
    ],
  );

  const suppressEditRateAutoFetch = useMemo(
    () =>
      isEditMode
      && (
        Boolean(storedTransactionConversion)
        || hadStoredConversion
        || isCrossCurrencyEdit
      ),
    [
      isEditMode,
      storedTransactionConversion,
      hadStoredConversion,
      isCrossCurrencyEdit,
    ],
  );

  const amountPickerInitialConversion = useMemo(() => {
    if (!isEditMode || !initialData) {
      return undefined;
    }

    return conversionSnapshot ?? storedTransactionConversion ?? undefined;
  }, [
    isEditMode,
    initialData,
    conversionSnapshot,
    storedTransactionConversion,
  ]);

  const handleAmountConversionChange = (next: ConversionSnapshot | null) => {
    if (!next) {
      if (!storedTransactionConversion) {
        setConversionSnapshot(null);
      }
      return;
    }

    setConversionSnapshot(next);
  };

  useEffect(() => {
    if (!isEditMode || !storedTransactionConversion) {
      return;
    }

    setConversionSnapshot((previous) => {
      if (
        previous
        && Math.abs(previous.exchangeRate - storedTransactionConversion.exchangeRate)
          >= 1e-6
      ) {
        return previous;
      }

      return storedTransactionConversion;
    });
  }, [
    isEditMode,
    storedTransactionConversion,
    initialData?.id,
  ]);

  const showAmountFxInEdit = shouldShowAmountFxInEdit({
    isEditMode,
    conversionSnapshot: amountPickerInitialConversion ?? conversionSnapshot,
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

    if (!targetMismatch && !amountMismatch) {
      return;
    }

    // Prefer repairing currency legs over clearing — clearing drops
    // initialConversion and lets AmountWithRatePicker auto-fetch a live rate.
    // Never reset exchangeRate here; that would undo a rate the user just applied.
    if (hadStoredConversion && initialData) {
      const stored = storedTransactionConversion
        ?? conversionSnapshotFromTransactionData(
          initialData as unknown as Record<string, unknown>,
        )
        ?? storedConversionForEditForm({
          data: initialData as unknown as Record<string, unknown>,
          targetCurrency: amountPickerTargetCurrency,
        });
      if (stored) {
        setConversionSnapshot({
          ...stored,
          originalCurrency: amountCurrency || stored.originalCurrency,
          targetCurrency:
            amountPickerTargetCurrency
            ?? stored.targetCurrency,
        });
        return;
      }

      const d = initialData as Record<string, unknown>;
      const rawConv = (d.currencyConversion ?? d.currency_conversion) as
        | Record<string, unknown>
        | undefined;
      const originalCurrency = String(
        d.originalDisplayCurrency
          ?? d.original_display_currency
          ?? rawConv?.originalCurrency
          ?? rawConv?.original_currency
          ?? "",
      ).trim();
      if (originalCurrency) {
        const repairedTarget =
          amountPickerTargetCurrency
          || String(
            rawConv?.converted_currency
              ?? rawConv?.convertedCurrency
              ?? "",
          ).trim()
          || conversionSnapshot.targetCurrency
          || amountCurrency;
        setConversionSnapshot({
          ...conversionSnapshot,
          originalCurrency: amountCurrency || originalCurrency,
          targetCurrency: repairedTarget,
        });
        return;
      }
    }

    if (isEditMode && hadStoredConversion) {
      return;
    }

    setConversionSnapshot(null);
  }, [
    amountPickerTargetCurrency,
    amountCurrency,
    conversionSnapshot,
    hadStoredConversion,
    initialData,
    isEditMode,
    storedTransactionConversion,
  ]);

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

  const installmentPeriodMonths = useMemo(
    () =>
      scheduleType === ScheduleTypeEnum.INSTALLMENT
        ? loanTermToMonths(
            formState.installmentPeriod ?? "",
            formState.installmentTermUnit ?? "months",
          )
        : 0,
    [
      scheduleType,
      formState.installmentPeriod,
      formState.installmentTermUnit,
    ],
  );
  const isInstallmentSchedule = scheduleType === ScheduleTypeEnum.INSTALLMENT;
  const installmentPaidSoFar = isEditMode
    ? (installmentSeriesContext?.paidSoFarCents ?? 0) / 100
    : 0;
  const installmentCommittedMonthsCount = isEditMode
    ? installmentSeriesContext?.committedMonthsCount ?? 0
    : 0;
  const installmentRemainingMonths = resolveRemainingInstallmentCount({
    periodMonths: installmentPeriodMonths,
    committedMonthsCount: installmentCommittedMonthsCount,
  });
  const installmentEditMode = useMemo(() => {
    if (!isEditMode || !isInstallmentSchedule) {
      return null;
    }

    if (!showInstallmentScopeSelector) {
      return "legacy_plan" as const;
    }

    if (installmentUpdateScope === UpdateScopeEnum.THIS_ONLY) {
      return "single_payment" as const;
    }

    if (installmentUpdateScope === UpdateScopeEnum.ALL_IN_SERIES) {
      return "plan_without_committed" as const;
    }

    return "plan_with_committed" as const;
  }, [
    isEditMode,
    isInstallmentSchedule,
    showInstallmentScopeSelector,
    installmentUpdateScope,
  ]);
  const isInstallmentSinglePaymentEdit = installmentEditMode === "single_payment";
  const isInstallmentPlanEdit =
    installmentEditMode === "plan_with_committed"
    || installmentEditMode === "plan_without_committed"
    || installmentEditMode === "legacy_plan";
  const effectiveInstallmentCommittedMonthsCount =
    installmentEditMode === "plan_with_committed"
    || installmentEditMode === "legacy_plan"
      ? installmentCommittedMonthsCount
      : 0;
  const effectiveInstallmentPaidSoFar =
    installmentEditMode === "plan_with_committed"
    || installmentEditMode === "legacy_plan"
      ? installmentPaidSoFar
      : 0;
  const effectiveInstallmentRemainingMonths = useMemo(() => {
    if (
      installmentEditMode === "plan_with_committed"
      && installmentPeriodMonths > 0
      && initialData?.date
    ) {
      const seriesParentDate =
        (initialData as { seriesParentDate?: string | null }).seriesParentDate
        ?? initialData.date;

      return installmentRemainingOccurrenceDates({
        parentDate: getLocalIsoDateKey(seriesParentDate),
        period: installmentPeriodMonths,
        effectiveDate: getLocalIsoDateKey(initialData.date),
        calculatedDates: installmentSeriesContext?.calculatedDates ?? [],
      }).length;
    }

    return resolveRemainingInstallmentCount({
      periodMonths: installmentPeriodMonths,
      committedMonthsCount: effectiveInstallmentCommittedMonthsCount,
    });
  }, [
    installmentEditMode,
    installmentSeriesContext,
    installmentPeriodMonths,
    initialData?.date,
    (initialData as { seriesParentDate?: string | null } | undefined)
      ?.seriesParentDate,
    effectiveInstallmentCommittedMonthsCount,
  ]);
  const installmentRevisionDates = useMemo(() => {
    if (!initialData?.date) {
      return null;
    }

    const seriesParentDate =
      (initialData as { seriesParentDate?: string | null }).seriesParentDate
      ?? initialData.date;

    return {
      parentDate: getLocalIsoDateKey(seriesParentDate),
      effectiveDate: getLocalIsoDateKey(initialData.date),
    };
  }, [
    initialData?.date,
    (initialData as { seriesParentDate?: string | null } | undefined)
      ?.seriesParentDate,
  ]);
  const canUseInstallmentRevisionSync =
    installmentEditMode === "plan_with_committed"
    && installmentRevisionDates != null
    && installmentPeriodMonths > 0;
  const installmentBaselineRef = useRef({
    planTotal: 0,
    paymentAmount: 0,
  });
  const installmentPriorPerPaymentCents =
    installmentSeriesContext?.defaultPerPaymentCents
    ?? Math.round((installmentBaselineRef.current.paymentAmount || 0) * 100);
  const installmentOccurrenceCentsByDate =
    installmentSeriesContext?.occurrenceCentsByDate;
  const liveConversion = conversionSnapshot ?? storedTransactionConversion;
  const installmentRevisionFxParams = useMemo(
    () => {
      return {
        exchangeRate: Number(liveConversion?.exchangeRate ?? 0),
        displayCurrency: amountCurrency,
        ledgerCurrency:
          liveConversion?.targetCurrency
          ?? effectiveSpaceCurrency,
      };
    },
    [
      liveConversion,
      amountCurrency,
      effectiveSpaceCurrency,
    ],
  );
  const syncInstallmentFieldsRef = useRef<
    (anchor: InstallmentAmountAnchor, total: number, monthly: number) => void
  >(() => {});

  const thisPaymentDisplayRef = useRef<(value: string) => void>(() => {});
  const amountDisplayRef = useRef<(value: string) => void>(() => {});

  // Number input hook for amount field
  const amountInput = useNumberInput({
    initialValue: formState.amount,
    onValueChange: (cleanValue) => {
      if (scheduleType === ScheduleTypeEnum.INSTALLMENT) {
        if (isInstallmentSinglePaymentEdit) {
          const nextTotal = cleanValue;
          const nextPayment = adjustInstallmentThisPaymentForPlanTotalChange({
            originalPlanTotal: installmentBaselineRef.current.planTotal,
            originalPaymentAmount: installmentBaselineRef.current.paymentAmount,
            nextPlanTotal: nextTotal,
          });
          setFormState((prev) => ({
            ...prev,
            amount: nextTotal !== 0 ? String(nextTotal) : "",
          }));
          setInstallmentThisPaymentAmount(
            nextPayment > 0 ? String(nextPayment) : "",
          );
          thisPaymentDisplayRef.current(
            nextPayment > 0
              ? numberFormatting.formatForInput(String(nextPayment))
              : "",
          );
          return;
        }

        syncInstallmentFieldsRef.current(
          "total",
          cleanValue,
          Number.parseFloat(installmentMonthlyAmount) || 0,
        );
        return;
      }

      handleFieldChange("amount", cleanValue !== 0 ? String(cleanValue) : "");
      onPrefillAmountChange?.(cleanValue !== 0 ? String(cleanValue) : "");
    },
  });

  const monthlyAmountInput = useNumberInput({
    initialValue: installmentMonthlyAmount,
    onValueChange: (cleanValue) => {
      if (scheduleType !== ScheduleTypeEnum.INSTALLMENT) {
        return;
      }

      if (isInstallmentSinglePaymentEdit) {
        return;
      }

      syncInstallmentFieldsRef.current(
        "monthly",
        Number.parseFloat(formState.amount) || 0,
        cleanValue,
      );
    },
  });

  const thisPaymentAmountInput = useNumberInput({
    initialValue: installmentThisPaymentAmount,
    onValueChange: (cleanValue) => {
      if (!isInstallmentSinglePaymentEdit) {
        return;
      }

      const nextPayment = cleanValue;
      const nextTotal = adjustInstallmentTotalForSinglePaymentChange({
        planTotal: installmentBaselineRef.current.planTotal,
        originalPaymentAmount: installmentBaselineRef.current.paymentAmount,
        nextPaymentAmount: nextPayment,
      });
      setInstallmentThisPaymentAmount(
        nextPayment !== 0 ? String(nextPayment) : "",
      );
      setFormState((prev) => ({
        ...prev,
        amount: nextTotal > 0 ? String(nextTotal) : "",
      }));
      amountDisplayRef.current(
        nextTotal > 0
          ? numberFormatting.formatForInput(String(nextTotal))
          : "",
      );
    },
  });
  thisPaymentDisplayRef.current = (value) => {
    thisPaymentAmountInput.setDisplayValue(value);
  };
  amountDisplayRef.current = (value) => {
    amountInput.setDisplayValue(value);
  };

  syncInstallmentFieldsRef.current = (
    anchor,
    total,
    monthly,
  ) => {
    const synced =
      installmentPeriodMonths > 0
        ? canUseInstallmentRevisionSync
          ? syncInstallmentRevisionAmounts({
              anchor,
              total,
              monthly,
              parentDate: installmentRevisionDates!.parentDate,
              effectiveDate: installmentRevisionDates!.effectiveDate,
              periodMonths: installmentPeriodMonths,
              paidSoFarCents: installmentSeriesContext?.paidSoFarCents ?? 0,
              calculatedDates: installmentSeriesContext?.calculatedDates ?? [],
              priorPerPaymentCents:
                installmentPriorPerPaymentCents
                || Math.round(monthly * 100),
              occurrenceCentsByDate: installmentOccurrenceCentsByDate,
              ...installmentRevisionFxParams,
            })
          : syncInstallmentAmounts({
              anchor,
              total,
              monthly,
              periodMonths: installmentPeriodMonths,
              paidSoFar: effectiveInstallmentPaidSoFar,
              committedMonthsCount: effectiveInstallmentCommittedMonthsCount,
            })
        : { total, monthly };

    installmentAmountAnchorRef.current = anchor;
    setFormState((prev) => ({
      ...prev,
      amount: synced.total > 0 ? String(synced.total) : "",
    }));
    setInstallmentMonthlyAmount(synced.monthly > 0 ? String(synced.monthly) : "");
    amountInput.setDisplayValue(
      synced.total > 0
        ? numberFormatting.formatForInput(String(synced.total))
        : "",
    );
    monthlyAmountInput.setDisplayValue(
      synced.monthly > 0
        ? numberFormatting.formatForInput(String(synced.monthly))
        : "",
    );

    if (anchor === "total") {
      onPrefillAmountChange?.(synced.total !== 0 ? String(synced.total) : "");
    }
  };

  const prevInstallmentPeriodMonthsRef = useRef(installmentPeriodMonths);
  useEffect(() => {
    if (prevInstallmentPeriodMonthsRef.current === installmentPeriodMonths) {
      return;
    }

    prevInstallmentPeriodMonthsRef.current = installmentPeriodMonths;

    if (!isInstallmentSchedule || installmentPeriodMonths <= 0) {
      return;
    }

    if (isInstallmentSinglePaymentEdit) {
      return;
    }

    const total = Number.parseFloat(formState.amount) || 0;
    const monthly = Number.parseFloat(installmentMonthlyAmount) || 0;

    if (total <= 0 && monthly <= 0) {
      return;
    }

    syncInstallmentFieldsRef.current(
      installmentAmountAnchorRef.current,
      total,
      monthly,
    );
  }, [
    installmentPeriodMonths,
    isInstallmentSchedule,
    isInstallmentSinglePaymentEdit,
    formState.amount,
    installmentMonthlyAmount,
  ]);

  const projectedInstallmentPlanTotal = useMemo(() => {
    if (!isInstallmentSinglePaymentEdit) {
      return null;
    }

    const nextPaymentAmount = Number.parseFloat(formState.amount) || 0;
    const { planTotal, paymentAmount } = installmentBaselineRef.current;

    return adjustInstallmentTotalForSinglePaymentChange({
      planTotal,
      originalPaymentAmount: paymentAmount,
      nextPaymentAmount,
    });
  }, [isInstallmentSinglePaymentEdit, formState.amount]);

  const prevInstallmentEditModeRef = useRef<typeof installmentEditMode | null>(
    null,
  );
  useEffect(() => {
    if (!initialData || installmentEditMode == null) {
      prevInstallmentEditModeRef.current = installmentEditMode;
      return;
    }

    if (prevInstallmentEditModeRef.current === installmentEditMode) {
      return;
    }

    prevInstallmentEditModeRef.current = installmentEditMode;

    const { planTotal, paymentAmount } = installmentBaselineRef.current;
    const periodMonths = loanTermToMonths(
      initialData.installmentPeriod?.toString() ?? "",
      "months",
    );

    if (installmentEditMode === "single_payment") {
      const total = planTotal > 0 ? String(planTotal) : "";
      const payment = paymentAmount > 0 ? String(paymentAmount) : "";
      setFormState((prev) => ({ ...prev, amount: total }));
      amountInput.setDisplayValue(
        total ? numberFormatting.formatForInput(total) : "",
      );
      setInstallmentThisPaymentAmount(payment);
      thisPaymentAmountInput.setDisplayValue(
        payment ? numberFormatting.formatForInput(payment) : "",
      );
      return;
    }

    const scopedInstallmentAmounts = resolveInstallmentFormInitialAmounts({
      installmentTotal: resolveInstallmentDisplayedPlanTotal({
        enteredAmount: planTotal,
        planTotal,
        perPaymentAmount: paymentAmount,
      }),
      perPaymentAmount: paymentAmount,
      periodMonths,
      useStoredTotal: planTotal > 0 && planTotal !== paymentAmount,
      paidSoFar: effectiveInstallmentPaidSoFar,
      committedMonthsCount: effectiveInstallmentCommittedMonthsCount,
      parentDate: installmentRevisionDates?.parentDate,
      effectiveDate: installmentRevisionDates?.effectiveDate,
      calculatedDates: installmentSeriesContext?.calculatedDates,
      priorPerPaymentCents:
        installmentPriorPerPaymentCents
        || Math.round(paymentAmount * 100),
      occurrenceCentsByDate: installmentOccurrenceCentsByDate,
      ...installmentRevisionFxParams,
    });

    syncInstallmentFieldsRef.current(
      "total",
      scopedInstallmentAmounts.total,
      scopedInstallmentAmounts.monthly,
    );
  }, [
    installmentEditMode,
    initialData,
    effectiveInstallmentPaidSoFar,
    effectiveInstallmentCommittedMonthsCount,
    installmentRevisionDates,
    installmentSeriesContext,
    installmentPriorPerPaymentCents,
    installmentOccurrenceCentsByDate,
  ]);

  const installmentRevisionContextKey = [
    installmentSeriesContext?.paidSoFarCents ?? 0,
    installmentSeriesContext?.committedMonthsCount ?? 0,
    installmentSeriesContext?.calculatedDates?.join(",") ?? "",
    installmentSeriesContext?.defaultPerPaymentCents ?? 0,
    JSON.stringify(installmentSeriesContext?.occurrenceCentsByDate ?? {}),
    initialData?.id,
  ].join("|");
  const prevInstallmentRevisionContextKeyRef = useRef(installmentRevisionContextKey);

  useEffect(() => {
    if (installmentEditMode !== "plan_with_committed") {
      prevInstallmentRevisionContextKeyRef.current = installmentRevisionContextKey;
      return;
    }

    if (prevInstallmentRevisionContextKeyRef.current === installmentRevisionContextKey) {
      return;
    }

    prevInstallmentRevisionContextKeyRef.current = installmentRevisionContextKey;

    const { planTotal, paymentAmount } = installmentBaselineRef.current;
    const total = resolveInstallmentDisplayedPlanTotal({
      enteredAmount:
        Number.parseFloat(formState.amount)
        || planTotal,
      planTotal,
      perPaymentAmount: paymentAmount,
    });
    const monthly =
      Number.parseFloat(installmentMonthlyAmount)
      || paymentAmount;

    if (total <= 0 && monthly <= 0) {
      return;
    }

    syncInstallmentFieldsRef.current(
      installmentAmountAnchorRef.current,
      total,
      monthly,
    );
  }, [
    installmentEditMode,
    installmentRevisionContextKey,
    installmentSeriesContext?.committedMonthsCount,
    formState.amount,
    installmentMonthlyAmount,
  ]);

  const prevSinglePaymentContextKeyRef = useRef(installmentRevisionContextKey);

  useEffect(() => {
    if (
      installmentEditMode !== "single_payment"
      || !installmentSeriesContext
      || !initialData
    ) {
      prevSinglePaymentContextKeyRef.current = installmentRevisionContextKey;
      return;
    }

    if (prevSinglePaymentContextKeyRef.current === installmentRevisionContextKey) {
      return;
    }

    prevSinglePaymentContextKeyRef.current = installmentRevisionContextKey;

    const periodMonths = initialData.installmentPeriod ?? 0;
    if (periodMonths <= 0) {
      return;
    }

    const commitmentTotal = resolveInstallmentThisOnlyPlanTotal({
      target: initialData as UpdateTransactionType & {
        seriesParentDate?: string | null;
      },
      context: installmentSeriesContext,
      parentDate:
        (initialData as { seriesParentDate?: string | null }).seriesParentDate
        ?? initialData.date,
      periodMonths,
    });

    if (commitmentTotal == null || commitmentTotal <= 0) {
      return;
    }

    const perPaymentAmount =
      installmentBaselineRef.current.paymentAmount
      || Number.parseFloat(installmentThisPaymentAmount)
      || 0;
    const resolvedTotal = resolveInstallmentStoredPlanTotal({
      installmentTotal: commitmentTotal,
      perPaymentAmount,
      periodMonths,
      convertedPerPaymentAmount: Number(
        initialData.currencyConversion?.convertedAmount ?? 0,
      ),
      exchangeRate: Number(initialData.currencyConversion?.exchangeRate ?? 0),
    });

    const currentTotal = Number.parseFloat(formState.amount) || 0;
    if (
      resolvedTotal <= currentTotal + 0.005
      || Math.abs(currentTotal - resolvedTotal) < 0.005
    ) {
      return;
    }

    installmentBaselineRef.current = {
      planTotal: resolvedTotal,
      paymentAmount: perPaymentAmount,
    };
    setFormState((previous) => ({
      ...previous,
      amount: String(resolvedTotal),
    }));
    amountInput.setDisplayValue(
      numberFormatting.formatForInput(String(resolvedTotal)),
    );
  }, [
    installmentEditMode,
    installmentRevisionContextKey,
    installmentSeriesContext,
    initialData,
    formState.amount,
    installmentThisPaymentAmount,
    amountInput,
    numberFormatting,
  ]);
  
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
      const isInstallment =
        (initialData.scheduleType || ScheduleTypeEnum.ONE_TIME)
        === ScheduleTypeEnum.INSTALLMENT;
      const installmentPeriod = initialData.installmentPeriod || 0;
      const perPaymentAmount = Number.parseFloat(initialAmount) || 0;
      const storedFromDetail = resolveInstallmentStoredPlanTotal({
        installmentTotal: initialData.installmentTotal,
        perPaymentAmount,
        periodMonths: installmentPeriod,
        convertedPerPaymentAmount: Number(
          (rawConv as { converted_amount?: unknown; convertedAmount?: unknown } | undefined)
            ?.convertedAmount
          ?? (rawConv as { converted_amount?: unknown; convertedAmount?: unknown } | undefined)
            ?.converted_amount,
        ),
        exchangeRate: Number(
          (rawConv as { exchange_rate?: unknown; exchangeRate?: unknown } | undefined)
            ?.exchangeRate
          ?? (rawConv as { exchange_rate?: unknown; exchangeRate?: unknown } | undefined)
            ?.exchange_rate
          ?? storedTransactionConversion?.exchangeRate
          ?? 0,
        ),
      });
      const commitmentPlanTotal =
        isInstallment
        && installmentUpdateScope === UpdateScopeEnum.THIS_ONLY
        && installmentSeriesContext
        && installmentPeriod > 0
          ? resolveInstallmentThisOnlyPlanTotal({
              target: initialData as UpdateTransactionType & {
                seriesParentDate?: string | null;
              },
              context: installmentSeriesContext,
              parentDate:
                (initialData as { seriesParentDate?: string | null })
                  .seriesParentDate
                ?? initialData.date,
              periodMonths: installmentPeriod,
            })
          : null;
      const storedPlanTotal =
        commitmentPlanTotal != null
        && commitmentPlanTotal > storedFromDetail + 0.005
          ? commitmentPlanTotal
          : storedFromDetail;
      const installmentAmounts = isInstallment
        ? resolveInstallmentFormInitialAmounts({
            installmentTotal: storedPlanTotal,
            perPaymentAmount,
            periodMonths: installmentPeriod,
            useStoredTotal: storedPlanTotal > 0,
            ...(
              installmentUpdateScope === UpdateScopeEnum.THIS_AND_FUTURE
              || installmentUpdateScope === UpdateScopeEnum.ALL_IN_SERIES
                ? {
                    paidSoFar: (installmentSeriesContext?.paidSoFarCents ?? 0) / 100,
                    committedMonthsCount:
                      installmentSeriesContext?.committedMonthsCount ?? 0,
                    parentDate: getLocalIsoDateKey(
                      (initialData as { seriesParentDate?: string | null })
                        .seriesParentDate
                      ?? initialData.date,
                    ),
                    effectiveDate: getLocalIsoDateKey(initialData.date),
                    calculatedDates:
                      installmentSeriesContext?.calculatedDates ?? [],
                    priorPerPaymentCents:
                      installmentSeriesContext?.defaultPerPaymentCents
                      ?? Math.round(perPaymentAmount * 100),
                    occurrenceCentsByDate:
                      installmentSeriesContext?.occurrenceCentsByDate,
                  }
                : {}
            ),
            exchangeRate: Number(
              (rawConv as { exchange_rate?: unknown; exchangeRate?: unknown } | undefined)
                ?.exchangeRate
              ?? (rawConv as { exchange_rate?: unknown; exchangeRate?: unknown } | undefined)
                ?.exchange_rate
              ?? storedTransactionConversion?.exchangeRate
              ?? 0,
            ),
            ledgerCurrency: effectiveSpaceCurrency,
            displayCurrency,
          })
        : null;
      const formAmount = installmentAmounts
        ? String(installmentAmounts.total)
        : initialAmount;

      setFormState({
        amount: formAmount,
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
        installmentTermUnit: "months",
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

      if (formAmount) {
        amountInput.setDisplayValue(numberFormatting.formatForInput(formAmount));
      } else {
        amountInput.setDisplayValue("");
      }

      if (installmentAmounts) {
        installmentBaselineRef.current = {
          planTotal: storedPlanTotal > 0
            ? storedPlanTotal
            : installmentAmounts.total,
          paymentAmount:
            perPaymentAmount || installmentAmounts.monthly,
        };
        installmentAmountAnchorRef.current = "total";
        setInstallmentMonthlyAmount(String(installmentAmounts.monthly));
        monthlyAmountInput.setDisplayValue(
          numberFormatting.formatForInput(String(installmentAmounts.monthly)),
        );
        setInstallmentThisPaymentAmount(String(installmentAmounts.monthly));
        thisPaymentAmountInput.setDisplayValue(
          numberFormatting.formatForInput(String(installmentAmounts.monthly)),
        );
      } else {
        installmentBaselineRef.current = {
          planTotal: 0,
          paymentAmount: 0,
        };
        setInstallmentMonthlyAmount("");
        monthlyAmountInput.setDisplayValue("");
      }

      if (useConversion) {
        const editAccount = accountOptions.find(
          (a) => a.value === initialData.accountName,
        );
        setAmountCurrency(displayCurrency);
        const stored = storedConversionForEditForm({
          data: initialData as unknown as Record<string, unknown>,
          targetCurrency:
            editAccount?.currency
            ?? effectiveSpaceCurrency,
        })
          ?? conversionSnapshotFromTransactionData(
            initialData as unknown as Record<string, unknown>,
          );
        if (stored) {
          setConversionSnapshot({
            ...stored,
            targetCurrency:
              stored.targetCurrency
              ?? editAccount?.currency
              ?? effectiveSpaceCurrency,
          });
        } else if (rawConv != null) {
          setConversionSnapshot({
            originalCurrency: displayCurrency,
            targetCurrency: String(
              (rawConv as any)?.converted_currency ??
                (rawConv as any)?.convertedCurrency ??
                editAccount?.currency ??
                effectiveSpaceCurrency,
            ),
            exchangeRate: Number(
              (rawConv as any)?.converted_amount
                ?? (rawConv as any)?.convertedAmount
                ?? 0,
            ) / Math.max(Number(originalAmount) || 1, 1),
            exchangeRateSource: ((rawConv as any)?.source ?? "manual") as
              | "auto"
              | "manual"
              | "recent",
          });
        }
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
        installmentTermUnit: "months",
        file: null,
      });
      setEntityName("");
      amountInput.reset();
      monthlyAmountInput.reset();
      setInstallmentMonthlyAmount("");
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

      if (value === ScheduleTypeEnum.INSTALLMENT) {
        installmentAmountAnchorRef.current = "total";
        const total = Number.parseFloat(formState.amount) || 0;
        const monthly = Number.parseFloat(installmentMonthlyAmount) || 0;

        if (total > 0 || monthly > 0) {
          syncInstallmentFieldsRef.current(
            total > 0 ? "total" : "monthly",
            total,
            monthly,
          );
        }
      } else {
        setInstallmentMonthlyAmount("");
        monthlyAmountInput.setDisplayValue("");
      }
    }

    if (
      field === "installmentPeriod"
      && scheduleType === ScheduleTypeEnum.INSTALLMENT
    ) {
      const periodMonths = loanTermToMonths(
        String(value),
        formState.installmentTermUnit ?? "months",
      );
      const total = Number.parseFloat(formState.amount) || 0;
      const monthly = Number.parseFloat(installmentMonthlyAmount) || 0;

      if (periodMonths > 0 && (total > 0 || monthly > 0)) {
        const synced =
          canUseInstallmentRevisionSync
            ? syncInstallmentRevisionAmounts({
                anchor: installmentAmountAnchorRef.current,
                total,
                monthly,
                parentDate: installmentRevisionDates!.parentDate,
                effectiveDate: installmentRevisionDates!.effectiveDate,
                periodMonths,
                paidSoFarCents: installmentSeriesContext?.paidSoFarCents ?? 0,
                calculatedDates: installmentSeriesContext?.calculatedDates ?? [],
                priorPerPaymentCents:
                  installmentPriorPerPaymentCents
                  || Math.round(monthly * 100),
                occurrenceCentsByDate: installmentOccurrenceCentsByDate,
                ...installmentRevisionFxParams,
              })
            : syncInstallmentAmounts({
                anchor: installmentAmountAnchorRef.current,
                total,
                monthly,
                periodMonths,
                paidSoFar: effectiveInstallmentPaidSoFar,
                committedMonthsCount: effectiveInstallmentCommittedMonthsCount,
              });

        setInstallmentMonthlyAmount(
          synced.monthly > 0 ? String(synced.monthly) : "",
        );
        setFormState((prev) => ({
          ...prev,
          installmentPeriod: value,
          amount: synced.total > 0 ? String(synced.total) : "",
        }));
        amountInput.setDisplayValue(
          synced.total > 0
            ? numberFormatting.formatForInput(String(synced.total))
            : "",
        );
        monthlyAmountInput.setDisplayValue(
          synced.monthly > 0
            ? numberFormatting.formatForInput(String(synced.monthly))
            : "",
        );

        if (formSubmitted) {
          validateForm();
        }
        return;
      }
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
        initialFile: initialData?.file ?? null,
      });

      const installmentPeriodForSubmit =
        formState.scheduleType === ScheduleTypeEnum.INSTALLMENT
          ? loanTermToMonths(
              formState.installmentPeriod ?? "",
              formState.installmentTermUnit ?? "months",
            )
          : 0;

      const transactionData = {
        amount: resolveInstallmentSubmitAmount({
          isEditMode,
          totalAmount: numberFormatting.cleanForBackend(formState.amount),
          monthlyAmount: numberFormatting.cleanForBackend(installmentMonthlyAmount),
          periodMonths: installmentPeriodForSubmit,
          singlePaymentMode: isInstallmentSinglePaymentEdit,
          thisPaymentAmount: numberFormatting.cleanForBackend(
            installmentThisPaymentAmount,
          ),
        }),
        description: formState.description?.trim() ?? "",
        transactionType: "expense" as const,
        ...categoryFields,
        accountName: formState.accountName,
        date: format(date, "yyyy-MM-dd"),
        scheduleType: formState.scheduleType,
        ...(formState.scheduleType === ScheduleTypeEnum.REPEAT && {
          repeatInterval: formState.repeatInterval
        }),
        ...(formState.scheduleType === ScheduleTypeEnum.INSTALLMENT && {
          installmentPeriod:
            loanTermToMonths(
              formState.installmentPeriod ?? "",
              formState.installmentTermUnit ?? "months",
            )
            || (isEditMode ? initialData?.installmentPeriod : undefined)
            || undefined,
          ...(isInstallmentSinglePaymentEdit
            ? {
                installmentTotal:
                  Number.parseFloat(formState.amount) > 0
                    ? Number.parseFloat(formState.amount)
                    : undefined,
              }
            : {}),
          ...(isInstallmentPlanEdit
            ? {
                installmentTotal:
                  Number.parseFloat(formState.amount) > 0
                    ? Number.parseFloat(formState.amount)
                    : undefined,
              }
            : {}),
        }),
        ...(showInstallmentScopeSelector && isEditMode
          ? {
              updateScope: installmentUpdateScope,
            }
          : {}),
        ...(fileId && { fileId }),
        ...fileFields,
        ...(draftId && { draftId }),
        ...(liveConversion && {
          original_currency: liveConversion.originalCurrency,
          exchange_rate: liveConversion.exchangeRate,
          exchange_rate_source: liveConversion.exchangeRateSource,
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
            entryCurrency: amountCurrency,
            spaceCurrency: effectiveSpaceCurrency,
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
          installmentTermUnit: "months",
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
      installmentTermUnit: "months",
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
        installmentTermUnit: "months",
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
  const attachmentBaseline = useAttachmentDirtyBaseline(
    initialData?.id,
    initialData?.file,
  );
  const initialInstallmentAmounts = useMemo(() => {
    if (initialData?.scheduleType !== ScheduleTypeEnum.INSTALLMENT) {
      return null;
    }

    const perPaymentAmount = positiveTransactionFormAmount(
      (initialData as { originalDisplayAmount?: unknown }).originalDisplayAmount
      ?? (initialData as { original_display_amount?: unknown }).original_display_amount
      ?? initialData.currencyConversion?.originalAmount
      ?? initialData.amount,
    );

    return resolveInstallmentFormInitialAmounts({
      installmentTotal: resolveInstallmentStoredPlanTotal({
        installmentTotal: initialData.installmentTotal,
        perPaymentAmount,
        periodMonths: initialData.installmentPeriod || 0,
        convertedPerPaymentAmount: Number(
          initialData.currencyConversion?.convertedAmount,
        ),
        exchangeRate: Number(
          initialData.currencyConversion?.exchangeRate
          ?? storedTransactionConversion?.exchangeRate
          ?? 0,
        ),
      }),
      perPaymentAmount,
      periodMonths: initialData.installmentPeriod || 0,
      useStoredTotal: true,
    });
  }, [initialData, storedTransactionConversion]);
  const hasUnsavedEdit = isEditSnapshotDirty(
    isEditMode && Boolean(initialData),
    {
      date: dateDirtySignature(date),
      amount: amountDirtySignature(
        isInstallmentSchedule
          ? formState.amount
          : amountInput.displayValue,
      ),
      amountCurrency,
      description: formState.description || "",
      categoryName: formState.categoryName || "",
      accountName: formState.accountName || "",
      scheduleType: formState.scheduleType,
      repeatInterval: formState.repeatInterval || "",
      installmentPeriod: formState.installmentPeriod || "",
      entityName,
      tagIds: tagIdsDirtySignature(selectedTagIds),
      file: fileDirtySignature(formState.file),
      conversion: conversionDirtySignature(conversionSnapshot),
      ...(showInstallmentScopeSelector
        ? { installmentUpdateScope }
        : {}),
    },
    {
      date: dateDirtySignature(
        initialData?.date ? new Date(initialData.date) : undefined,
      ),
      amount: amountDirtySignature(
        initialInstallmentAmounts?.total
        ?? (initialData as { originalDisplayAmount?: unknown } | undefined)
          ?.originalDisplayAmount
        ?? (initialData as { original_display_amount?: unknown } | undefined)
          ?.original_display_amount
        ?? initialData?.currencyConversion?.originalAmount
        ?? initialData?.amount,
      ),
      amountCurrency:
        String(
          (initialData as { originalDisplayCurrency?: string } | undefined)
            ?.originalDisplayCurrency
          ?? (initialData as { original_display_currency?: string } | undefined)
            ?.original_display_currency
          ?? initialData?.currencyConversion?.originalCurrency
          ?? (initialData as { amountCurrency?: string } | undefined)
            ?.amountCurrency
          ?? amountCurrency,
        ),
      description: initialData?.description || "",
      categoryName:
        categoryPickerValueFromReceiptOrTransaction(
          {
            categoryId: initialData?.categoryId,
            subcategoryId: initialData?.subcategoryId,
            categoryName: initialData?.categoryName,
          },
          categoryOptionsRaw,
        ) || initialData?.categoryName || "",
      accountName: initialData?.accountName || "",
      scheduleType: initialData?.scheduleType || ScheduleTypeEnum.ONE_TIME,
      repeatInterval: initialData?.repeatInterval || "",
      installmentPeriod: initialData?.installmentPeriod?.toString() || "",
      entityName: initialData?.entityName || "",
      tagIds: tagIdsDirtySignature(
        initialData?.tags?.map((tag) => tag.id) ?? initialData?.tagIds ?? [],
      ),
      file: attachmentBaseline,
      conversion: conversionDirtySignature(
        initialData?.currencyConversion
          ? {
              originalCurrency: initialData.currencyConversion.originalCurrency,
              targetCurrency: initialData.currencyConversion.convertedCurrency,
              exchangeRate: initialData.currencyConversion.exchangeRate,
              exchangeRateSource:
                (initialData.currencyConversion.source as ConversionSnapshot["exchangeRateSource"])
                || "manual",
            }
          : null,
      ),
      ...(showInstallmentScopeSelector
        ? { installmentUpdateScope: UpdateScopeEnum.THIS_ONLY }
        : {}),
    },
  );

  useLayoutEffect(() => {
    onDirtyChange?.(hasUnsavedEdit);
  }, [hasUnsavedEdit, onDirtyChange]);

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

        {showInstallmentScopeSelector && onInstallmentUpdateScopeChange ? (
          <InstallmentUpdateScopeSelector
            value={installmentUpdateScope}
            onChange={onInstallmentUpdateScopeChange}
          />
        ) : null}

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
            label={
              isInstallmentPlanEdit
              || isInstallmentSinglePaymentEdit
              || (isInstallmentSchedule && !isEditMode)
                ? "Total amount"
                : "Amount"
            }
            amountDisplayValue={
              isInstallmentSinglePaymentEdit && formState.amount
                ? numberFormatting.formatForInput(formState.amount)
                : amountInput.displayValue
            }
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
            suppressAutoFetch={suppressEditRateAutoFetch}
            onConversionChange={handleAmountConversionChange}
            date={date ? format(date, "yyyy-MM-dd") : undefined}
            initialConversion={amountPickerInitialConversion}
          />
          {isInstallmentSinglePaymentEdit ? (
            <div className="mt-3">
              <AmountWithRatePicker
                id="installment-this-payment"
                label="This payment only"
                amountDisplayValue={thisPaymentAmountInput.displayValue}
                onAmountChange={(value) =>
                  thisPaymentAmountInput.handleInputChange(value)
                }
                fromCurrency={amountCurrency}
                onFromCurrencyChange={setAmountCurrency}
                toCurrency={amountPickerTargetCurrency}
                amountCurrencyOptions={amountCurrencyOptions}
                accountOptions={accountOptions}
                placeholder="0.00"
                lockFromCurrency
                hideRatePicker
                previewOnly
                suppressAutoFetch={suppressEditRateAutoFetch}
                onConversionChange={() => undefined}
                date={date ? format(date, "yyyy-MM-dd") : undefined}
                initialConversion={amountPickerInitialConversion}
              />
            </div>
          ) : null}
          {isInstallmentPlanEdit || (isInstallmentSchedule && !isEditMode) ? (
            <div className="mt-3 space-y-3">
              {installmentEditMode === "plan_with_committed"
              && effectiveInstallmentRemainingMonths > 0
              && effectiveInstallmentRemainingMonths < installmentPeriodMonths ? (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {effectiveInstallmentCommittedMonthsCount > 0 ? (
                    <p className="font-medium text-foreground">
                      Already committed: {effectiveInstallmentCommittedMonthsCount}{" "}
                      payment{effectiveInstallmentCommittedMonthsCount === 1 ? "" : "s"} ·{" "}
                      {formatCurrency(effectiveInstallmentPaidSoFar, amountCurrency)}
                    </p>
                  ) : (
                    <p className="font-medium text-foreground">
                      This change applies to{" "}
                      {installmentRemainingPaymentsLabel(effectiveInstallmentRemainingMonths)}.
                    </p>
                  )}
                  <p className="mt-1">
                    {effectiveInstallmentCommittedMonthsCount > 0
                      ? "Recorded payments stay as-is. "
                      : "Earlier payments stay at their current amounts. "}
                    Changing the plan total or monthly amount only affects{" "}
                    {installmentRemainingPaymentsLabel(effectiveInstallmentRemainingMonths)}.
                  </p>
                </div>
              ) : effectiveInstallmentCommittedMonthsCount > 0 ? (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    Already committed: {effectiveInstallmentCommittedMonthsCount}{" "}
                    payment{effectiveInstallmentCommittedMonthsCount === 1 ? "" : "s"} ·{" "}
                    {formatCurrency(effectiveInstallmentPaidSoFar, amountCurrency)}
                  </p>
                  <p className="mt-1">
                    Recorded payments stay as-is. Changing the plan total or
                    monthly amount only affects the remaining payments.
                  </p>
                </div>
              ) : null}
              <FormControlField
                label={
                  installmentEditMode === "plan_with_committed"
                  && effectiveInstallmentRemainingMonths > 0
                  && effectiveInstallmentRemainingMonths < installmentPeriodMonths
                    ? `Monthly amount for ${installmentRemainingPaymentsLabel(effectiveInstallmentRemainingMonths)}`
                    : "Monthly amount"
                }
                htmlFor="installment-monthly-amount"
              >
                <Input
                  id="installment-monthly-amount"
                  name="installmentMonthlyAmount"
                  value={monthlyAmountInput.displayValue}
                  onChange={(event) =>
                    monthlyAmountInput.handleInputChange(event.target.value)
                  }
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="text-sm"
                />
              </FormControlField>
              <p className="text-xs text-muted-foreground">
                {amountCurrency} per payment
                {installmentPeriodMonths > 0
                  ? installmentEditMode === "plan_with_committed"
                    && effectiveInstallmentRemainingMonths > 0
                    && effectiveInstallmentRemainingMonths < installmentPeriodMonths
                    ? ` · ${installmentRemainingPaymentsLabel(effectiveInstallmentRemainingMonths)} of ${installmentPeriodMonths}`
                    : effectiveInstallmentCommittedMonthsCount > 0
                      ? ` · ${effectiveInstallmentRemainingMonths} remaining of ${installmentPeriodMonths}`
                      : ` · ${installmentPeriodMonths} payments`
                  : ""}
              </p>
              {(() => {
                const monthly = Number.parseFloat(installmentMonthlyAmount);
                const rate = conversionSnapshot?.exchangeRate;
                const target =
                  conversionSnapshot?.targetCurrency
                  || amountPickerTargetCurrency
                  || spaceCurrency;
                if (
                  !Number.isFinite(monthly)
                  || monthly <= 0
                  || !rate
                  || !target
                  || target === amountCurrency
                ) {
                  return null;
                }

                return (
                  <p
                    data-testid="installment-monthly-fx"
                    className="text-xs text-muted-foreground"
                  >
                    → {target}{" "}
                    {formatWithDelimiters(monthly * rate, {
                      minFractionDigits: 3,
                      maxFractionDigits: 3,
                    })}
                  </p>
                );
              })()}
            </div>
          ) : null}
          </div>
        </div>

        <TransactionDescriptionField
          id="description"
          value={formState.description || ""}
          onChange={(value) => handleFieldChange("description", value)}
          categoryName={formState.categoryName}
          transactionType="expense"
        />

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

        {showInstallmentScopeSelector ? (
          isInstallmentPlanEdit && scheduleType === ScheduleTypeEnum.INSTALLMENT ? (
            <div className="space-y-2">
              <Label htmlFor="installmentPeriod" className="text-sm">
                Installment Term
              </Label>
              <div className="relative">
                <Input
                  id="installmentPeriod"
                  name="installmentPeriod"
                  value={formState.installmentPeriod || ""}
                  onChange={(e) =>
                    handleFieldChange("installmentPeriod", e.target.value)
                  }
                  type="number"
                  inputMode="decimal"
                  min={
                    (formState.installmentTermUnit ?? "months") === "months"
                      ? "1"
                      : "0.1"
                  }
                  step={
                    (formState.installmentTermUnit ?? "months") === "months"
                      ? "1"
                      : "0.1"
                  }
                  placeholder="0"
                  className={`pr-20 text-sm ${formSubmitted && formErrors.installmentPeriod ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                  onClick={() =>
                    handleFieldChange(
                      "installmentTermUnit",
                      (formState.installmentTermUnit ?? "months") === "months"
                        ? "years"
                        : "months",
                    )
                  }
                >
                  {formatLoanTermUnitLabel(formState.installmentTermUnit ?? "months")}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              {formSubmitted && formErrors.installmentPeriod?.map((error) => (
                <FormError key={error}>{error}</FormError>
              ))}
            </div>
          ) : null
        ) : (
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
              <Label htmlFor="installmentPeriod" className="text-sm">
                Installment Term
              </Label>
              <div className="relative">
                <Input
                  id="installmentPeriod"
                  name="installmentPeriod"
                  value={formState.installmentPeriod || ""}
                  onChange={(e) =>
                    handleFieldChange("installmentPeriod", e.target.value)
                  }
                  type="number"
                  inputMode="decimal"
                  min={
                    (formState.installmentTermUnit ?? "months") === "months"
                      ? "1"
                      : "0.1"
                  }
                  step={
                    (formState.installmentTermUnit ?? "months") === "months"
                      ? "1"
                      : "0.1"
                  }
                  placeholder="0"
                  className={`pr-20 text-sm ${formSubmitted && formErrors.installmentPeriod ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                />
                <button
                  type="button"
                  onClick={toggleInstallmentTermUnit}
                  className="absolute inset-y-0 right-0 flex cursor-pointer items-center gap-0.5 pr-3 text-sm text-muted-foreground hover:text-foreground"
                  aria-label={`Switch installment term unit to ${(formState.installmentTermUnit ?? "months") === "months" ? "years" : "months"}`}
                >
                  {formatLoanTermUnitLabel(
                    formState.installmentTermUnit ?? "months",
                    formState.installmentPeriod ?? "",
                  )}
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </button>
              </div>
              {formSubmitted && formErrors.installmentPeriod?.map((error) => (
                <FormError key={error}>{error}</FormError>
              ))}
            </div>
          )}
        </TransactionScheduleFields>
        )}

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
            disabled={
              isSubmitting
              || Boolean(editingLockedReason)
              || (isEditMode && !hasUnsavedEdit)
            }
            title={
              editingLockedReason
              ?? (isEditMode && !hasUnsavedEdit ? "No changes to save" : undefined)
            }
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
