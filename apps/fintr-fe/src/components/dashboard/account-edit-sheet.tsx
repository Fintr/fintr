"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalculatorInput } from "@/components/ui/calculator-input";
import { Label } from "@/components/ui/label";
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  cn,
  formatCurrency as formatCurrencyWithCurrency,
  getCurrencySymbol,
  numberFormatting,
} from "@/lib/utils";
import { CurrencyPicker } from "@/components/ui/currency-picker";
import { useAccounts } from "@/hooks/async/useAccounts";
import { useNumberInput } from "@/hooks/useNumberInput";
import { Account } from "@/types/accountTypes";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AccountEditSheetProps = {
  account: Account | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

const AccountEditSheet: React.FC<AccountEditSheetProps> = ({
  account,
  open,
  onOpenChange,
  onSaved,
}) => {
  const { updateAccount, adjustAccountBalance } = useAccounts();
  const [editedAccountName, setEditedAccountName] = useState("");
  const [editedBalanceCurrency, setEditedBalanceCurrency] = useState("PHP");
  const newBalanceInput = useNumberInput();
  const [adjustmentDate, setAdjustmentDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (!account || !open) return;
    setEditedAccountName(account.name);
    setEditedBalanceCurrency(account.balanceCurrency ?? "PHP");
    newBalanceInput.setDisplayValue(
      numberFormatting.formatForInput(account.balance),
    );
    setAdjustmentDate(new Date().toISOString().split("T")[0]);
    setErrorMessage(null);
  }, [account, open]);

  const parseBalance = (balance: string): number => {
    return parseFloat(balance) || 0;
  };

  const handleUpdateAccount = async () => {
    if (!account) return;

    if (!editedAccountName.trim()) {
      toast.error("Account name cannot be empty");
      return;
    }

    if (!newBalanceInput.displayValue) {
      toast.error("Please enter a valid balance");
      return;
    }

    const newBalanceNum = numberFormatting.cleanForBackend(
      newBalanceInput.displayValue,
    );

    if (!adjustmentDate) {
      toast.error("Please select an adjustment date");
      return;
    }

    const currentBalance = parseBalance(account.balance);
    const currentCurrency = account.balanceCurrency ?? "PHP";
    const nameChanged = editedAccountName.trim() !== account.name;
    const balanceChanged = newBalanceNum !== currentBalance;
    const currencyChanged = editedBalanceCurrency !== currentCurrency;

    if (!nameChanged && !balanceChanged && !currencyChanged) {
      toast.info("No changes to save");
      onOpenChange(false);
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);

    try {
      if (nameChanged || currencyChanged) {
        const updateData: { name: string; balanceCurrency?: string } = {
          name: editedAccountName.trim(),
        };
        if (currencyChanged) {
          updateData.balanceCurrency = editedBalanceCurrency;
        }
        await updateAccount({
          accountId: account.id,
          updateData,
        });
      }

      if (balanceChanged) {
        await adjustAccountBalance({
          accountId: account.id,
          adjustmentData: {
            newBalance: newBalanceNum,
            adjustmentDate,
          },
        });
      }

      if (nameChanged && balanceChanged) {
        const difference = newBalanceNum - currentBalance;
        const adjustmentType = difference > 0 ? "Income" : "Expense";
        toast.success(
          `Account updated and balance adjusted. ${adjustmentType} Adjustment transaction created.`,
        );
      } else if (nameChanged || currencyChanged) {
        const parts = [];
        if (nameChanged) parts.push(`name to "${editedAccountName.trim()}"`);
        if (currencyChanged) parts.push(`currency to ${editedBalanceCurrency}`);
        toast.success(`Account updated: ${parts.join(", ")}`);
      } else {
        const difference = newBalanceNum - currentBalance;
        const adjustmentType = difference > 0 ? "Income" : "Expense";
        toast.success(
          `Balance adjusted successfully. ${adjustmentType} Adjustment transaction created.`,
        );
      }

      onOpenChange(false);
      onSaved?.();
    } catch (error: unknown) {
      console.error("Failed to update account:", error);
      const err = error as {
        error?: { details?: { message?: string }; message?: string };
      };
      const backendMessage =
        err?.error?.details?.message ||
        err?.error?.message ||
        "Failed to update account";
      setErrorMessage(backendMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const newBalanceNum = numberFormatting.cleanForBackend(
    newBalanceInput.displayValue,
  );
  const currentBalanceNum = account ? parseBalance(account.balance) : 0;
  const balanceChangedPreview =
    Boolean(account && newBalanceInput.displayValue) &&
    newBalanceNum !== currentBalanceNum;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col overflow-hidden min-h-0 max-h-[100dvh]"
        swipeToClose
        onSwipeToClose={() => onOpenChange(false)}
      >
        <SheetHeader className="text-left shrink-0">
          <SheetTitle>Edit account</SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-2 py-2 -mx-2 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-account-name">Account Name</Label>
            <Input
              id="edit-account-name"
              value={editedAccountName}
              onChange={(e) => setEditedAccountName(e.target.value)}
              placeholder="Enter account name"
              disabled={isUpdating}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <CurrencyPicker
              label="Currency"
              placeholder="Search by name or code (e.g. PHP, US Dollar)..."
              value={editedBalanceCurrency}
              onChange={setEditedBalanceCurrency}
              disabled={isUpdating}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-current-balance">Current Balance</Label>
            <Input
              id="edit-current-balance"
              value={
                account
                  ? formatCurrencyWithCurrency(
                      parseBalance(account.balance),
                      account.balanceCurrency ?? "PHP",
                    )
                  : ""
              }
              disabled
              readOnly
              className={cn(
                "bg-muted/50 text-foreground",
                "disabled:cursor-default disabled:opacity-100",
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-new-balance">New Balance</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm leading-none z-10">
                {getCurrencySymbol(editedBalanceCurrency)}
                {"\u00A0"}
              </span>
              <CalculatorInput
                id="edit-new-balance"
                className={
                  getCurrencySymbol(editedBalanceCurrency).length > 1
                    ? "pl-16"
                    : "pl-8"
                }
                value={newBalanceInput.displayValue}
                onChange={(value) => newBalanceInput.handleInputChange(value)}
                placeholder="0.00"
                disabled={isUpdating}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-adjustment-date">Adjustment Date</Label>
            <CalendarPopover
              open={calendarOpen}
              onOpenChange={setCalendarOpen}
              align="start"
              trigger={
                <Button
                  id="edit-adjustment-date"
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !adjustmentDate && "text-muted-foreground",
                  )}
                  disabled={isUpdating}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {adjustmentDate ? (
                    format(new Date(adjustmentDate), "MMM d, yyyy")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              }
            >
              <Calendar
                mode="single"
                selected={
                  adjustmentDate ? new Date(adjustmentDate) : undefined
                }
                onSelect={(date) => {
                  if (date) {
                    setAdjustmentDate(format(date, "yyyy-MM-dd"));
                    setCalendarOpen(false);
                  }
                }}
                autoFocus
              />
            </CalendarPopover>
          </div>
          {account && balanceChangedPreview && (
              <div className="text-sm p-3 rounded-md bg-blue-50 border border-blue-200">
                <strong>Note:</strong> This will create a{" "}
                <span className="font-semibold">
                  {newBalanceNum > currentBalanceNum
                    ? "Income"
                    : "Expense"}{" "}
                  Adjustment
                </span>{" "}
                transaction for{" "}
                <span className="font-semibold">
                  {formatCurrencyWithCurrency(
                    Math.abs(newBalanceNum - currentBalanceNum),
                    editedBalanceCurrency ?? "PHP",
                  )}
                </span>
              </div>
            )}
          {errorMessage && (
            <div className="text-sm text-red-900 bg-red-100/50 p-3 rounded-md border border-red-300">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpdateAccount}
              disabled={
                isUpdating ||
                !editedAccountName.trim() ||
                !newBalanceInput.displayValue ||
                !adjustmentDate
              }
            >
              {isUpdating ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AccountEditSheet;
