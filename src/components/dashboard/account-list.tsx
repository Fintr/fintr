import React from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
}

interface AccountListProps {
  accounts: Account[];
  onEditAccount: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
  currencySymbol?: string;
}

const AccountList: React.FC<AccountListProps> = ({
  accounts,
  onEditAccount,
  onDeleteAccount,
  currencySymbol = "₱",
}) => {
  // Calculate total balance
  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.balance,
    0,
  );

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return `${amount < 0 ? "-" : ""}${currencySymbol}${Math.abs(amount).toLocaleString()}`;
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
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200"
          >
            <div className="flex items-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mr-4"
                style={{ backgroundColor: account.color }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                </svg>
              </div>
              <div>
                <p className="font-medium">{account.name}</p>
                <p className="text-sm text-gray-500">{account.type}</p>
              </div>
            </div>
            <div className="flex items-center">
              <span
                className="text-lg font-medium"
                style={{ color: account.balance < 0 ? "#800020" : "#008080" }}
              >
                {formatCurrency(account.balance)}
              </span>
              <div className="ml-6 flex space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEditAccount(account)}
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteAccount(account)}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccountList;
