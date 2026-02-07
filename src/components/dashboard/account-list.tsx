import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import EditButton from "@/components/ui/edit-button";
import { DeleteButton } from "@/components/dashboard/tabs/transactions/buttons/DeleteButton";
import { Account } from "@/types/accountTypes";
import { useAccounts } from "@/hooks/async/useAccounts";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn, getNumberColor } from "@/lib/utils";

interface AccountListProps {
  accounts: Account[];
  onEditAccount?: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void;
  currencySymbol?: string;
}

const AccountList: React.FC<AccountListProps> = ({
  accounts,
  onEditAccount,
  onDeleteAccount,
  currencySymbol = "₱",
}) => {
  const { updateAccount, deleteAccount, adjustAccountBalance, accountCategoryOptions } = useAccounts();
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editedAccountName, setEditedAccountName] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [adjustmentDate, setAdjustmentDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Helper function to parse balance string to number
  const parseBalance = (balance: string): number => {
    return parseFloat(balance) || 0;
  };

  // Calculate total balance
  const totalBalance = accounts.reduce(
    (sum, account) => sum + parseBalance(account.balance),
    0,
  );

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return `${amount < 0 ? "-" : ""}${currencySymbol}${Math.abs(amount).toLocaleString()}`;
  };

  // Helper function to get category label from category value
  const getCategoryLabel = (categoryValue: string): string => {
    const category = accountCategoryOptions.find(option => option.value === categoryValue);
    return category ? category.label : categoryValue;
  };

  // Handle opening the edit dialog
  const handleOpenEditDialog = (account: Account) => {
    setActiveAccount(account);
    setEditedAccountName(account.name);
    setNewBalance(account.balance);
    const today = new Date().toISOString().split('T')[0];
    setAdjustmentDate(today);
    setErrorMessage(null);
    setShowEditDialog(true);
  };

  // Handle opening the delete dialog
  const handleOpenDeleteDialog = (account: Account) => {
    setActiveAccount(account);
    setErrorMessage(null);
    setShowDeleteDialog(true);
  };


  // Handle account update (name and/or balance)
  const handleUpdateAccount = async () => {
    if (!activeAccount) return;
    
    if (!editedAccountName.trim()) {
      toast.error("Account name cannot be empty");
      return;
    }

    const newBalanceNum = parseFloat(newBalance);
    if (isNaN(newBalanceNum)) {
      toast.error("Please enter a valid balance");
      return;
    }

    if (!adjustmentDate) {
      toast.error("Please select an adjustment date");
      return;
    }

    const currentBalance = parseBalance(activeAccount.balance);
    const nameChanged = editedAccountName.trim() !== activeAccount.name;
    const balanceChanged = newBalanceNum !== currentBalance;

    if (!nameChanged && !balanceChanged) {
      toast.info("No changes to save");
      setShowEditDialog(false);
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);
    
    try {
      // Update name if changed
      if (nameChanged) {
        await updateAccount({
          accountId: activeAccount.id,
          updateData: { name: editedAccountName.trim() }
        });
      }

      // Adjust balance if changed
      if (balanceChanged) {
        await adjustAccountBalance({
          accountId: activeAccount.id,
          adjustmentData: {
            newBalance: newBalanceNum,
            adjustmentDate: adjustmentDate
          }
        });
      }

      // Success message
      if (nameChanged && balanceChanged) {
        const difference = newBalanceNum - currentBalance;
        const adjustmentType = difference > 0 ? "Income" : "Expense";
        toast.success(`Account updated and balance adjusted. ${adjustmentType} Adjustment transaction created.`);
      } else if (nameChanged) {
        toast.success(`Account updated to "${editedAccountName.trim()}"`);
      } else {
        const difference = newBalanceNum - currentBalance;
        const adjustmentType = difference > 0 ? "Income" : "Expense";
        toast.success(`Balance adjusted successfully. ${adjustmentType} Adjustment transaction created.`);
      }
      
      setShowEditDialog(false);
    } catch (error: any) {
      console.error("Failed to update account:", error);
      const backendMessage = error?.error?.details?.message || error?.error?.message || "Failed to update account";
      setErrorMessage(backendMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (!activeAccount) return;
    
    setIsDeleting(true);
    setErrorMessage(null);
    
    try {
      const response = await deleteAccount(activeAccount.id);

      if (response?.success === true) {
        toast.success(`Account "${activeAccount.name}" has been deleted`);
        setShowDeleteDialog(false);
        setErrorMessage(null);
      } else {
        const backendMessage = response?.error?.details?.account || response?.error?.message || "Failed to delete account.";
        setErrorMessage(backendMessage);
      }
    } catch (error: any) {
      const errorMessageText = "An unexpected error occurred. Please try again.";
      setErrorMessage(errorMessageText);
    } finally {
      setIsDeleting(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-medium">Your Accounts</h3>
        <div className="text-xl">
          Total:{" "}
          <span className={`font-medium ${getNumberColor(totalBalance)}`}>
            {formatCurrency(totalBalance)}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {accounts.map((account) => {
          const balanceAmount = parseBalance(account.balance);
          return (
            <div
              key={account.id}
              className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
            >
              <div className="flex items-center">
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-gray-500">{getCategoryLabel(account.accountCategory)}</p>
                </div>
              </div>
              <div className="flex items-center">
                <span
                  className={`text-lg font-medium ${getNumberColor(balanceAmount)}`}
                >
                  {formatCurrency(balanceAmount)}
                </span>
                <div className="ml-6">
                  <div className="flex gap-1">
                    <EditButton onClick={() => handleOpenEditDialog(account)} />
                    <DeleteButton onClick={() => handleOpenDeleteDialog(account)} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Account Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-name">Account Name</Label>
              <Input
                id="account-name"
                value={editedAccountName}
                onChange={(e) => setEditedAccountName(e.target.value)}
                placeholder="Enter account name"
                disabled={isUpdating}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current-balance">Current Balance</Label>
              <Input
                id="current-balance"
                value={activeAccount ? formatCurrency(parseBalance(activeAccount.balance)) : ""}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-balance">New Balance</Label>
              <Input
                id="new-balance"
                type="number"
                step="0.01"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                placeholder="Enter new balance"
                disabled={isUpdating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustment-date">Adjustment Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="adjustment-date"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !adjustmentDate && "text-muted-foreground"
                    )}
                    disabled={isUpdating}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {adjustmentDate ? format(new Date(adjustmentDate), "MMM d, yyyy") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={adjustmentDate ? new Date(adjustmentDate) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setAdjustmentDate(format(date, "yyyy-MM-dd"));
                        setCalendarOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {activeAccount && newBalance && parseFloat(newBalance) !== parseBalance(activeAccount.balance) && (
              <div className="text-sm p-3 rounded-md bg-blue-50 border border-blue-200">
                <strong>Note:</strong> This will create a{" "}
                <span className="font-semibold">
                  {parseFloat(newBalance) > parseBalance(activeAccount.balance) ? "Income" : "Expense"} Adjustment
                </span>{" "}
                transaction for{" "}
                <span className="font-semibold">
                  {formatCurrency(Math.abs(parseFloat(newBalance) - parseBalance(activeAccount.balance)))}
                </span>
              </div>
            )}
            {errorMessage && (
              <div className="text-sm text-red-900 bg-red-100/50 p-3 rounded-md border border-red-300">
                <strong>Error:</strong> {errorMessage}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleUpdateAccount}
                disabled={isUpdating || !editedAccountName.trim() || !newBalance || !adjustmentDate}
              >
                {isUpdating ? "Updating..." : "Update"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Are you sure you want to delete the account{" "}
              <span className="font-semibold text-gray-900">"{activeAccount?.name}"</span>?
            </div>

            {errorMessage && (
              <div className="text-sm text-red-900 bg-red-100/50 p-3 rounded-md border border-red-300">
                <strong>Error:</strong> {errorMessage}
              </div>
            )}          

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountList;
