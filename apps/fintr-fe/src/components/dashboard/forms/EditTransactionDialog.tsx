import React, { useState, useEffect, useRef, useMemo, useId, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatedSheetShell } from "@/components/ui/animated-sheet-shell";
import { CustomModal } from "@/components/ui/custom-modal";
import ExpenseForm from "./ExpenseForm";
import IncomeForm from "./IncomeForm";
import TransferForm from "./TransferForm";
import ScopeModal, { UpdateScope, Scope, DeleteScope } from "./ScopeModal";
import {
  type InstallmentRevisionSeriesContext,
  computeInstallmentRevisionSeriesContext,
  resolveInstallmentRevisionDisplayCurrency,
  resolveInstallmentCommittedRowAmount,
  withInstallmentPlanRevisionSubmit,
} from "@/utils/installmentPlanRevision";
import { IndexTransaction, CombinedTransactionTypeEnum, TransferUpdateTransactionType, UpdateTransactionType, CurrencyConversionType } from "@/types/transactionTypes";
import { UpdateTransferType } from "@/services/transactions/transfers/mutation";
import { buildTransferInitialData } from "./transfer-form-initial-data";
import { updateTransferLocalFirst } from "@/services/transactions/transfers/update-local-first";
import { deleteTransaction } from "@/services/transactions/mutation";
import { updateTransactionLocalFirst } from "@/services/transactions/update-local-first";
import { deleteTransactionLocalFirst } from "@/services/transactions/delete-local-first";
import { collectDeleteScopeContextRows } from "@/services/transactions/local-cache";
import {
  transactionAllowsSeriesDeleteScope,
} from "@/services/transactions/resolve-delete-scope";
import {
  enrichTransactionEditDetail,
  seedTransactionEditFromListRow,
  storedFxFingerprint,
} from "@/services/transactions/detail-local";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { usePreferLocalTransactionReads } from "@/hooks/useOfflineReadMode";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ScheduleTypeEnum, UpdateScopeEnum, DeleteScopeEnum } from "@/constants/transactionConstants";
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createDisplayFileFromAttachment } from "@/utils/fileUtils";
import { extractRemoteFiles } from "@/services/attachments/remote-files";
import { cn, formatWithDelimiters } from "@/lib/utils";
import { ArrowLeftRight, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TransactionEditorPresence,
  useTransactionEditingPresence,
} from "@/hooks/useTransactionEditingPresence";
import DiscardUnsavedChangesDialog from "./DiscardUnsavedChangesDialog";
import { buildTransactionSheetTitle } from "@/utils/transactionSheetTitle";

/** Keep form data visible through sheet/modal close animations (~200ms). */
const EDIT_DIALOG_CLOSE_RESET_DELAY_MS = 225;

const getEditorInitials = (name?: string | null): string | null => {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    return null;
  }

  const parts = trimmedName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const EditorPresenceAvatar = ({
  editor,
}: {
  editor: TransactionEditorPresence;
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = getEditorInitials(editor.fullName);
  const showImage = Boolean(editor.photoUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [editor.photoUrl]);

  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-amber-500/20 text-xs font-semibold text-amber-950 dark:text-amber-100",
        "ring-1 ring-amber-500/30",
      )}
      aria-hidden
    >
      {showImage ? (
        <img
          src={editor.photoUrl ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : initials ? (
        <span>{initials}</span>
      ) : (
        <User className="h-4 w-4" />
      )}
    </div>
  );
};

interface FileAttachment {
  id: string;
  filename: string;
  contentType: string;
  url: string;
  createdAt: string;
}

/** Normalize conversion from API (may return snake_case). */
function getConversion(data: UpdateTransactionType | TransferUpdateTransactionType | null): CurrencyConversionType | null {
  if (!data) return null;
  const raw = (data as any).currency_conversion ?? data.currencyConversion;
  if (!raw) return null;
  return {
    id: raw.id,
    originalAmount: raw.original_amount ?? raw.originalAmount,
    originalCurrency: raw.original_currency ?? raw.originalCurrency,
    convertedAmount: raw.converted_amount ?? raw.convertedAmount,
    convertedCurrency: raw.converted_currency ?? raw.convertedCurrency,
    exchangeRate: raw.exchange_rate ?? raw.exchangeRate,
    source: raw.source ?? "",
    rateTimestamp: raw.rate_timestamp ?? raw.rateTimestamp,
    note: raw.note ?? raw.note,
  };
}

function hasConversion(data: UpdateTransactionType | TransferUpdateTransactionType | null): boolean {
  if (!data) return false;
  return Boolean((data as any).has_currency_conversion ?? data.hasCurrencyConversion);
}

function ConversionInfoPopover({ conv }: { conv: CurrencyConversionType }) {
  return (
    <div className="space-y-3">
      <p className="font-medium text-sm">Currency conversion</p>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Original</dt>
          <dd>
            {formatWithDelimiters(Number(conv.originalAmount), {
              minFractionDigits: 2,
              maxFractionDigits: 3,
            })}{" "}
            {conv.originalCurrency}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Exchange rate</dt>
          <dd>{formatWithDelimiters(Number(conv.exchangeRate), { minFractionDigits: 4, maxFractionDigits: 6 })}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Converted to</dt>
          <dd>
            {formatWithDelimiters(Number(conv.convertedAmount), {
              minFractionDigits: 2,
              maxFractionDigits: 2,
            })}{" "}
            {conv.convertedCurrency}
          </dd>
        </div>
        {conv.source && (
          <div>
            <dt className="text-muted-foreground">Source</dt>
            <dd>{conv.source}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export type EditTransactionSuccessOptions = {
  /** Transfer (+ fee) lists are patched locally; skip refetch races. */
  skipTransactionsInvalidate?: boolean;
  /** Set when the dialog completed a delete (not an update). */
  deleted?: boolean;
  deleteScope?: DeleteScopeEnum;
};

interface EditTransactionDialogProps {
  transaction: IndexTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (options?: EditTransactionSuccessOptions) => void;
}

const EditTransactionDialog: React.FC<EditTransactionDialogProps> = ({
  transaction,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const titleId = useId();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [activeTransaction, setActiveTransaction] = useState<IndexTransaction | null>(null);
  const [fullTransactionData, setFullTransactionData] = useState<UpdateTransactionType | TransferUpdateTransactionType | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const queryClient = useQueryClient();
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const preferLocal = usePreferLocalTransactionReads(spaceCode);
  const spaceCurrency = currentSpace?.currency ?? "PHP";
  const defaultTransactionCurrency = currentSpace?.defaultTransactionCurrency ?? null;
  const presenceSpaceId = currentSpace?.id || spaceCode;
  const {
    isLockedByOther,
    lockMessage,
    lockingEditor,
  } = useTransactionEditingPresence({
    spaceId: presenceSpaceId,
    transactionId: activeTransaction?.id,
    enabled: isOpen && Boolean(activeTransaction?.id),
  });
  const editingLockedReason = isLockedByOther ? lockMessage : null;
  const [isLoading, setIsLoading] = useState(false);
  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  
  // Update scope modal state
  const [showUpdateScopeModal, setShowUpdateScopeModal] = useState(false);
  const [updateScope, setUpdateScope] = useState<UpdateScope>(UpdateScopeEnum.THIS_ONLY);
  const [scheduleTypeChange, setScheduleTypeChange] = useState<{from: string; to: string} | null>(null);
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  const [hasScheduleChanges, setHasScheduleChanges] = useState(false);
  const [installmentRevisionSeriesContext, setInstallmentRevisionSeriesContext] =
    useState<InstallmentRevisionSeriesContext | null>(null);
  const [installmentUpdateScope, setInstallmentUpdateScope] = useState<UpdateScope>(
    UpdateScopeEnum.THIS_ONLY,
  );
  const [dataKey, setDataKey] = useState<number>(0); // Add a key to force re-render
  
  // Delete scope modal state
  const [showDeleteScopeModal, setShowDeleteScopeModal] = useState(false);
  const [deleteScope, setDeleteScope] = useState<DeleteScope>(DeleteScopeEnum.THIS_ONLY);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formIsDirty, setFormIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const scopeModalResolverRef = useRef<(() => void) | null>(null);

  // View conversion popover: close when clicking outside or elsewhere
  const [conversionPopoverOpen, setConversionPopoverOpen] = useState(false);
  const conversionPopoverTriggerRef = useRef<HTMLDivElement>(null);
  const conversionPopoverContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) setConversionPopoverOpen(false);
  }, [isOpen]);

  // Close conversion popover when clicking anywhere outside it (modal, form, backdrop, etc.)
  useEffect(() => {
    if (!conversionPopoverOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (conversionPopoverTriggerRef.current?.contains(target)) return;
      if (conversionPopoverContentRef.current?.contains(target)) return;
      setConversionPopoverOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [conversionPopoverOpen]);

  useEffect(() => {
    if (isOpen && transaction?.id) {
      setActiveTransaction(transaction);
    }
  }, [isOpen, transaction]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActiveTransaction(null);
      setFullTransactionData(null);
      setDate(new Date());
      setShowUpdateScopeModal(false);
      setScheduleTypeChange(null);
      setPendingFormData(null);
      setHasScheduleChanges(false);
      setFileAttachments([]);
      setDataKey(0);
      setShowDeleteScopeModal(false);
      setDeleteScope(DeleteScopeEnum.THIS_ONLY);
      setIsUpdating(false);
      setIsDeleting(false);
      setIsLoading(false);
      setFormIsDirty(false);
      setShowDiscardConfirm(false);
      setInstallmentUpdateScope(UpdateScopeEnum.THIS_ONLY);
      resolveScopeModal();
    }, EDIT_DIALOG_CLOSE_RESET_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !activeTransaction?.id) {
      return;
    }

    if (!preferLocal && !api) return;

    // Prevent editing of loan payment transactions
    if (activeTransaction.hasLoanPayment) {
      toast.error("This transaction is linked to a loan payment and cannot be edited. Edit the loan payment instead.");
      onClose();
      return;
    }

    let cancelled = false;

    const seed = seedTransactionEditFromListRow(activeTransaction);
    const seedPeriod =
      (seed.data as UpdateTransactionType).installmentPeriod ?? 0;
    const waitForFreshDetail = Boolean(api);

    if (seed.data.scheduleType === ScheduleTypeEnum.INSTALLMENT) {
      setInstallmentUpdateScope(UpdateScopeEnum.THIS_ONLY);
    }
    if (seed.date) {
      setDate(seed.date);
    }

    // Online: never mount the form from the list-row seed alone. IndexedDB rows
    // often omit currency_conversion; mounting early lets the rate picker
    // auto-fetch today's market rate before the API detail arrives.
    setIsLoading(waitForFreshDetail);

    if (!waitForFreshDetail) {
      setFullTransactionData(seed.data);
      setDataKey((prev) => prev + 1);
      setIsLoading(false);
    }

    void (async () => {
      try {
        const enriched = await enrichTransactionEditDetail({
          api,
          spaceId: spaceCode,
          transaction: activeTransaction,
          preferLocal,
        });
        if (cancelled) return;

        let processedData = {
          ...enriched.data,
        } as UpdateTransactionType | TransferUpdateTransactionType;

        const detailFiles = extractRemoteFiles(processedData);
        if (
          detailFiles.length > 0 &&
          !processedData.file
        ) {
          setFileAttachments(
            detailFiles.map((file) => ({
              id: file.id ?? "",
              filename: file.filename ?? "attachment",
              contentType: file.contentType ?? "",
              url: file.url ?? "",
              createdAt: "",
            })),
          );

          const fileAttachment = detailFiles[0];
          if (fileAttachment?.url) {
            processedData.file = createDisplayFileFromAttachment({
              id: fileAttachment.id ?? "",
              url: fileAttachment.url,
              filename: fileAttachment.filename ?? "attachment",
              contentType: fileAttachment.contentType || "image/jpeg",
            });
          }
        }

        setFullTransactionData(processedData);
        const enrichedPeriod =
          (processedData as UpdateTransactionType).installmentPeriod ?? 0;
        const seedFx = storedFxFingerprint(seed.data);
        const enrichedFx = storedFxFingerprint(processedData);
        const shouldRemountForStoredFx =
          enrichedFx != null && enrichedFx !== seedFx;
        if (
          waitForFreshDetail
          || (seedPeriod <= 0 && enrichedPeriod > 0)
          || shouldRemountForStoredFx
        ) {
          setDataKey((prev) => prev + 1);
        }
        if (enriched.date) {
          setDate(enriched.date);
        }
        setIsLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        if (waitForFreshDetail) {
          setFullTransactionData(seed.data);
          setDataKey((prev) => prev + 1);
          setIsLoading(false);
        }
        toast.error(
          preferLocal
            ? "Could not load full details from local DB."
            : "Could not refresh transaction details.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTransaction?.id, isOpen, api, preferLocal, spaceCode]);

  useEffect(() => {
    if (!isOpen || !activeTransaction?.id || !spaceCode) {
      setInstallmentRevisionSeriesContext(null);
      return;
    }

    if (fullTransactionData?.scheduleType !== ScheduleTypeEnum.INSTALLMENT) {
      setInstallmentRevisionSeriesContext(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const { target, contextRows } = await collectDeleteScopeContextRows({
        spaceId: spaceCode,
        queryClient,
        listRows: activeTransaction ? [activeTransaction] : [],
        targetId: activeTransaction.id,
      });

      if (cancelled || !target) {
        return;
      }

      const displayCurrency = resolveInstallmentRevisionDisplayCurrency(
        {
          amountCurrency:
            fullTransactionData?.amountCurrency
            ?? activeTransaction.amountCurrency,
          currencyConversion:
            fullTransactionData?.currencyConversion
            ?? activeTransaction.currencyConversion,
          originalDisplayCurrency:
            (fullTransactionData as { originalDisplayCurrency?: string })
              ?.originalDisplayCurrency
            ?? (fullTransactionData as { original_display_currency?: string })
              ?.original_display_currency,
        },
        spaceCurrency,
      );
      const fallbackPerPayment = resolveInstallmentCommittedRowAmount(
        target,
        displayCurrency,
      );

      setInstallmentRevisionSeriesContext(
        computeInstallmentRevisionSeriesContext(target, contextRows, {
          displayCurrency,
          fallbackPerPayment,
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    activeTransaction,
    spaceCode,
    queryClient,
    fullTransactionData?.scheduleType,
    fullTransactionData?.amountCurrency,
    fullTransactionData?.currencyConversion,
    spaceCurrency,
  ]);

  const validateScheduleTypeChange = (originalScheduleType: ScheduleTypeEnum, newScheduleType: ScheduleTypeEnum) => {
    // Rule 2: Cannot change from one_time or repeat to installment
    if ((originalScheduleType === ScheduleTypeEnum.ONE_TIME || originalScheduleType === ScheduleTypeEnum.REPEAT) && 
        newScheduleType === ScheduleTypeEnum.INSTALLMENT) {
      toast.error("Cannot change transaction to installment type. Please delete this transaction and create a new installment transaction instead.");
      return false;
    }

    // Rule 3: Cannot change from installment to anything else
    if (originalScheduleType === ScheduleTypeEnum.INSTALLMENT && newScheduleType !== ScheduleTypeEnum.INSTALLMENT) {
      toast.error("Cannot change installment transaction type. Please delete this transaction and create a new transaction instead.");
      return false;
    }

    return true;
  };

  const detectScheduleChanges = (originalData: UpdateTransactionType, newData: any) => {
    // Check if schedule-related fields have changed
    const scheduleFieldsChanged = 
      originalData.scheduleType !== newData.scheduleType ||
      originalData.repeatInterval !== newData.repeatInterval ||
      (
        (originalData.installmentPeriod !== newData.installmentPeriod) && 
        (![null, undefined].includes(newData.installmentPeriod))
      );
    return scheduleFieldsChanged;
  };

  const resolveScopeModal = () => {
    scopeModalResolverRef.current?.();
    scopeModalResolverRef.current = null;
  };

  const waitForScopeModal = (): Promise<void> => {
    return new Promise<void>((resolve) => {
      scopeModalResolverRef.current = resolve;
    });
  };

  const openUpdateScopeModal = (formData: any, scheduleChange: { from: string; to: string }) => {
    setScheduleTypeChange(scheduleChange);
    setUpdateScope(UpdateScopeEnum.THIS_ONLY);
    setPendingFormData(formData);
    setShowUpdateScopeModal(true);
  };

  const handleFormSubmit = async (formData: any): Promise<void> => {
    if (!fullTransactionData) return;

    const originalScheduleType = fullTransactionData.scheduleType;
    const newScheduleType = formData.scheduleType;

    // Validate schedule type changes
    if (!validateScheduleTypeChange(originalScheduleType, newScheduleType)) {
      return;
    }

    // Detect if schedule-related changes were made
    const hasScheduleFieldChanges = detectScheduleChanges(fullTransactionData, formData);
    setHasScheduleChanges(hasScheduleFieldChanges);

    // Check if schedule type changed
    if (originalScheduleType !== newScheduleType) {
      // Rule 1: one_time to repeat - automatically set this_and_future
      if (originalScheduleType === ScheduleTypeEnum.ONE_TIME && newScheduleType === ScheduleTypeEnum.REPEAT) {
        const finalFormData = { ...formData, updateScope: UpdateScopeEnum.THIS_AND_FUTURE };
        await handleSuccess(finalFormData);
        return;
      }

      // Rule 4: repeat to one_time - show modal with only this_and_future option
      if (originalScheduleType === ScheduleTypeEnum.REPEAT && newScheduleType === ScheduleTypeEnum.ONE_TIME) {
        setScheduleTypeChange({ from: "repeat", to: "one_time" });
        setUpdateScope(UpdateScopeEnum.THIS_AND_FUTURE); // Force this option
        setPendingFormData(formData);
        setShowUpdateScopeModal(true);
        await waitForScopeModal();
        return;
      }
    }

    // Check if this is a recurring transaction (repeat) - show modal for any changes
    if (originalScheduleType === ScheduleTypeEnum.REPEAT) {
      openUpdateScopeModal(formData, { from: "repeat", to: "repeat" });
      await waitForScopeModal();
      return;
    }

    // Installment edits choose scope up front in the form.
    if (originalScheduleType === ScheduleTypeEnum.INSTALLMENT) {
      const finalFormData = withInstallmentPlanRevisionSubmit(
        fullTransactionData,
        {
          ...formData,
          updateScope: formData.updateScope ?? installmentUpdateScope,
        },
        (formData.updateScope ?? installmentUpdateScope) as UpdateScope,
      );

      await handleSuccess(finalFormData);
      return;
    }

    // If no schedule type change or one_time transaction, proceed directly
    await handleSuccess(formData);
  };

  const handleUpdateScopeConfirm = async (scope: Scope) => {
    if (!pendingFormData || !fullTransactionData) {
      handleUpdateScopeCancel();
      return;
    }

    const finalFormData = withInstallmentPlanRevisionSubmit(
      fullTransactionData,
      { ...pendingFormData, updateScope: scope as UpdateScope },
      scope,
    );

    try {
      await handleSuccess(finalFormData);
    } finally {
      setShowUpdateScopeModal(false);
      setPendingFormData(null);
      setScheduleTypeChange(null);
      setHasScheduleChanges(false);
      resolveScopeModal();
    }
  };

  const handleUpdateScopeChange = (scope: Scope) => {
    setUpdateScope(scope as UpdateScope);
  };

  const handleUpdateScopeCancel = () => {
    setShowUpdateScopeModal(false);
    setPendingFormData(null);
    setScheduleTypeChange(null);
    setHasScheduleChanges(false);
    resolveScopeModal();
  };

  // Handle delete action
  const handleDelete = async () => {
    if (!activeTransaction) return;

    const { target } = await collectDeleteScopeContextRows({
      spaceId: spaceCode,
      queryClient,
      listRows: activeTransaction ? [activeTransaction] : [],
      targetId: activeTransaction.id,
    });

    if (target) {
      setActiveTransaction(target);
    }

    setShowDeleteScopeModal(true);
    setDeleteScope(DeleteScopeEnum.THIS_ONLY);
  };

  const handleDeleteConfirm = async (scope: Scope) => {
    if (!activeTransaction) return;

    setIsDeleting(true);
    try {
      if (
        activeTransaction.type === CombinedTransactionTypeEnum.TRANSFER ||
        activeTransaction.type === CombinedTransactionTypeEnum.INCOME ||
        activeTransaction.type === CombinedTransactionTypeEnum.EXPENSE ||
        activeTransaction.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT ||
        activeTransaction.type === CombinedTransactionTypeEnum.LOAN_PAYMENT
      ) {
        const isTransfer =
          activeTransaction.type === CombinedTransactionTypeEnum.TRANSFER;
        const isOptimisticLocalFirstDelete =
          isTransfer ||
          activeTransaction.type === CombinedTransactionTypeEnum.INCOME ||
          activeTransaction.type === CombinedTransactionTypeEnum.EXPENSE ||
          activeTransaction.type === CombinedTransactionTypeEnum.LOAN_PAYMENT ||
          activeTransaction.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT;
        const result = await deleteTransactionLocalFirst(
          api,
          {
            spaceId: spaceCode,
            transactionId: activeTransaction.id,
            deleteScope: scope as DeleteScopeEnum,
            listRow: activeTransaction,
          },
          isOptimisticLocalFirstDelete
            ? { queryClient, waitForSync: false }
            : { queryClient },
        );
        if (isOptimisticLocalFirstDelete) {
          toast.success(
            isTransfer
              ? "Transfer deleted successfully"
              : "Transaction deleted successfully",
          );
          setShowDeleteScopeModal(false);
          onClose();
          // Local-first already patched list + dashboard caches. Refresh
          // secondary queries immediately; do not wait for network sync.
          onSuccess({
            skipTransactionsInvalidate: true,
            deleted: true,
            deleteScope: scope as DeleteScopeEnum,
          });
          void Promise.resolve(result.syncPromise)
            .then((synced) => {
              if (synced.pendingSync) {
                toast.message(
                  isTransfer
                    ? "Transfer deleted on this device. Will sync when online."
                    : "Transaction deleted on this device. Will sync when online.",
                );
              }
            })
            .catch(() => undefined);
          return;
        }

        if (
          activeTransaction.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT ||
          activeTransaction.type === CombinedTransactionTypeEnum.LOAN_PAYMENT
        ) {
          toast.success(
            result.pendingSync
              ? "Loan activity deleted on this device. Will sync when online."
              : "Loan activity deleted successfully",
          );
          void queryClient.invalidateQueries({
            queryKey: ["loans"],
            refetchType: "active",
          });
        } else {
          toast.success(
            result.pendingSync
              ? "Transaction deleted on this device. Will sync when online."
              : "Transaction deleted successfully",
          );
        }
      } else {
        await deleteTransaction(api, {
          id: activeTransaction.id,
          deleteScope: scope as DeleteScope,
        });
        toast.success("Transaction deleted successfully");
      }

      onSuccess({
        deleted: true,
        deleteScope: scope as DeleteScopeEnum,
      });
      onClose();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast.error("Failed to delete transaction. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteScopeModal(false);
    }
  };

  const handleDeleteScopeChange = (scope: Scope) => {
    setDeleteScope(scope as DeleteScope);
  };

  const handleDeleteCancel = () => {
    setShowDeleteScopeModal(false);
  };

  // Handle file updates from child forms
  const handleFileUpdate = (_updatedFile: File | null) => {
    // Keep attachment changes in the child form only. Writing the file onto
    // fullTransactionData (the form's initialData) made Update look clean.
  };

  const handleSuccess = async (data: any) => {
    setIsUpdating(true);
    try {
      // File updates are explicit: uploadable `file` replaces, `removeFile` clears,
      // and omitting both leaves the existing attachment unchanged.
      const dataWithFile = { ...data };

      if (activeTransaction?.type === CombinedTransactionTypeEnum.TRANSFER) {
        const result = await updateTransferLocalFirst(
          api,
          {
            spaceId: spaceCode,
            data: dataWithFile as UpdateTransferType,
            previous: activeTransaction,
            amountCurrency:
              activeTransaction.amountCurrency
              ?? spaceCurrency,
          },
          {
            queryClient,
            waitForSync: false,
          },
        );
        toast.success("Transfer updated successfully");
        void result.syncPromise.then((synced) => {
          if (synced.pendingSync) {
            toast.message(
              "Update saved on this device. Will sync when online.",
            );
          }
        }).catch(() => {
          toast.error("Failed to sync transfer update.");
        });
        onSuccess({ skipTransactionsInvalidate: true });
      } else {
        if (!activeTransaction) {
          throw new Error("No transaction loaded for update");
        }
        const result = await updateTransactionLocalFirst(
          api,
          {
            spaceId: spaceCode,
            data: dataWithFile,
            previous: activeTransaction,
            amountCurrency:
              activeTransaction.amountCurrency
              ?? spaceCurrency,
          },
          {
            queryClient,
            waitForSync: false,
          },
        );
        toast.success("Transaction updated successfully");
        void result.syncPromise.then((synced) => {
          if (synced.pendingSync) {
            toast.message(
              "Update saved on this device. Will sync when online.",
            );
          }
        }).catch(() => {
          toast.error("Failed to sync transaction update.");
        });
        onSuccess({ skipTransactionsInvalidate: true });
      }

      onClose();
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast.error("Failed to update transaction. Please try again.");
      throw error;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setFormIsDirty(dirty);
  }, []);

  const requestClose = () => {
    if (formIsDirty) {
      setShowDiscardConfirm(true);
      return;
    }

    onClose();
  };

  const handleKeepEditing = () => {
    setShowDiscardConfirm(false);
  };

  const handleDiscardChanges = () => {
    setShowDiscardConfirm(false);
    setFormIsDirty(false);
    onClose();
  };

  const getDialogTitle = () => {
    const conversion = getConversion(fullTransactionData);
    const transferData = fullTransactionData as TransferUpdateTransactionType | null;

    return buildTransactionSheetTitle({
      type: activeTransaction?.type,
      categoryName:
        (fullTransactionData as UpdateTransactionType | null)?.categoryName
        ?? activeTransaction?.categoryName,
      description:
        fullTransactionData?.description
        ?? activeTransaction?.description,
      amount:
        conversion?.originalAmount
        ?? fullTransactionData?.amount
        ?? activeTransaction?.amount,
      currency:
        conversion?.originalCurrency
        ?? (fullTransactionData as UpdateTransactionType | null)?.amountCurrency
        ?? activeTransaction?.amountCurrency
        ?? spaceCurrency,
      fromAccountName:
        transferData?.fromAccountName
        ?? activeTransaction?.fromAccountName,
      toAccountName:
        transferData?.toAccountName
        ?? activeTransaction?.toAccountName,
    });
  };

  const transferInitialData = useMemo((): UpdateTransferType | null => {
    if (
      !fullTransactionData ||
      activeTransaction?.type !== CombinedTransactionTypeEnum.TRANSFER
    ) {
      return null;
    }

    return buildTransferInitialData(
      fullTransactionData,
      getConversion(fullTransactionData),
    );
  }, [
    fullTransactionData?.id,
    fullTransactionData?.amount,
    fullTransactionData?.description,
    fullTransactionData?.date,
    fullTransactionData?.scheduleType,
    fullTransactionData?.repeatInterval,
    fullTransactionData?.hasCurrencyConversion,
    (fullTransactionData as { transactionCost?: number })?.transactionCost,
    (fullTransactionData as { fromAccountName?: string })?.fromAccountName,
    (fullTransactionData as { toAccountName?: string })?.toAccountName,
    (fullTransactionData as { updateScope?: string })?.updateScope,
    (fullTransactionData as { currencyConversion?: unknown })?.currencyConversion,
    (fullTransactionData as { currency_conversion?: unknown })?.currency_conversion,
    activeTransaction?.type,
    dataKey,
  ]);

  const deleteInSeries = useMemo(
    () =>
      transactionAllowsSeriesDeleteScope(activeTransaction)
      || fullTransactionData?.scheduleType === ScheduleTypeEnum.REPEAT
      || fullTransactionData?.scheduleType === ScheduleTypeEnum.INSTALLMENT,
    [
      activeTransaction,
      fullTransactionData?.scheduleType,
    ],
  );

  const renderForm = () => {
    if (isLoading) {
      return (
        <div className="py-8 text-center">
          <LoadingSpinner size="large" />
        </div>
      );
    }

    if (!fullTransactionData || !activeTransaction) {
      return <div className="py-8 text-center">No transaction data available</div>;
    }

    // Use the key to force re-render when data changes
    switch (activeTransaction.type) {
      case CombinedTransactionTypeEnum.EXPENSE:
        return (
          <ExpenseForm
            key={`expense-form-${dataKey}`}
            id={activeTransaction.id}
            initialData={fullTransactionData}
            date={date}
            setDate={setDate}
            spaceCurrency={spaceCurrency}
            defaultTransactionCurrency={defaultTransactionCurrency}
            onSubmitSuccess={handleFormSubmit}
            onCancel={requestClose}
            onDirtyChange={handleDirtyChange}
            isEditMode={true}
            onFileUpdate={handleFileUpdate} // Pass the new handler
            onDelete={handleDelete} // Pass the delete handler
            editingLockedReason={editingLockedReason}
            installmentSeriesContext={installmentRevisionSeriesContext}
            showInstallmentScopeSelector={
              fullTransactionData.scheduleType === ScheduleTypeEnum.INSTALLMENT
            }
            installmentUpdateScope={installmentUpdateScope}
            onInstallmentUpdateScopeChange={setInstallmentUpdateScope}
          />
        );
      case CombinedTransactionTypeEnum.INCOME:
        return (
          <IncomeForm
            key={`income-form-${dataKey}`}
            id={activeTransaction.id}
            initialData={fullTransactionData}
            date={date}
            setDate={setDate}
            spaceCurrency={spaceCurrency}
            defaultTransactionCurrency={defaultTransactionCurrency}
            onSubmitSuccess={handleFormSubmit}
            onCancel={requestClose}
            onDirtyChange={handleDirtyChange}
            isEditMode={true}
            onFileUpdate={handleFileUpdate} // Pass the new handler
            onDelete={handleDelete} // Pass the delete handler
            editingLockedReason={editingLockedReason}
          />
        );
      case CombinedTransactionTypeEnum.TRANSFER:
        if (!transferInitialData) {
          return (
            <div className="py-8 text-center">No transaction data available</div>
          );
        }

        return (
          <TransferForm
            key={`transfer-form-${dataKey}`}
            id={activeTransaction.id}
            initialData={transferInitialData}
            date={date}
            setDate={setDate}
            spaceCurrency={spaceCurrency}
            onSubmitSuccess={handleFormSubmit}
            onCancel={requestClose}
            onDirtyChange={handleDirtyChange}
            isEditMode={true}
            onFileUpdate={handleFileUpdate} // Pass the new handler
            onDelete={handleDelete} // Pass the delete handler
            editingLockedReason={editingLockedReason}
          />
        );
      default:
        return <div className="py-8 text-center">Unsupported transaction type</div>;
    }
  };

  const editBody = (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onPointerDown={(e) => {
        if (!conversionPopoverOpen) return;
        const target = e.target as Node;
        if (conversionPopoverTriggerRef.current?.contains(target)) return;
        if (conversionPopoverContentRef.current?.contains(target)) return;
        setConversionPopoverOpen(false);
      }}
    >
      {(isLockedByOther && lockMessage && lockingEditor)
        || (hasConversion(fullTransactionData) && getConversion(fullTransactionData)) ? (
        <div className="shrink-0 space-y-4 px-6">
          {isLockedByOther && lockMessage && lockingEditor && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
            >
              <EditorPresenceAvatar editor={lockingEditor} />
              <p className="min-w-0 pt-1">
                {lockMessage}. Fields are read-only until they finish.
              </p>
            </div>
          )}
          {hasConversion(fullTransactionData) && getConversion(fullTransactionData) && (
            <div ref={conversionPopoverTriggerRef}>
              <Popover
                open={conversionPopoverOpen}
                onOpenChange={setConversionPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    View conversion
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80">
                  <div ref={conversionPopoverContentRef}>
                    <ConversionInfoPopover conv={getConversion(fullTransactionData)!} />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderForm()}
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <AnimatedSheetShell
          open={isOpen}
          onRequestClose={requestClose}
          titleId={titleId}
          side="right"
          swipeToClose
          historyKey="__fintrEditTransactionSheet"
          panelClassName="w-full flex flex-col h-full min-h-0 overflow-hidden p-0"
        >
          <div className="flex shrink-0 items-center justify-between px-6 pb-2 pt-4">
            <h2
              id={titleId}
              className="min-w-0 flex-1 truncate pr-2 text-lg font-semibold text-primary"
            >
              {getDialogTitle()}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={requestClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {editBody}
        </AnimatedSheetShell>
      ) : (
        <CustomModal
          isOpen={isOpen}
          onClose={requestClose}
          title={getDialogTitle()}
          maxWidth="2xl"
          className="p-0"
          pinBodyLayout
        >
          {editBody}
        </CustomModal>
      )}

      {/* Update Scope Modal */}
      <ScopeModal
        isOpen={showUpdateScopeModal}
        operationType="update"
        onClose={handleUpdateScopeCancel}
        onConfirm={handleUpdateScopeConfirm}
        scheduleTypeChange={scheduleTypeChange || { from: "", to: "" }}
        selectedScope={updateScope}
        onScopeChange={handleUpdateScopeChange}
        hasScheduleChanges={hasScheduleChanges}
        transactionType={activeTransaction?.type}
        inSeries={fullTransactionData?.scheduleType === ScheduleTypeEnum.REPEAT || fullTransactionData?.scheduleType === ScheduleTypeEnum.INSTALLMENT}
        isLoading={isUpdating}
      />
      
      {/* Delete Scope Modal */}
      <ScopeModal
        isOpen={showDeleteScopeModal}
        operationType="delete"
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        selectedScope={deleteScope}
        onScopeChange={handleDeleteScopeChange}
        transactionType={activeTransaction?.type}
        inSeries={deleteInSeries}
        isLoading={isDeleting}
      />

      <DiscardUnsavedChangesDialog
        isOpen={showDiscardConfirm}
        onKeepEditing={handleKeepEditing}
        onDiscard={handleDiscardChanges}
      />
    </>
  );
};

export default EditTransactionDialog; 
