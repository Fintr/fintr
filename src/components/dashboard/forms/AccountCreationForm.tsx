import React, { useState } from "react";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { FormError } from "@/components/ui/form-error";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useAtom, useSetAtom } from "jotai";
import { createAccountAtom, accountValidationErrorsAtom } from "@/atoms/accountAtoms";
import { toast } from "sonner";
import { extractFieldErrors } from "@/utils/errorUtils";
import { AccountCategory, accountCategoryLabels } from "@/types/accountTypes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";

interface AccountCreationFormProps {
  onSuccess: (name: string) => void;
  horizontal?: boolean; // Whether to display the form in horizontal layout
}

const AccountCreationForm: React.FC<AccountCreationFormProps> = ({ 
  onSuccess,
  horizontal = false 
}) => {
  const { api } = useAuthApi();
  const addAccount = useSetAtom(createAccountAtom);
  const [accountValidationErrors, setAccountValidationErrors] = useAtom(accountValidationErrorsAtom);
  const [accountName, setAccountName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [accountCategory, setAccountCategory] = useState<AccountCategory>(AccountCategory.CASH);
  const [isLoading, setIsLoading] = useState(false);
  const [localErrors, setLocalErrors] = useState<{ name?: string; balance?: string; accountCategory?: string }>({});

  const validateBalance = (balance: string): string | undefined => {
    if (!balance.trim()) return "Initial balance is required";
    const number = parseFloat(balance);
    if (isNaN(number)) return "Balance must be a number";
    if (number < 0) return "Balance must be a positive number";
    if (balance.includes('.') && balance.split('.')[1]?.length > 2) {
      return "Balance can have a maximum of 2 decimal places";
    }
    return undefined; // No error
  };

  const handleAddAccount = async () => {
    const newErrors: { name?: string; balance?: string; accountCategory?: string } = {};
    if (!accountName.trim()) {
      newErrors.name = "Account name is required";
    }
    const balanceError = validateBalance(initialBalance);
    if (balanceError) {
      newErrors.balance = balanceError;
    }
    if (!accountCategory) {
      newErrors.accountCategory = "Account category is required";
    }

    setLocalErrors(newErrors);

    // If there are local errors, stop submission
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsLoading(true);
    setAccountValidationErrors({}); // Clear previous API errors

    try {
      const createdAccountName = await addAccount({
        api,
        accountData: {
          name: accountName,
          balance: parseFloat(initialBalance), // Already validated
          accountCategory: accountCategory
        }
      });

      toast.success(`"${accountName}" has been added to your accounts`);

      // Store the final account name
      const finalAccountName = createdAccountName || accountName;
      
      // Reset inputs first
      setAccountName('');
      setInitialBalance('');
      setAccountCategory(AccountCategory.CASH);
      
      // Delay onSuccess to ensure state updates have completed
      setTimeout(() => {
        onSuccess(finalAccountName);
      }, 100); 

    } catch (error) {
      console.error("Failed to create account:", error);
      const fieldErrors = extractFieldErrors(error);
      setAccountValidationErrors(fieldErrors);

      if (!fieldErrors.name && !fieldErrors.balance && !fieldErrors.accountCategory) {
        toast.error("Failed to create account. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="mt-3 p-3 border border-gray-200 rounded-md bg-gray-50">
      <div className={horizontal ? "flex gap-4 items-end" : "space-y-2"}>
        <div className={horizontal ? "flex-1" : "space-y-2"}>
          <Label htmlFor="new-account-name">Account Name</Label>
          <Input 
            id="new-account-name" 
            placeholder="Enter new account name" 
            value={accountName} 
            onChange={(e) => { 
              setAccountName(e.target.value);
              if (localErrors.name) setLocalErrors({...localErrors, name: undefined});
            }} 
            disabled={isLoading} 
            className={localErrors.name || accountValidationErrors.name ? "border-red-500 focus-visible:ring-red-500 bg-white" : "bg-white"} 
          />
          {localErrors.name && <FormError>{localErrors.name}</FormError>}
          {!localErrors.name && accountValidationErrors.name && (
            <FormError>
              {Array.isArray(accountValidationErrors.name) 
                ? accountValidationErrors.name[0] 
                : String(accountValidationErrors.name)}
            </FormError>
          )}
        </div>
      </div>

      <div className={horizontal ? "flex gap-4 items-end mt-2" : "space-y-2 mt-2"}>
        <div className={horizontal ? "flex-1" : "space-y-2"}>
          <Label htmlFor="new-account-category">Account Category</Label>
          <Select
            value={accountCategory}
            onValueChange={(value: AccountCategory) => {
              setAccountCategory(value);
              if (localErrors.accountCategory) setLocalErrors({...localErrors, accountCategory: undefined});
            }}
            disabled={isLoading}
          >
            <SelectTrigger 
              id="new-account-category"
              className={localErrors.accountCategory || accountValidationErrors.accountCategory ? "border-red-500 focus-visible:ring-red-500 bg-white" : "bg-white"}
            >
              <SelectValue placeholder="Select account category" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(AccountCategory).map((category) => (
                <SelectItem key={category} value={category}>
                  {accountCategoryLabels[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {localErrors.accountCategory && <FormError>{localErrors.accountCategory}</FormError>}
          {!localErrors.accountCategory && accountValidationErrors.accountCategory && (
            <FormError>
              {Array.isArray(accountValidationErrors.accountCategory) 
                ? accountValidationErrors.accountCategory[0] 
                : String(accountValidationErrors.accountCategory)}
            </FormError>
          )}
        </div>
        <div className={horizontal ? "flex-1" : "space-y-2 mt-2"}>
          <Label htmlFor="new-account-balance">Initial Balance</Label>
          <Input 
            id="new-account-balance" 
            type="number" 
            placeholder="0.00" 
            value={initialBalance} 
            onChange={(e) => { 
              setInitialBalance(e.target.value);
              if (localErrors.balance) setLocalErrors({...localErrors, balance: undefined});
            }} 
            disabled={isLoading} 
            className={localErrors.balance || accountValidationErrors.balance ? "border-red-500 focus-visible:ring-red-500 bg-white" : "bg-white"} 
          />
          {localErrors.balance && <FormError>{localErrors.balance}</FormError>}
          {!localErrors.balance && accountValidationErrors.balance && (
            <FormError>
              {Array.isArray(accountValidationErrors.balance) 
                ? accountValidationErrors.balance[0] 
                : String(accountValidationErrors.balance)}
            </FormError>
          )}
        </div>
      </div>
      
      {horizontal && (
        <div className="flex mt-4">
          <Button 
            type="button" 
            size="sm" 
            disabled={isLoading} 
            className="bg-[#0A3D62] hover:bg-[#0A3D62]/80 h-10" 
            onClick={handleAddAccount}
          >
            {isLoading ? (<>...</>) : ("Add")}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            className="ml-2 h-10" 
            onClick={() => { 
              setAccountName(''); 
              setInitialBalance(''); 
              setAccountCategory(AccountCategory.CASH);
              setLocalErrors({}); 
              setAccountValidationErrors({}); 
              onSuccess(""); 
            }} 
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      )}
      
      {!horizontal && (
        <div className="flex gap-2 mt-3">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => { 
              setAccountName(''); 
              setInitialBalance(''); 
              setAccountCategory(AccountCategory.CASH);
              setLocalErrors({}); 
              setAccountValidationErrors({}); 
              onSuccess(""); 
            }} 
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            size="sm" 
            disabled={isLoading} 
            className="bg-[#0A3D62] hover:bg-[#0A3D62]/80" 
            onClick={handleAddAccount}
          >
            {isLoading ? (<>...</>) : ("Add")}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AccountCreationForm; 
