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

export interface NewAccountData {
  name: string;
  type: string;
  balance: number;
}

interface AddAccountFormProps {
  onAddAccount: (accountData: NewAccountData) => void;
  currencySymbol?: string;
}

const AddAccountForm: React.FC<AddAccountFormProps> = ({
  onAddAccount,
  currencySymbol = "₱",
}) => {
  const [name, setName] = useState("");
  const [type, setType] = useState("Bank Account");
  const [balance, setBalance] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddAccount({
      name: name.trim(),
      type,
      balance: parseFloat(balance) || 0,
    });

    // Reset form
    setName("");
    setType("Bank Account");
    setBalance("");
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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-type">Account Category</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="account-type">
              <SelectValue placeholder="Select account category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="Savings">Savings</SelectItem>
              <SelectItem value="Debit">Debit</SelectItem>
              <SelectItem value="Credit Card">Credit Card</SelectItem>
              <SelectItem value="E-Wallet">E-Wallet</SelectItem>
              <SelectItem value="Loan">Loan</SelectItem>
              <SelectItem value="Investment">Investment</SelectItem>
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
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-primary hover:bg-primary/80"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Account
        </Button>
      </form>
    </div>
  );
};

export default AddAccountForm;
