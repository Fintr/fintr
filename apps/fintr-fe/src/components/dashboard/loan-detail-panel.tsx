"use client";

import React from "react";
import {
  CalendarIcon,
  ChevronDown,
  Edit,
  Trash2,
  Wallet,
} from "lucide-react";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { CustomModal } from "@/components/ui/custom-modal";
import { Button } from "@/components/ui/button";
import {
  buildLoanPaymentFxPayload,
  LoanPaymentAmountField,
} from "@/components/dashboard/forms/LoanPaymentAmountField";
import type { ConversionSnapshot } from "@/components/dashboard/forms/AmountWithRatePicker";
import type { AccountOptionWithCurrency } from "@/types/generalTypes";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdjustAccountBalanceSwitchRow } from "@/components/dashboard/forms/adjust-account-balance-switch-row";
import { useLoanPayments } from "@/hooks/async/useLoanPayments";
import { cn, formatCurrency } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { Loan } from "@/services/loans/queries";
import { useAtomValue } from "jotai";
import { accountOptionsAtom } from "@/atoms/dashboardAtoms";
import { currentSpaceAtom } from "@/atoms/spaceAtoms";
import {
  createTransactionNeedsConversion,
  resolveAmountPickerTargetCurrency,
} from "@/utils/amountPickerTargetCurrency";
import { useNumberInput } from "@/hooks/useNumberInput";
import { extractFieldErrors } from "@/utils/errorUtils";
import { FormError } from "@/components/ui/form-error";
import { toast } from "sonner";
import { numberFormatting } from "@/lib/utils";
import { handleMultilineNotesKeyDown } from "@/lib/multiline-notes-keydown";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import DeleteLoanPaymentModal from "@/components/dashboard/forms/DeleteLoanPaymentModal";
import {
  StickyFormActions,
  pinnedFormScrollAreaClassName,
} from "@/components/dashboard/forms/StickyFormActions";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { getAmortizationSchedule } from "@/utils/loanAmortization";
import { calculateLoanPaymentSplit } from "@/utils/calculate-loan-payment-split";
import { LoanPaymentSplitPreview } from "@/components/dashboard/loan-payment-split-preview";
import type { LoanPaymentPrefill } from "@/types/loanPaymentTypes";
import {
  getCrossedPaydownMilestone,
  getLoanPaydownPercent,
  getPaydownMilestoneMessage,
  parseLoanOutstandingBalance,
  parseLoanPrincipalAmount,
} from "@/utils/loan-paydown";

interface LoanDetailPanelProps {
  loan: Loan;
  isBorrowed: boolean;
  textColorClass: string;
  openPaymentRequestId?: number;
  paymentPrefill?: LoanPaymentPrefill | null;
}

const LOAN_TABLE_WRAPPER_CLASS =
  "max-h-[32rem] overflow-auto overscroll-contain touch-manipulation rounded-xl border border-border bg-card md:max-h-96";

const LOAN_TABLE_CONTAINER_CLASS = "overflow-visible w-full";

const LOAN_SCHEDULE_DATE_COL_CLASS = "min-w-[100px] md:min-w-[140px]";
const LOAN_SCHEDULE_AMOUNT_COL_CLASS = "w-[90px] md:w-[120px]";

const LOAN_PAYMENTS_DATE_COL_CLASS = "w-[96px] md:w-[120px]";
const LOAN_PAYMENTS_ACCOUNT_COL_CLASS = "w-[84px] md:w-[100px]";
const LOAN_PAYMENTS_AMOUNT_COL_CLASS = "w-[92px] md:w-[110px]";
const LOAN_PAYMENTS_NOTES_COL_CLASS = "min-w-[100px] md:min-w-[150px]";
const LOAN_PAYMENTS_ACTIONS_COL_CLASS = "w-[72px] md:w-[100px]";

const LOAN_SCHEDULE_TABLE_CLASS =
  "w-full table-fixed min-w-[34.375rem] md:min-w-[47rem]";

const LOAN_PAYMENTS_TABLE_CLASS =
  "w-full table-fixed min-w-[39.25rem] md:min-w-[50rem]";

const LOAN_TABLE_HEAD_CLASS =
  "sticky top-0 z-10 bg-muted px-2 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground shadow-[inset_0_-1px_0_0_hsl(var(--border))] md:px-3";

const LOAN_TABLE_ROW_CLASS =
  "bg-card hover:bg-accent/40";

const LOAN_TABLE_CELL_CLASS =
  "px-2 py-2 text-xs whitespace-nowrap text-foreground md:px-3";

const LOAN_TABLE_CELL_MUTED_CLASS =
  "px-2 py-2 text-xs whitespace-nowrap text-muted-foreground md:px-3";

const LOAN_TABLE_PAID_ROW_CLASS =
  "bg-primary/5";

const LOAN_TABLE_PAID_LABEL_CLASS =
  "ml-1 text-xs font-medium text-primary dark:text-primary-dark-mode";

const LOAN_TABLE_EMPTY_MESSAGE_CLASS =
  "text-sm text-muted-foreground";

type PaymentRow = ReturnType<typeof useLoanPayments>["payments"][number];

const loanPaymentConversionFromRecord = (
  payment: PaymentRow,
  accountOptions: AccountOptionWithCurrency[],
): ConversionSnapshot | null => {
  const conversion = payment.currencyConversion;
  if (!conversion?.originalCurrency || !conversion.exchangeRate) {
    return null;
  }

  const account = accountOptions.find(
    (option) => option.value === payment.accountName,
  );

  return {
    originalCurrency: conversion.originalCurrency,
    targetCurrency:
      account?.currency ?? conversion.convertedCurrency ?? conversion.originalCurrency,
    exchangeRate: conversion.exchangeRate,
    exchangeRateSource: conversion.source ?? "manual",
  };
};

const buildPaymentFxFields = (
  loanCurrency: string,
  accountName: string,
  accountOptions: AccountOptionWithCurrency[],
  spaceCurrency: string,
  conversionSnapshot: ConversionSnapshot | null,
  adjustsAccountBalance: boolean,
) => {
  const selectedAccount = accountOptions.find(
    (option) => option.value === accountName,
  );
  const needsConversion =
    adjustsAccountBalance &&
    createTransactionNeedsConversion({
      amountCurrency: loanCurrency,
      targetCurrency: resolveAmountPickerTargetCurrency({
        amountCurrency: loanCurrency,
        accountLedgerCurrency: selectedAccount?.currency ?? null,
        editBookedCurrency: null,
        effectiveSpaceCurrency: spaceCurrency,
      }),
    });

  return buildLoanPaymentFxPayload(conversionSnapshot, needsConversion);
};

const paymentNeedsFxConversion = (
  loanCurrency: string,
  accountName: string,
  accountOptions: AccountOptionWithCurrency[],
  spaceCurrency: string,
  adjustsAccountBalance: boolean,
) => {
  if (!adjustsAccountBalance) {
    return false;
  }

  return createTransactionNeedsConversion({
    amountCurrency: loanCurrency,
    targetCurrency: resolveAmountPickerTargetCurrency({
      amountCurrency: loanCurrency,
      accountLedgerCurrency:
        accountOptions.find((option) => option.value === accountName)
          ?.currency ?? null,
      editBookedCurrency: null,
      effectiveSpaceCurrency: spaceCurrency,
    }),
  });
};

type PaymentCardProps = {
  payment: PaymentRow;
  textColorClass: string;
  onEdit: (payment: PaymentRow) => void;
  onDelete: (payment: PaymentRow) => void;
  isDeleting: boolean;
};

function PaymentCard({
  payment,
  textColorClass,
  onEdit,
  onDelete,
  isDeleting,
}: PaymentCardProps) {
  return (
    <article className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {format(new Date(payment.date), "MMM d, yyyy")}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {payment.accountName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => onEdit(payment)}
            aria-label="Edit payment"
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={cn(
              "h-8 w-8 p-0",
              textColorClass,
              "hover:bg-accent/50",
            )}
            onClick={() => onDelete(payment)}
            disabled={isDeleting}
            aria-label="Delete payment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Principal
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
            {formatCurrency(payment.principalPayment, payment.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Interest
          </dt>
          <dd
            className={cn(
              "mt-0.5 text-sm font-semibold tabular-nums",
              textColorClass,
            )}
          >
            {formatCurrency(payment.interestPayment, payment.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </dt>
          <dd className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
            {formatCurrency(payment.totalPayment, payment.currency)}
          </dd>
        </div>
      </dl>
      {payment.notes ? (
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {payment.notes}
        </p>
      ) : null}
    </article>
  );
}

const applyPaymentPrefill = ({
  prefill,
  setPaymentDate,
  setAccountName,
  totalPaymentInput,
}: {
  prefill: LoanPaymentPrefill;
  setPaymentDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  setAccountName: React.Dispatch<React.SetStateAction<string>>;
  totalPaymentInput: ReturnType<typeof useNumberInput>;
}) => {
  if (prefill.date) {
    setPaymentDate(prefill.date);
  }

  if (prefill.accountName) {
    setAccountName(prefill.accountName);
  }

  if (prefill.amount) {
    totalPaymentInput.handleInputChange(prefill.amount);
  }
};

export function LoanDetailPanel({
  loan,
  isBorrowed,
  textColorClass,
  openPaymentRequestId = 0,
  paymentPrefill = null,
}: LoanDetailPanelProps) {
  // Use backend schedule which incorporates actual payments and adjusts accordingly
  const schedule = React.useMemo(() => getAmortizationSchedule(loan), [loan]);
  const { createPayment, isCreating, payments, isLoading: isLoadingPayments, updatePayment, deletePayment, isUpdating, isDeleting } = useLoanPayments(loan.id);
  const accountOptions = useAtomValue(accountOptionsAtom);
  const currentSpace = useAtomValue(currentSpaceAtom);
  const spaceCurrency = currentSpace?.currency ?? "PHP";
  const loanCurrency =
    loan.outstandingBalanceCurrency ??
    loan.principalAmountCurrency ??
    "PHP";
  const [recordConversionSnapshot, setRecordConversionSnapshot] =
    React.useState<ConversionSnapshot | null>(null);
  const [editConversionSnapshot, setEditConversionSnapshot] =
    React.useState<ConversionSnapshot | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = React.useState(false);
  const [isEditPaymentDialogOpen, setIsEditPaymentDialogOpen] = React.useState(false);
  const [editingPayment, setEditingPayment] = React.useState<typeof payments[0] | null>(null);
  const [isDeletePaymentModalOpen, setIsDeletePaymentModalOpen] = React.useState(false);
  const [paymentToDelete, setPaymentToDelete] = React.useState<typeof payments[0] | null>(null);
  const [paymentDate, setPaymentDate] = React.useState<Date | undefined>(new Date());
  const [accountName, setAccountName] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});
  const [formSubmitted, setFormSubmitted] = React.useState(false);
  const [recordPaymentDatePickerOpen, setRecordPaymentDatePickerOpen] = React.useState(false);
  const [editPaymentDatePickerOpen, setEditPaymentDatePickerOpen] = React.useState(false);
  const [adjustsAccountBalance, setAdjustsAccountBalance] = React.useState(true);
  const [isScheduleOpen, setIsScheduleOpen] = React.useState(false);

  const totalPaymentInput = useNumberInput({
    initialValue: "",
  });

  const sortedPayments = React.useMemo(
    () =>
      [...payments].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [payments],
  );

  const recordPaymentSplit = React.useMemo(() => {
    const totalPaymentValue = numberFormatting.cleanForBackend(
      totalPaymentInput.displayValue,
    );

    if (!paymentDate || totalPaymentValue <= 0) {
      return null;
    }

    return calculateLoanPaymentSplit({
      loan,
      paymentDate,
      totalPayment: totalPaymentValue,
      existingPayments: payments,
    });
  }, [loan, paymentDate, payments, totalPaymentInput.displayValue]);

  const editPaymentSplit = React.useMemo(() => {
    const totalPaymentValue = numberFormatting.cleanForBackend(
      totalPaymentInput.displayValue,
    );

    if (!paymentDate || totalPaymentValue <= 0 || !editingPayment) {
      return null;
    }

    return calculateLoanPaymentSplit({
      loan,
      paymentDate,
      totalPayment: totalPaymentValue,
      existingPayments: payments,
      excludePaymentId: editingPayment.id,
    });
  }, [
    editingPayment,
    loan,
    paymentDate,
    payments,
    totalPaymentInput.displayValue,
  ]);

  const openEditPayment = (payment: PaymentRow) => {
    setEditingPayment(payment);
    setPaymentDate(new Date(payment.date));
    setAccountName(payment.accountName);
    setNotes(payment.notes || "");
    totalPaymentInput.handleInputChange(payment.totalPayment.toString());
    setAdjustsAccountBalance(payment.adjustsAccountBalance !== false);
    setEditConversionSnapshot(
      loanPaymentConversionFromRecord(payment, accountOptions),
    );
    setIsEditPaymentDialogOpen(true);
  };

  const openDeletePayment = (payment: PaymentRow) => {
    setPaymentToDelete(payment);
    setIsDeletePaymentModalOpen(true);
  };

  const resetRecordPaymentFormFields = () => {
    setPaymentDate(new Date());
    setAccountName("");
    setNotes("");
    totalPaymentInput.reset();
    setRecordConversionSnapshot(null);
    setFormSubmitted(false);
    setValidationErrors({});
    setAdjustsAccountBalance(true);
  };

  React.useEffect(() => {
    if (openPaymentRequestId <= 0 || loan.status === "paid_off") {
      return;
    }

    resetRecordPaymentFormFields();

    if (paymentPrefill) {
      applyPaymentPrefill({
        prefill: paymentPrefill,
        setPaymentDate,
        setAccountName,
        totalPaymentInput,
      });
    }

    setIsPaymentDialogOpen(true);
    // Only re-run when the parent explicitly requests opening the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPaymentRequestId]);

  const closeRecordPaymentModal = () => {
    setIsPaymentDialogOpen(false);
    resetRecordPaymentFormFields();
  };

  const closeEditPaymentModal = () => {
    setIsEditPaymentDialogOpen(false);
    setEditingPayment(null);
    setPaymentDate(new Date());
    setAccountName("");
    setNotes("");
    totalPaymentInput.reset();
    setEditConversionSnapshot(null);
    setFormSubmitted(false);
    setValidationErrors({});
    setAdjustsAccountBalance(true);
  };

  const handleAddPayment = async () => {
    setFormSubmitted(true);
    setValidationErrors({});

    const errors: Record<string, string> = {};
    
    const totalPaymentValue = numberFormatting.cleanForBackend(totalPaymentInput.displayValue);
    if (!totalPaymentInput.displayValue || totalPaymentValue <= 0) {
      errors.totalPayment = "Payment amount must be a positive number";
    }
    
    if (!accountName) {
      errors.accountName = "Account is required";
    }
    
    if (!paymentDate) {
      errors.date = "Payment date is required";
    }

    const fxFields = buildPaymentFxFields(
      loanCurrency,
      accountName,
      accountOptions,
      spaceCurrency,
      recordConversionSnapshot,
      adjustsAccountBalance,
    );
    if (
      paymentNeedsFxConversion(
        loanCurrency,
        accountName,
        accountOptions,
        spaceCurrency,
        adjustsAccountBalance,
      ) &&
      !recordConversionSnapshot
    ) {
      errors.totalPayment = "Exchange rate is required for this account";
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      const paymentSplit = calculateLoanPaymentSplit({
        loan,
        paymentDate: paymentDate!,
        totalPayment: totalPaymentValue,
        existingPayments: payments,
      });
      const principalAmount = parseLoanPrincipalAmount(loan.principalAmount);
      const outstandingBefore = parseLoanOutstandingBalance(
        loan.outstandingBalance,
      );
      const beforePercent = getLoanPaydownPercent(
        principalAmount,
        outstandingBefore,
        loan.status,
      );
      const outstandingAfter = Math.max(
        0,
        outstandingBefore - (paymentSplit?.principalPayment ?? 0),
      );
      const afterPercent =
        outstandingAfter <= 0.01
          ? 100
          : getLoanPaydownPercent(
              principalAmount,
              outstandingAfter,
              loan.status,
            );
      const crossedMilestone = getCrossedPaydownMilestone(
        beforePercent,
        afterPercent,
      );

      const result = await createPayment({
        accountName,
        date: paymentDate ? format(paymentDate, "yyyy-MM-dd") : "",
        totalPayment: totalPaymentValue,
        notes: notes || undefined,
        adjustsAccountBalance,
        ...fxFields,
      });

      closeRecordPaymentModal();

      if (crossedMilestone) {
        toast.success(
          getPaydownMilestoneMessage(
            crossedMilestone,
            crossedMilestone === 50
              ? formatCurrency(outstandingAfter, loanCurrency)
              : undefined,
          ),
        );
      } else {
        toast.success("Payment recorded successfully");
      }

      void Promise.resolve(result.syncPromise)
        .then((synced) => {
          if (synced.pendingSync) {
            toast.message(
              "Payment saved on this device. Will sync when online.",
            );
          }
        })
        .catch(() => {
          toast.error("Failed to record payment. Please try again.");
        });
    } catch (error: any) {
      const fieldErrors = extractFieldErrors(error);
      // Convert string[] to string for validation errors
      const stringErrors: Record<string, string> = {};
      Object.keys(fieldErrors).forEach(key => {
        const errorValue = fieldErrors[key];
        stringErrors[key] = Array.isArray(errorValue) ? errorValue[0] || "" : errorValue || "";
      });
      setValidationErrors(stringErrors);
      
      if (Object.keys(stringErrors).length === 0) {
        toast.error("Failed to record payment. Please try again.");
      }
    }
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment) return;

    setFormSubmitted(true);
    setValidationErrors({});

    const errors: Record<string, string> = {};

    const totalPaymentValue = numberFormatting.cleanForBackend(totalPaymentInput.displayValue);
    if (!totalPaymentInput.displayValue || totalPaymentValue <= 0) {
      errors.totalPayment = "Payment amount must be a positive number";
    }

    if (!accountName) {
      errors.accountName = "Account is required";
    }

    if (!paymentDate) {
      errors.date = "Payment date is required";
    }

    const fxFields = buildPaymentFxFields(
      loanCurrency,
      accountName,
      accountOptions,
      spaceCurrency,
      editConversionSnapshot,
      adjustsAccountBalance,
    );
    if (
      paymentNeedsFxConversion(
        loanCurrency,
        accountName,
        accountOptions,
        spaceCurrency,
        adjustsAccountBalance,
      ) &&
      !editConversionSnapshot
    ) {
      errors.totalPayment = "Exchange rate is required for this account";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      await updatePayment({
        paymentId: editingPayment.id,
        paymentData: {
          accountName,
          date: paymentDate ? format(paymentDate, "yyyy-MM-dd") : "",
          totalPayment: totalPaymentValue,
          notes: notes || undefined,
          adjustsAccountBalance,
          ...fxFields,
        },
      });

      toast.success("Payment updated successfully");
      closeEditPaymentModal();
    } catch (error: any) {
      const fieldErrors = extractFieldErrors(error);
      const stringErrors: Record<string, string> = {};
      Object.keys(fieldErrors).forEach((key) => {
        const errorValue = fieldErrors[key];
        stringErrors[key] = Array.isArray(errorValue) ? errorValue[0] || "" : errorValue || "";
      });
      setValidationErrors(stringErrors);

      if (Object.keys(stringErrors).length === 0) {
        toast.error("Failed to update payment. Please try again.");
      }
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-primary">
            Payments made
          </h2>
          {loan.status !== "paid_off" ? (
            <Button
              size="sm"
              variant="default"
              className="shrink-0"
              type="button"
              onClick={() => setIsPaymentDialogOpen(true)}
            >
              <Wallet className="mr-1.5 h-3.5 w-3.5" />
              Add payment
            </Button>
          ) : null}
        </div>

        {isLoadingPayments ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : sortedPayments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
            <p className={LOAN_TABLE_EMPTY_MESSAGE_CLASS}>
              {loan.status === "paid_off"
                ? "No payments were recorded for this loan"
                : "No payments recorded yet"}
            </p>
            {loan.status !== "paid_off" ? (
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                type="button"
                onClick={() => setIsPaymentDialogOpen(true)}
              >
                <Wallet className="mr-1.5 h-3.5 w-3.5" />
                Record first payment
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="space-y-2.5 md:hidden">
              {sortedPayments.map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  textColorClass={textColorClass}
                  onEdit={openEditPayment}
                  onDelete={openDeletePayment}
                  isDeleting={isDeleting}
                />
              ))}
            </div>

            <div className={cn(LOAN_TABLE_WRAPPER_CLASS, "hidden md:block")}>
              <Table
                containerClassName={LOAN_TABLE_CONTAINER_CLASS}
                className={LOAN_PAYMENTS_TABLE_CLASS}
              >
                <TableHeader>
                  <TableRow className={LOAN_TABLE_ROW_CLASS}>
                    <TableHead
                      className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_DATE_COL_CLASS}`}
                    >
                      Date
                    </TableHead>
                    <TableHead
                      className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_ACCOUNT_COL_CLASS}`}
                    >
                      Account
                    </TableHead>
                    <TableHead
                      className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_AMOUNT_COL_CLASS} text-right`}
                    >
                      Principal
                    </TableHead>
                    <TableHead
                      className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_AMOUNT_COL_CLASS} text-right`}
                    >
                      Interest
                    </TableHead>
                    <TableHead
                      className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_AMOUNT_COL_CLASS} text-right`}
                    >
                      Total
                    </TableHead>
                    <TableHead
                      className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_NOTES_COL_CLASS}`}
                    >
                      Notes
                    </TableHead>
                    <TableHead
                      className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_ACTIONS_COL_CLASS} text-right`}
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPayments.map((payment) => (
                    <TableRow key={payment.id} className={LOAN_TABLE_ROW_CLASS}>
                      <TableCell className={LOAN_TABLE_CELL_CLASS}>
                        {format(new Date(payment.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className={LOAN_TABLE_CELL_CLASS}>
                        {payment.accountName}
                      </TableCell>
                      <TableCell
                        className={`${LOAN_TABLE_CELL_CLASS} text-right`}
                      >
                        {formatCurrency(
                          payment.principalPayment,
                          payment.currency,
                        )}
                      </TableCell>
                      <TableCell
                        className={`${LOAN_TABLE_CELL_CLASS} text-right ${textColorClass}`}
                      >
                        {formatCurrency(
                          payment.interestPayment,
                          payment.currency,
                        )}
                      </TableCell>
                      <TableCell
                        className={`${LOAN_TABLE_CELL_CLASS} text-right font-medium`}
                      >
                        {formatCurrency(payment.totalPayment, payment.currency)}
                      </TableCell>
                      <TableCell
                        className={`${LOAN_TABLE_CELL_MUTED_CLASS} truncate`}
                        title={payment.notes || ""}
                      >
                        {payment.notes || "-"}
                      </TableCell>
                      <TableCell
                        className={`${LOAN_TABLE_CELL_CLASS} text-right`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => openEditPayment(payment)}
                            aria-label="Edit payment"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                              "h-7 w-7 p-0",
                              textColorClass,
                              "hover:bg-accent/50",
                            )}
                            onClick={() => openDeletePayment(payment)}
                            disabled={isDeleting}
                            aria-label="Delete payment"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>

      <section>
        <button
          type="button"
          className="mb-4 flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={isScheduleOpen}
          onClick={() => setIsScheduleOpen((open) => !open)}
        >
            <h2 className="text-sm font-semibold text-primary">
              Payment schedule
            </h2>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                isScheduleOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          {isScheduleOpen ? (
            <div className={LOAN_TABLE_WRAPPER_CLASS}>
              <Table
                containerClassName={LOAN_TABLE_CONTAINER_CLASS}
                className={LOAN_SCHEDULE_TABLE_CLASS}
              >
                <TableHeader>
                  <TableRow className={LOAN_TABLE_ROW_CLASS}>
                    <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_SCHEDULE_DATE_COL_CLASS}`}>
                      Date
                    </TableHead>
                    <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_SCHEDULE_AMOUNT_COL_CLASS} text-right`}>
                      Beginning
                    </TableHead>
                    <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_SCHEDULE_AMOUNT_COL_CLASS} text-right`}>
                      Payment
                    </TableHead>
                    <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_SCHEDULE_AMOUNT_COL_CLASS} text-right`}>
                      Principal
                    </TableHead>
                    <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_SCHEDULE_AMOUNT_COL_CLASS} text-right`}>
                      Interest
                    </TableHead>
                    <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_SCHEDULE_AMOUNT_COL_CLASS} text-right`}>
                      Balance
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((payment, index) => (
                    <TableRow
                      key={index}
                      className={cn(
                        LOAN_TABLE_ROW_CLASS,
                        payment.isActual && LOAN_TABLE_PAID_ROW_CLASS,
                      )}
                    >
                      <TableCell className={LOAN_TABLE_CELL_CLASS}>
                        <span>
                          {payment.paymentDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        {payment.isActual && (
                          <span className={LOAN_TABLE_PAID_LABEL_CLASS}>(Paid)</span>
                        )}
                      </TableCell>
                      <TableCell className={`${LOAN_TABLE_CELL_CLASS} text-right`}>
                        {formatCurrency(
                          payment.beginningBalance,
                          loan.outstandingBalanceCurrency,
                        )}
                      </TableCell>
                      <TableCell className={`${LOAN_TABLE_CELL_CLASS} text-right font-medium`}>
                        {formatCurrency(
                          payment.paymentAmount,
                          loan.outstandingBalanceCurrency,
                        )}
                      </TableCell>
                      <TableCell className={`${LOAN_TABLE_CELL_CLASS} text-right`}>
                        {formatCurrency(
                          payment.principalPayment,
                          loan.outstandingBalanceCurrency,
                        )}
                      </TableCell>
                      <TableCell className={`${LOAN_TABLE_CELL_CLASS} text-right ${textColorClass}`}>
                        {formatCurrency(
                          payment.interestPayment,
                          loan.outstandingBalanceCurrency,
                        )}
                      </TableCell>
                      <TableCell className={`${LOAN_TABLE_CELL_MUTED_CLASS} text-right`}>
                        {formatCurrency(
                          payment.endingBalance,
                          loan.outstandingBalanceCurrency,
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
      </section>

        <CustomModal
          isOpen={isPaymentDialogOpen}
          onClose={closeRecordPaymentModal}
          title="Record Loan Payment"
          maxWidth="2xl"
          className="p-0"
          pinBodyLayout
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className={pinnedFormScrollAreaClassName}>
              <p className="text-left text-sm text-muted-foreground">
                {adjustsAccountBalance
                  ? "Record a payment for this loan. The amount is split into principal and interest using daily simple interest, and your selected account balance is updated to match the cash movement."
                  : "Record a past payment that is already reflected in your account balances. The loan schedule and outstanding principal still update from the amount you enter, but no money is moved in or out of the selected account."}
              </p>
              <div className="space-y-2">
                <Label htmlFor="payment-date" className="text-sm">Payment Date</Label>
                <CalendarPopover
                  modal
                  open={recordPaymentDatePickerOpen}
                  onOpenChange={setRecordPaymentDatePickerOpen}
                  trigger={
                    <Button 
                      variant="outline" 
                      className={`w-full justify-start text-left font-normal text-sm ${formSubmitted && validationErrors.date ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {paymentDate ? format(paymentDate, "MMM d, yyyy") : <span className="text-sm">Pick a date</span>}
                    </Button>
                  }
                >
                  <Calendar 
                    mode="single" 
                    selected={paymentDate} 
                    onSelect={(date) => {
                      setPaymentDate(date);
                      if (date) setRecordPaymentDatePickerOpen(false);
                      if (formSubmitted && validationErrors.date) {
                        setValidationErrors({ ...validationErrors, date: "" });
                      }
                    }} 
                    autoFocus 
                    defaultMonth={paymentDate || new Date()}
                    toDate={new Date()}
                  />
                </CalendarPopover>
                {formSubmitted && validationErrors.date && (
                  <FormError message={validationErrors.date} />
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment-account" className="text-sm">Account</Label>
                <Select
                  value={accountName}
                  onValueChange={(value) => {
                    setAccountName(value);
                    if (formSubmitted && validationErrors.accountName) {
                      setValidationErrors({ ...validationErrors, accountName: "" });
                    }
                  }}
                >
                  <SelectTrigger 
                    id="payment-account"
                    className={`text-sm ${formSubmitted && validationErrors.accountName ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                  >
                    <SelectValue placeholder="Select Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountOptions.map((account) => (
                      <SelectItem key={account.value} value={account.value} className="text-sm">
                        {account.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formSubmitted && validationErrors.accountName && (
                  <FormError message={validationErrors.accountName} />
                )}
              </div>

              <LoanPaymentAmountField
                id="payment-amount"
                loanCurrency={loanCurrency}
                spaceCurrency={spaceCurrency}
                accountName={accountName}
                accountOptions={accountOptions}
                amountDisplayValue={totalPaymentInput.displayValue}
                onAmountChange={(value) => {
                  totalPaymentInput.handleInputChange(value);
                  if (formSubmitted && validationErrors.totalPayment) {
                    setValidationErrors({ ...validationErrors, totalPayment: "" });
                  }
                }}
                paymentDate={paymentDate}
                formSubmitted={formSubmitted}
                amountError={
                  formSubmitted ? validationErrors.totalPayment : undefined
                }
                onConversionChange={setRecordConversionSnapshot}
                adjustsAccountBalance={adjustsAccountBalance}
              />

              <LoanPaymentSplitPreview
                split={recordPaymentSplit}
                currency={loanCurrency}
                textColorClass={textColorClass}
              />

              <AdjustAccountBalanceSwitchRow
                id="adjusts-account-balance"
                checked={adjustsAccountBalance}
                onCheckedChange={setAdjustsAccountBalance}
                label="Update account balance"
                infoAriaLabel="Help: update account balance for this payment"
                switchAriaLabel="Update account balance for this payment"
                popoverTitle="Account balance and this payment"
              >
                <p>
                  When <span className="font-medium">on</span>, Fintr changes the selected account balance to match this payment (the usual repayment flow).
                </p>
                <p>
                  When <span className="font-medium">off</span>, use this for money you have already booked in your accounts (for example catching up an ongoing loan). The loan still splits principal and interest from your amount, but the account balance is not moved again.
                </p>
              </AdjustAccountBalanceSwitchRow>

              <div className="space-y-2">
                <Label htmlFor="payment-notes" className="text-sm">Notes (Optional)</Label>
                <Textarea
                  id="payment-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={handleMultilineNotesKeyDown}
                  placeholder="Add any additional notes..."
                  className="text-sm min-h-[80px]"
                />
              </div>
            </div>

            <StickyFormActions className="justify-end">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={closeRecordPaymentModal}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAddPayment}
                  disabled={isCreating}
                >
                  {isCreating ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </StickyFormActions>
          </div>
        </CustomModal>

        <CustomModal
          isOpen={isEditPaymentDialogOpen}
          onClose={closeEditPaymentModal}
          title="Edit Loan Payment"
          maxWidth="2xl"
          className="p-0"
          pinBodyLayout
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className={pinnedFormScrollAreaClassName}>
              <p className="text-left text-sm text-muted-foreground">
                {adjustsAccountBalance
                  ? "Update payment details. Principal and interest are recalculated from the amount, and the account balance change is kept in sync."
                  : "This payment is treated as already reflected in accounts. You can edit the amount and dates for the loan schedule; the selected account balance is not changed."}
              </p>
              <div className="space-y-2">
                <Label htmlFor="edit-payment-date" className="text-sm">Payment Date</Label>
                <CalendarPopover
                  modal
                  open={editPaymentDatePickerOpen}
                  onOpenChange={setEditPaymentDatePickerOpen}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      className={`w-full justify-start text-left font-normal text-sm ${formSubmitted && validationErrors.date ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {paymentDate ? format(paymentDate, "MMM d, yyyy") : <span className="text-sm">Pick a date</span>}
                    </Button>
                  }
                >
                  <Calendar
                    mode="single"
                    selected={paymentDate}
                    onSelect={(date) => {
                      setPaymentDate(date);
                      if (date) setEditPaymentDatePickerOpen(false);
                      if (formSubmitted && validationErrors.date) {
                        setValidationErrors({ ...validationErrors, date: "" });
                      }
                    }}
                    autoFocus
                    defaultMonth={paymentDate || new Date()}
                    toDate={new Date()}
                  />
                </CalendarPopover>
                {formSubmitted && validationErrors.date && (
                  <FormError message={validationErrors.date} />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-payment-account" className="text-sm">Account</Label>
                <Select
                  value={accountName}
                  onValueChange={(value) => {
                    setAccountName(value);
                    if (formSubmitted && validationErrors.accountName) {
                      setValidationErrors({ ...validationErrors, accountName: "" });
                    }
                  }}
                >
                  <SelectTrigger
                    id="edit-payment-account"
                    className={`text-sm ${formSubmitted && validationErrors.accountName ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                  >
                    <SelectValue placeholder="Select Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountOptions.map((account) => (
                      <SelectItem key={account.value} value={account.value} className="text-sm">
                        {account.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formSubmitted && validationErrors.accountName && (
                  <FormError message={validationErrors.accountName} />
                )}
              </div>

              <LoanPaymentAmountField
                id="edit-payment-amount"
                loanCurrency={loanCurrency}
                spaceCurrency={spaceCurrency}
                accountName={accountName}
                accountOptions={accountOptions}
                amountDisplayValue={totalPaymentInput.displayValue}
                onAmountChange={(value) => {
                  totalPaymentInput.handleInputChange(value);
                  if (formSubmitted && validationErrors.totalPayment) {
                    setValidationErrors({ ...validationErrors, totalPayment: "" });
                  }
                }}
                paymentDate={paymentDate}
                formSubmitted={formSubmitted}
                amountError={
                  formSubmitted ? validationErrors.totalPayment : undefined
                }
                initialConversion={editConversionSnapshot}
                onConversionChange={setEditConversionSnapshot}
                adjustsAccountBalance={adjustsAccountBalance}
              />

              <LoanPaymentSplitPreview
                split={editPaymentSplit}
                currency={loanCurrency}
                textColorClass={textColorClass}
              />

              <AdjustAccountBalanceSwitchRow
                id="edit-adjusts-account-balance"
                checked={adjustsAccountBalance}
                onCheckedChange={setAdjustsAccountBalance}
                label="Update account balance"
                infoAriaLabel="Help: update account balance for this payment"
                switchAriaLabel="Update account balance for this payment"
                popoverTitle="Account balance and this payment"
              >
                <p>
                  When <span className="font-medium">on</span>, Fintr changes the selected account balance to match this payment (the usual repayment flow).
                </p>
                <p>
                  When <span className="font-medium">off</span>, use this for money you have already booked in your accounts (for example catching up an ongoing loan). The loan still splits principal and interest from your amount, but the account balance is not moved again.
                </p>
              </AdjustAccountBalanceSwitchRow>

              <div className="space-y-2">
                <Label htmlFor="edit-payment-notes" className="text-sm">Notes (Optional)</Label>
                <Textarea
                  id="edit-payment-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={handleMultilineNotesKeyDown}
                  placeholder="Add any additional notes..."
                  className="text-sm min-h-[80px]"
                />
              </div>
            </div>

            <StickyFormActions className="justify-end">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={closeEditPaymentModal}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleUpdatePayment}
                  disabled={isUpdating}
                >
                  {isUpdating ? "Updating..." : "Update Payment"}
                </Button>
              </div>
            </StickyFormActions>
          </div>
        </CustomModal>
        
        <DeleteLoanPaymentModal
          isOpen={isDeletePaymentModalOpen}
          onClose={() => {
            setIsDeletePaymentModalOpen(false);
            setTimeout(() => {
              setPaymentToDelete(null);
            }, 300);
          }}
          onConfirm={async () => {
            if (!paymentToDelete) return;

            const paymentId = paymentToDelete.id;
            setIsDeletePaymentModalOpen(false);
            setPaymentToDelete(null);

            try {
              await deletePayment(paymentId);
              toast.success("Payment deleted successfully");
            } catch {
              toast.error("Failed to delete payment. Please try again.");
            }
          }}
          isDeleting={isDeleting}
        />
    </div>
  );
};
