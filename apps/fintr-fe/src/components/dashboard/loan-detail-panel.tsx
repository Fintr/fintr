"use client";

import React from "react";
import {
  CalendarIcon,
  Edit,
  Trash2,
  Wallet,
} from "lucide-react";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { CustomModal } from "@/components/ui/custom-modal";
import { Button } from "@/components/ui/button";
import { CalculatorInput } from "@/components/ui/calculator-input";
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { getAmortizationSchedule } from "@/utils/loanAmortization";

interface LoanDetailPanelProps {
  loan: Loan;
  isBorrowed: boolean;
  textColorClass: string;
}

const LOAN_TABLE_WRAPPER_CLASS =
  "max-h-[32rem] overflow-auto overscroll-contain touch-manipulation rounded-lg border border-gray-200 bg-white md:max-h-96 dark:border-border dark:bg-background";

const LOAN_TABLE_CONTAINER_CLASS = "overflow-visible w-fit min-w-full";

const LOAN_SCHEDULE_DATE_COL_CLASS = "w-[100px] md:w-[140px]";
const LOAN_SCHEDULE_AMOUNT_COL_CLASS = "w-[90px] md:w-[120px]";

const LOAN_PAYMENTS_DATE_COL_CLASS = "w-[96px] md:w-[120px]";
const LOAN_PAYMENTS_ACCOUNT_COL_CLASS = "w-[84px] md:w-[100px]";
const LOAN_PAYMENTS_AMOUNT_COL_CLASS = "w-[92px] md:w-[110px]";
const LOAN_PAYMENTS_NOTES_COL_CLASS = "w-[100px] md:w-[150px]";
const LOAN_PAYMENTS_ACTIONS_COL_CLASS = "w-[72px] md:w-[100px]";

/** 6 data columns; compact on mobile to balance horizontal vs vertical scroll. */
const LOAN_SCHEDULE_TABLE_CLASS = "w-max min-w-[34.375rem] md:min-w-[47rem]";

/** 7 columns incl. Actions; compact on mobile to balance horizontal vs vertical scroll. */
const LOAN_PAYMENTS_TABLE_CLASS = "w-max min-w-[39.25rem] md:min-w-[50rem]";

const LOAN_TABLE_HEAD_CLASS =
  "sticky top-0 z-10 bg-gray-100 px-2 py-2 text-xs font-medium whitespace-nowrap text-gray-600 shadow-[inset_0_-1px_0_0_rgb(229_231_235)] md:px-3 dark:bg-muted dark:text-muted-foreground dark:shadow-[inset_0_-1px_0_0_hsl(var(--border))]";

const LOAN_TABLE_ROW_CLASS =
  "bg-white hover:bg-gray-50 dark:bg-transparent dark:hover:bg-accent/50";

const LOAN_TABLE_CELL_CLASS =
  "px-2 py-2 text-xs whitespace-nowrap text-gray-700 md:px-3 dark:text-foreground";

const LOAN_TABLE_CELL_MUTED_CLASS =
  "px-2 py-2 text-xs whitespace-nowrap text-gray-600 md:px-3 dark:text-muted-foreground";

const LOAN_TABLE_PAID_ROW_CLASS =
  "bg-blue-50 dark:bg-primary/10";

const LOAN_TABLE_PAID_LABEL_CLASS =
  "ml-1 text-xs font-medium text-blue-600 dark:text-primary-dark-mode";

const LOAN_TABLE_EMPTY_MESSAGE_CLASS =
  "text-sm text-gray-500 dark:text-muted-foreground";

const LOAN_TABLE_MOBILE_EMPTY_STATE_CLASS =
  "pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 md:hidden";

export function LoanDetailPanel({
  loan,
  isBorrowed,
  textColorClass,
}: LoanDetailPanelProps) {
  // Use backend schedule which incorporates actual payments and adjusts accordingly
  const schedule = React.useMemo(() => getAmortizationSchedule(loan), [loan]);
  const { createPayment, isCreating, payments, isLoading: isLoadingPayments, updatePayment, deletePayment, isUpdating, isDeleting } = useLoanPayments(loan.id);
  const accountOptions = useAtomValue(accountOptionsAtom);
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
  
  const totalPaymentInput = useNumberInput({
    initialValue: "",
  });
  
  const totalInterestPaid = React.useMemo(() => {
    const sum = payments.reduce(
      (acc, payment) => acc + payment.interestPayment,
      0,
    );
    return Math.round(sum * 100) / 100;
  }, [payments]);

  const netCost = totalInterestPaid;

  const resetRecordPaymentFormFields = () => {
    setPaymentDate(new Date());
    setAccountName("");
    setNotes("");
    totalPaymentInput.reset();
    setFormSubmitted(false);
    setValidationErrors({});
    setAdjustsAccountBalance(true);
  };

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
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      await createPayment({
        accountName,
        date: paymentDate ? format(paymentDate, "yyyy-MM-dd") : "",
        totalPayment: totalPaymentValue,
        notes: notes || undefined,
        adjustsAccountBalance,
      });

      toast.success("Payment recorded successfully");
      closeRecordPaymentModal();
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
    <div className="space-y-6">
      <section className="space-y-8">
      <div>
          <h5 className="mb-3 text-lg font-semibold text-primary">
            Payment schedule
          </h5>
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
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h5 className="text-lg font-semibold text-primary">
              Payments made
            </h5>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-xs"
              type="button"
              onClick={() => setIsPaymentDialogOpen(true)}
            >
              <Wallet className="h-3 w-3 mr-1" />
              Add Payment
            </Button>
          </div>
          <div
            className={cn(
              LOAN_TABLE_WRAPPER_CLASS,
              !isLoadingPayments && payments.length === 0 && "relative",
            )}
          >
            {!isLoadingPayments && payments.length === 0 ? (
              <div
                className={LOAN_TABLE_MOBILE_EMPTY_STATE_CLASS}
                role="status"
              >
                <p className={LOAN_TABLE_EMPTY_MESSAGE_CLASS}>
                  No payments recorded yet
                </p>
              </div>
            ) : null}
            <Table
              containerClassName={LOAN_TABLE_CONTAINER_CLASS}
              className={LOAN_PAYMENTS_TABLE_CLASS}
            >
              <TableHeader>
                <TableRow className={LOAN_TABLE_ROW_CLASS}>
                  <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_DATE_COL_CLASS}`}>
                    Date
                  </TableHead>
                  <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_ACCOUNT_COL_CLASS}`}>
                    Account
                  </TableHead>
                  <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_AMOUNT_COL_CLASS} text-right`}>
                    Principal
                  </TableHead>
                  <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_AMOUNT_COL_CLASS} text-right`}>
                    Interest
                  </TableHead>
                  <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_AMOUNT_COL_CLASS} text-right`}>
                    Total
                  </TableHead>
                  <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_NOTES_COL_CLASS}`}>
                    Notes
                  </TableHead>
                  <TableHead className={`${LOAN_TABLE_HEAD_CLASS} ${LOAN_PAYMENTS_ACTIONS_COL_CLASS} text-right`}>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPayments ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-3 py-8 text-center">
                      <LoadingSpinner />
                    </TableCell>
                  </TableRow>
                ) : payments.length === 0 ? (
                  <TableRow className="hidden md:table-row">
                    <TableCell colSpan={7} className="px-3 py-8 text-center">
                      <p className={LOAN_TABLE_EMPTY_MESSAGE_CLASS}>
                        No payments recorded yet
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  payments
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime(),
                    )
                    .map((payment) => (
                      <TableRow key={payment.id} className={LOAN_TABLE_ROW_CLASS}>
                        <TableCell className={LOAN_TABLE_CELL_CLASS}>
                          {format(new Date(payment.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className={LOAN_TABLE_CELL_CLASS}>
                          {payment.accountName}
                        </TableCell>
                        <TableCell className={`${LOAN_TABLE_CELL_CLASS} text-right`}>
                          {formatCurrency(payment.principalPayment, payment.currency)}
                        </TableCell>
                        <TableCell className={`${LOAN_TABLE_CELL_CLASS} text-right ${textColorClass}`}>
                          {formatCurrency(payment.interestPayment, payment.currency)}
                        </TableCell>
                        <TableCell className={`${LOAN_TABLE_CELL_CLASS} text-right font-medium`}>
                          {formatCurrency(payment.totalPayment, payment.currency)}
                        </TableCell>
                        <TableCell
                          className={`${LOAN_TABLE_CELL_MUTED_CLASS} truncate`}
                          title={payment.notes || ""}
                        >
                          {payment.notes || "-"}
                        </TableCell>
                        <TableCell className={`${LOAN_TABLE_CELL_CLASS} text-right`}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => {
                                setEditingPayment(payment);
                                setPaymentDate(new Date(payment.date));
                                setAccountName(payment.accountName);
                                setNotes(payment.notes || "");
                                totalPaymentInput.handleInputChange(
                                  payment.totalPayment.toString(),
                                );
                                setAdjustsAccountBalance(
                                  payment.adjustsAccountBalance !== false,
                                );
                                setIsEditPaymentDialogOpen(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-red-900 hover:text-red-700"
                              onClick={() => {
                                setPaymentToDelete(payment);
                                setIsDeletePaymentModalOpen(true);
                              }}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <CustomModal
          isOpen={isPaymentDialogOpen}
          onClose={closeRecordPaymentModal}
          title="Record Loan Payment"
          maxWidth="2xl"
          className="p-0"
        >
          <div className="px-6 pb-6">
            <div className="space-y-4">
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

                  <div className="space-y-2">
                    <Label htmlFor="payment-amount" className="text-sm">Total Payment Amount</Label>
                    <CalculatorInput
                      id="payment-amount"
                      value={totalPaymentInput.displayValue}
                      onChange={(value) => {
                        totalPaymentInput.handleInputChange(value);
                        if (formSubmitted && validationErrors.totalPayment) {
                          setValidationErrors({ ...validationErrors, totalPayment: "" });
                        }
                      }}
                      placeholder="0.00"
                      className={`text-sm ${formSubmitted && validationErrors.totalPayment ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                    />
                    {formSubmitted && validationErrors.totalPayment && (
                      <FormError message={validationErrors.totalPayment} />
                    )}
                  </div>

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

                  <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
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
                </div>
              </div>
            </CustomModal>

        <CustomModal
          isOpen={isEditPaymentDialogOpen}
          onClose={closeEditPaymentModal}
          title="Edit Loan Payment"
          maxWidth="2xl"
          className="p-0"
        >
          <div className="px-6 pb-6">
            <div className="space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="edit-payment-amount" className="text-sm">Total Payment Amount</Label>
                <CalculatorInput
                  id="edit-payment-amount"
                  value={totalPaymentInput.displayValue}
                  onChange={(value) => {
                    totalPaymentInput.handleInputChange(value);
                    if (formSubmitted && validationErrors.totalPayment) {
                      setValidationErrors({ ...validationErrors, totalPayment: "" });
                    }
                  }}
                  placeholder="0.00"
                  className={`text-sm ${formSubmitted && validationErrors.totalPayment ? "border-red-800 focus-visible:ring-red-800" : ""}`}
                />
                {formSubmitted && validationErrors.totalPayment && (
                  <FormError message={validationErrors.totalPayment} />
                )}
              </div>

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

              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
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
            </div>
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
            
            try {
              await deletePayment(paymentToDelete.id);
              toast.success("Payment deleted successfully");
              setIsDeletePaymentModalOpen(false);
              setTimeout(() => {
                setPaymentToDelete(null);
              }, 300);
            } catch (error: any) {
              toast.error("Failed to delete payment. Please try again.");
            }
          }}
          isDeleting={isDeleting}
        />

      <section className="rounded-xl border border-gray-200 bg-muted/20 p-4 dark:border-border dark:bg-muted/10">
        <h5 className="mb-3 text-sm font-semibold text-primary">
          Net {isBorrowed ? "cost" : "gain"} summary
        </h5>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center justify-between gap-4">
            <span>Total interest {isBorrowed ? "paid" : "earned"}</span>
            <span className={cn("font-medium", textColorClass)}>
              {formatCurrency(totalInterestPaid, loan.outstandingBalanceCurrency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-2 dark:border-border">
            <span className="font-semibold text-foreground">
              Net {isBorrowed ? "cost" : "gain"}
            </span>
            <span className={cn("text-base font-semibold", textColorClass)}>
              {isBorrowed
                ? `-${formatCurrency(netCost, loan.outstandingBalanceCurrency)}`
                : `+${formatCurrency(netCost, loan.outstandingBalanceCurrency)}`}
            </span>
          </div>
        </div>
      </section>
      </section>
    </div>
  );
};
