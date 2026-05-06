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
import { CalendarPopover } from "@/components/ui/calendar-popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ChevronDown, ChevronUp, Info } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn, formatCurrency as formatCurrencyWithCurrency, getNumberColor } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyPicker } from "@/components/ui/currency-picker";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { getCurrentRate } from "@/services/exchangeRates/queries";

interface AccountListProps {
  accounts: Account[];
  onEditAccount?: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void;
  /** Optional override for space currency (e.g. when not inside space context). */
  totalBalanceCurrency?: string;
}

const AccountList: React.FC<AccountListProps> = ({
  accounts,
  onEditAccount,
  onDeleteAccount,
  totalBalanceCurrency: totalBalanceCurrencyProp,
}) => {
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = totalBalanceCurrencyProp ?? currentSpace?.currency ?? "PHP";

  const { updateAccount, deleteAccount, adjustAccountBalance, accountCategoryOptions } = useAccounts();
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editedAccountName, setEditedAccountName] = useState("");
  const [editedBalanceCurrency, setEditedBalanceCurrency] = useState("PHP");
  const [newBalance, setNewBalance] = useState("");
  const [adjustmentDate, setAdjustmentDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [ratesToSpace, setRatesToSpace] = useState<Record<string, number>>({});
  const [ratesLoading, setRatesLoading] = useState(false);
  const [showConvertedForCurrency, setShowConvertedForCurrency] = useState<string | null>(null);

  // Helper function to parse balance string to number
  const parseBalance = (balance: string): number => {
    return parseFloat(balance) || 0;
  };

  // Unique account currencies (for fetching rates)
  const accountCurrencies = React.useMemo(() => {
    const set = new Set<string>();
    for (const account of accounts) {
      set.add(account.balanceCurrency ?? "PHP");
    }
    return Array.from(set);
  }, [accounts]);

  // Fetch today's rates from each account currency to space currency
  React.useEffect(() => {
    const needRates = accountCurrencies.filter((c) => c !== spaceCurrency);
    if (needRates.length === 0) {
      setRatesToSpace({ [spaceCurrency]: 1 });
      setRatesLoading(false);
      return;
    }
    setRatesLoading(true);
    const todayStr = new Date().toISOString().slice(0, 10);
    Promise.all(
      needRates.map((fromCurrency) =>
        getCurrentRate(api, fromCurrency, spaceCurrency, todayStr)
          .then((data) => ({ fromCurrency, rate: Number(data.rate) }))
          .catch(() => ({ fromCurrency, rate: 1 }))
      )
    )
      .then((results) => {
        const map: Record<string, number> = { [spaceCurrency]: 1 };
        for (const { fromCurrency, rate } of results) {
          map[fromCurrency] = rate;
        }
        setRatesToSpace(map);
      })
      .catch(() => setRatesToSpace({ [spaceCurrency]: 1 }))
      .finally(() => setRatesLoading(false));
  }, [api, spaceCurrency, accountCurrencies.join(",")]);

  // Total balance converted to space currency using today's rates
  const totalInSpaceCurrency = React.useMemo(() => {
    return accounts.reduce((sum, account) => {
      const currency = account.balanceCurrency ?? "PHP";
      const rate = ratesToSpace[currency] ?? 1;
      return sum + parseBalance(account.balance) * rate;
    }, 0);
  }, [accounts, ratesToSpace]);

  // Balance per currency (for "more info"), up to 3 currencies
  const balancesByCurrency = React.useMemo(() => {
    const byCurrency = new Map<string, number>();
    for (const account of accounts) {
      const code = account.balanceCurrency ?? "PHP";
      const current = byCurrency.get(code) ?? 0;
      byCurrency.set(code, current + parseBalance(account.balance));
    }
    return Array.from(byCurrency.entries())
      .map(([currency, total]) => ({ currency, total }))
      .slice(0, 3);
  }, [accounts]);

  // Helper function to get category label from category value
  const getCategoryLabel = (categoryValue: string): string => {
    const category = accountCategoryOptions.find(option => option.value === categoryValue);
    return category ? category.label : categoryValue;
  };

  // Handle opening the edit dialog
  const handleOpenEditDialog = (account: Account) => {
    setActiveAccount(account);
    setEditedAccountName(account.name);
    setEditedBalanceCurrency(account.balanceCurrency ?? "PHP");
    setNewBalance(account.balance);
    const today = new Date().toISOString().split("T")[0];
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
    const currentCurrency = activeAccount.balanceCurrency ?? "PHP";
    const nameChanged = editedAccountName.trim() !== activeAccount.name;
    const balanceChanged = newBalanceNum !== currentBalance;
    const currencyChanged = editedBalanceCurrency !== currentCurrency;

    if (!nameChanged && !balanceChanged && !currencyChanged) {
      toast.info("No changes to save");
      setShowEditDialog(false);
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);

    try {
      // Update name and/or currency if changed
      if (nameChanged || currencyChanged) {
        const updateData: { name: string; balanceCurrency?: string } = {
          name: editedAccountName.trim(),
        };
        if (currencyChanged) {
          updateData.balanceCurrency = editedBalanceCurrency;
        }
        await updateAccount({
          accountId: activeAccount.id,
          updateData,
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
      } else if (nameChanged || currencyChanged) {
        const parts = [];
        if (nameChanged) parts.push(`name to "${editedAccountName.trim()}"`);
        if (currencyChanged) parts.push(`currency to ${editedBalanceCurrency}`);
        toast.success(`Account updated: ${parts.join(", ")}`);
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
      <div className="flex flex-col gap-2">
        <div className="flex justify-end">
          <div className="text-xl text-right">
            <div className="text-sm text-muted-foreground font-normal">
              Total
              {accountCurrencies.length > 1 && (
                <span className="font-normal"> (in {spaceCurrency})</span>
              )}
            </div>
            {ratesLoading ? (
              <span className="font-medium text-muted-foreground">…</span>
            ) : (
              <span className={`font-medium ${getNumberColor(totalInSpaceCurrency)}`}>
                {formatCurrencyWithCurrency(totalInSpaceCurrency, spaceCurrency)}
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-medium">Your Accounts</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground -mr-2"
            onClick={() => setShowMoreInfo((v) => !v)}
          >
            {showMoreInfo ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show less
              </>
            ) : (
              <>
                <Info className="h-4 w-4 mr-1" />
                Show more information
              </>
            )}
          </Button>
        </div>
        {showMoreInfo && balancesByCurrency.length > 0 && (
          <div className="rounded-md border border-gray-200 bg-muted/30 p-3 space-y-1.5">
            {balancesByCurrency.map(({ currency, total }) => {
              const isSpaceCurrency = currency === spaceCurrency;
              const rate = ratesToSpace[currency] ?? 1;
              const convertedInSpace = total * rate;
              const showConverted = showConvertedForCurrency === currency;
              return (
                <div key={currency} className="space-y-0.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{currency}</span>
                    {isSpaceCurrency ? (
                      <span className={`font-medium ${getNumberColor(total)}`}>
                        {formatCurrencyWithCurrency(total, currency)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setShowConvertedForCurrency((c) =>
                            c === currency ? null : currency
                          )
                        }
                        className={cn(
                          "font-medium text-left hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded",
                          getNumberColor(total)
                        )}
                        title={`Show equivalent in ${spaceCurrency}`}
                      >
                        {formatCurrencyWithCurrency(total, currency)}
                      </button>
                    )}
                  </div>
                  {!isSpaceCurrency && showConverted && !ratesLoading && (
                    <div className="text-xs text-muted-foreground pl-1 flex justify-end">
                      ≈ {formatCurrencyWithCurrency(convertedInSpace, spaceCurrency)}{" "}
                      <span className="italic">(today&apos;s rate)</span>
                    </div>
                  )}
                </div>
              );
            })}
            {accountCurrencies.length > 1 && !ratesLoading && (
              <div className="flex justify-between items-center text-sm pt-1.5 border-t border-gray-200 mt-1.5">
                <span className="text-muted-foreground font-medium">
                  Total (in {spaceCurrency})
                </span>
                <span className={`font-medium ${getNumberColor(totalInSpaceCurrency)}`}>
                  {formatCurrencyWithCurrency(totalInSpaceCurrency, spaceCurrency)}
                </span>
              </div>
            )}
          </div>
        )}
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
                  {formatCurrencyWithCurrency(balanceAmount, account.balanceCurrency ?? "PHP")}
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
              <Label htmlFor="current-balance">Current Balance</Label>
              <Input
                id="current-balance"
                value={
                  activeAccount
                    ? formatCurrencyWithCurrency(
                        parseBalance(activeAccount.balance),
                        activeAccount.balanceCurrency ?? "PHP"
                      )
                    : ""
                }
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
              <CalendarPopover
                open={calendarOpen}
                onOpenChange={setCalendarOpen}
                align="start"
                trigger={
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
                }
              >
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
              </CalendarPopover>
            </div>
            {activeAccount && newBalance && parseFloat(newBalance) !== parseBalance(activeAccount.balance) && (
              <div className="text-sm p-3 rounded-md bg-blue-50 border border-blue-200">
                <strong>Note:</strong> This will create a{" "}
                <span className="font-semibold">
                  {parseFloat(newBalance) > parseBalance(activeAccount.balance) ? "Income" : "Expense"} Adjustment
                </span>{" "}
                transaction for{" "}
                <span className="font-semibold">
                  {formatCurrencyWithCurrency(
                    Math.abs(parseFloat(newBalance) - parseBalance(activeAccount.balance)),
                    editedBalanceCurrency ?? "PHP"
                  )}
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
