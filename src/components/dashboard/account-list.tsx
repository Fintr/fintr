import React from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Account } from "@/types/accountTypes";
import EditAccountDialog from "./edit-account-dialog";
import DeleteAccountDialog from "./delete-account-dialog";
import { useAccounts } from "@/hooks/async/useAccounts";

interface AccountListProps {
  accounts: Account[];
  onEditAccount?: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void; // Made optional as it's now handled internally
  currencySymbol?: string;
}

const AccountList: React.FC<AccountListProps> = ({
  accounts,
  onEditAccount,
  onDeleteAccount,
  currencySymbol = "₱",
}) => {
  const { updateAccount, deleteAccount, accountCategoryOptions } = useAccounts();

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

  // Handle account update
  const handleUpdateAccount = async (accountId: string, newName: string) => {
    await updateAccount({
      accountId,
      updateData: { name: newName }
    });
  };

  // Handle account deletion
  const handleDeleteAccount = async (accountId: string) => {
    // The useAccounts hook already handles the toast notification and query invalidation
    // The dialog will handle displaying the error message if the deletion fails
    return await deleteAccount(accountId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-medium">Your Accounts</h3>
        <div className="text-xl">
          Total:{" "}
          <span className="font-medium" style={{ color: "#008080" }}>
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
                  className="text-lg font-medium"
                  style={{ color: balanceAmount < 0 ? "#800020" : "#008080" }}
                >
                  {formatCurrency(balanceAmount)}
                </span>
                <div className="ml-6 flex space-x-2">
                  <EditAccountDialog
                    account={account}
                    onUpdate={handleUpdateAccount}
                  />
                  <DeleteAccountDialog
                    account={account}
                    onDelete={handleDeleteAccount}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AccountList;
