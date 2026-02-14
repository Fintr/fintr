import React, { useState, useEffect } from "react";
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
import { CurrencyPicker } from "@/components/ui/currency-picker";
import { useNumberInput } from "@/hooks/useNumberInput";
import { getCurrencySymbol, numberFormatting } from "@/lib/utils";
import { Plus } from "lucide-react";
import { useAccounts } from "@/hooks/async/useAccounts";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";

export interface NewAccountData {
  name: string;
  balance: number;
  accountCategory: string;
  balanceCurrency?: string;
}

interface AddAccountFormProps {
  onAddAccount?: (accountData: NewAccountData) => void;
  currencySymbol?: string;
}

const AddAccountForm: React.FC<AddAccountFormProps> = ({
  onAddAccount,
  currencySymbol = "₱",
}) => {
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";
  const [name, setName] = useState("");
  const [accountCategory, setAccountCategory] = useState("");
  const [balanceCurrency, setBalanceCurrency] = useState(spaceCurrency);
  const balanceInput = useNumberInput();
  const { createAccount, isCreating, accountCategoryOptions } = useAccounts();

  useEffect(() => {
    setBalanceCurrency(spaceCurrency);
  }, [spaceCurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !accountCategory) return;

    const accountData = {
      name: name.trim(),
      balance: numberFormatting.cleanForBackend(balanceInput.displayValue),
      accountCategory: accountCategory,
      balanceCurrency: balanceCurrency,
    };

    try {
      await createAccount(accountData);

    // Reset form
    setName("");
    balanceInput.reset();
    setAccountCategory("");
    setBalanceCurrency(spaceCurrency);
      
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
            className="bg-white"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-category">Account Category</Label>
          <Select value={accountCategory} onValueChange={setAccountCategory} >
            <SelectTrigger id="account-category" className="bg-white">
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
          <CurrencyPicker
            label="Currency"
            placeholder="Search by name or code (e.g. PHP, US Dollar)..."
            value={balanceCurrency}
            onChange={setBalanceCurrency}
            disabled={isCreating}
            className="bg-white"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="current-balance">Current Balance</Label>
          <div className="relative h-9">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm leading-none">
              {getCurrencySymbol(balanceCurrency)}
              {"\u00A0"}
            </span>
            <Input
              id="current-balance"
              type="text"
              inputMode="decimal"
              className={
                getCurrencySymbol(balanceCurrency).length > 1
                  ? "pl-16 bg-white"
                  : "pl-8 bg-white"
              }
              placeholder="0.00"
              value={balanceInput.displayValue}
              onChange={(e) => balanceInput.handleInputChange(e.target.value)}
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
