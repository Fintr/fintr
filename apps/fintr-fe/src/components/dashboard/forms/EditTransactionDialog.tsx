import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatedSheetShell } from "@/components/ui/animated-sheet-shell";
import { CustomModal } from "@/components/ui/custom-modal";
import ExpenseForm from "./ExpenseForm";
import IncomeForm from "./IncomeForm";
import TransferForm from "./TransferForm";
import ScopeModal, { UpdateScope, Scope, DeleteScope } from "./ScopeModal";
import { IndexTransaction, CombinedTransactionTypeEnum, TransferUpdateTransactionType, UpdateTransactionType, CurrencyConversionType } from "@/types/transactionTypes";
import { UpdateTransferType } from "@/services/transactions/transfers/mutation";
import { buildTransferInitialData } from "./transfer-form-initial-data";
import { updateTransferLocalFirst } from "@/services/transactions/transfers/update-local-first";
import { deleteTransaction } from "@/services/transactions/mutation";
import { updateTransactionLocalFirst } from "@/services/transactions/update-local-first";
import { deleteTransactionLocalFirst } from "@/services/transactions/delete-local-first";
import {
  enrichTransactionEditDetail,
  seedTransactionEditFromListRow,
} from "@/services/transactions/detail-local";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ScheduleTypeEnum, UpdateScopeEnum, DeleteScopeEnum } from "@/constants/transactionConstants";
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createDisplayFileFromAttachment } from "@/utils/fileUtils";
import { cn, formatWithDelimiters } from "@/lib/utils";
import { ArrowLeftRight, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TransactionEditorPresence,
  useTransactionEditingPresence,
} from "@/hooks/useTransactionEditingPresence";

/** Keep form data visible through sheet/modal close animations (~400ms). */
const EDIT_DIALOG_CLOSE_RESET_DELAY_MS = 450;

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
  const preferLocal = useSkipCachedNetworkFetch();
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
  const [dataKey, setDataKey] = useState<number>(0); // Add a key to force re-render
  
  // Delete scope modal state
  const [showDeleteScopeModal, setShowDeleteScopeModal] = useState(false);
  const [deleteScope, setDeleteScope] = useState<DeleteScope>(DeleteScopeEnum.THIS_ONLY);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

    // Service owns seed/enrich; component only binds result to UI state.
    const seed = seedTransactionEditFromListRow(activeTransaction);
    setFullTransactionData(seed.data);
    setDataKey((prev) => prev + 1);
    if (seed.date) {
      setDate(seed.date);
    }
    setIsLoading(false);

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

        const detailFiles = (processedData as { files?: FileAttachment[] }).files;
        if (
          detailFiles &&
          Array.isArray(detailFiles) &&
          detailFiles.length > 0 &&
          !processedData.file
        ) {
          setFileAttachments(detailFiles);

          const fileAttachment = detailFiles[0];
          if (fileAttachment && fileAttachment.url) {
            // Display File object is a UI concern; keep it in the component.
            processedData.file = createDisplayFileFromAttachment(fileAttachment);
          }
        }

        setFullTransactionData(processedData);
        if (enriched.date) {
          setDate(enriched.date);
        }
      } catch (error) {
        if (cancelled) return;
        console.error(error);
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

    // Check if this is an installment transaction - show modal for any changes
    if (originalScheduleType === ScheduleTypeEnum.INSTALLMENT) {
      openUpdateScopeModal(formData, { from: "installment", to: "installment" });
      await waitForScopeModal();
      return;
    }

    // If no schedule type change or one_time transaction, proceed directly
    await handleSuccess(formData);
  };

  const handleUpdateScopeConfirm = async (scope: Scope) => {
    if (!pendingFormData) {
      handleUpdateScopeCancel();
      return;
    }

    const finalFormData = { ...pendingFormData, updateScope: scope as UpdateScope };

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
  const handleDelete = () => {
    if (!activeTransaction) return;
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
          onSuccess({ skipTransactionsInvalidate: true });
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

      onSuccess();
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
  const handleFileUpdate = (updatedFile: File | null) => {
    setFullTransactionData(prev => {
      if (!prev) return null;
      const newState = { ...prev, file: updatedFile };
      return newState;
    });
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

  const getDialogTitle = () => {
    switch (activeTransaction?.type) {
      case CombinedTransactionTypeEnum.EXPENSE:
        return "Edit Expense";
      case CombinedTransactionTypeEnum.INCOME:
        return "Edit Income";
      case CombinedTransactionTypeEnum.TRANSFER:
        return "Edit Transfer";
      default:
        return "Edit Transaction";
    }
  };

  const getDialogDescription = () => {
    switch (activeTransaction?.type) {
      case CombinedTransactionTypeEnum.EXPENSE:
        return "Update the details of your expense transaction.";
      case CombinedTransactionTypeEnum.INCOME:
        return "Update the details of your income transaction.";
      case CombinedTransactionTypeEnum.TRANSFER:
        return "Update the details of your transfer transaction.";
      default:
        return "Update the details of your transaction.";
    }
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
            onCancel={onClose}
            isEditMode={true}
            onFileUpdate={handleFileUpdate} // Pass the new handler
            onDelete={handleDelete} // Pass the delete handler
            editingLockedReason={editingLockedReason}
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
            onCancel={onClose}
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
            onCancel={onClose}
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
      <div className="shrink-0 space-y-4 px-6">
        <p className="text-sm text-muted-foreground">
          {getDialogDescription()}
        </p>
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
          onRequestClose={onClose}
          titleId={titleId}
          side="right"
          swipeToClose
          historyKey="__fintrEditTransactionSheet"
          panelClassName="w-full flex flex-col h-full min-h-0 overflow-hidden p-0"
        >
          <div className="flex shrink-0 items-center justify-between px-6 pb-2 pt-4">
            <h2
              id={titleId}
              className="text-lg font-semibold text-primary"
            >
              {getDialogTitle()}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onClose}
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
          onClose={onClose}
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
        inSeries={fullTransactionData?.scheduleType === ScheduleTypeEnum.REPEAT || fullTransactionData?.scheduleType === ScheduleTypeEnum.INSTALLMENT}
        isLoading={isDeleting}
      />
    </>
  );
};

export default EditTransactionDialog; 
