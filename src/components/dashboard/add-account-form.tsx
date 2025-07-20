import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useAccounts } from "@/hooks/async/useAccounts";

export interface NewAccountData {
  name: string;
  balance: number;
  accountCategory: string;
}

interface AddAccountFormProps {
  onAddAccount?: (accountData: NewAccountData) => void;
  currencySymbol?: string;
}

const AddAccountForm: React.FC<AddAccountFormProps> = ({
  onAddAccount,
  currencySymbol = "₱",
}) => {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [accountCategory, setAccountCategory] = useState("");
  const { createAccount, isCreating, accountCategoryOptions } = useAccounts();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !accountCategory) return;

    const accountData = {
      name: name.trim(),
      balance: parseFloat(balance) || 0,
      accountCategory: accountCategory,
    };

    try {
      await createAccount(accountData);
      
      // Reset form
      setName("");
      setBalance("");
      setAccountCategory("");
      
      // Call the optional callback if provided
      if (onAddAccount) {
        onAddAccount(accountData);
      }
    } catch (error) {
      console.error('Failed to create account:', error);
      // Error handling is already done in the hook with toast
    }
  };

  return (
    <div>
      <h3 className="text-xl font-medium mb-4">Add New Account</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="account-name">Account Name</Label>
          <Input
            id="account-name"
            placeholder="e.g., BPI Savings"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isCreating}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-category">Account Category</Label>
          <Select value={accountCategory} onValueChange={setAccountCategory}>
            <SelectTrigger id="account-category">
              <SelectValue placeholder="Select account category" />
            </SelectTrigger>
            <SelectContent>
              {accountCategoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="current-balance">Current Balance</Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5">{currencySymbol}</span>
            <Input
              id="current-balance"
              type="number"
              step="0.01"
              className="pl-7"
              placeholder="0.00"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              disabled={isCreating}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary/80"
          disabled={isCreating || !name.trim() || !accountCategory}
        >
          <Plus className="h-4 w-4 mr-2" /> 
          {isCreating ? "Adding Account..." : "Add Account"}
        </Button>
      </form>
    </div>
  );
};

export default AddAccountForm;
