import { atom } from 'jotai';
import { atomWithMutation } from 'jotai-tanstack-query';
import { createAccount, CreateAccountType } from '@/services/transactions/accounts/mutation';
import { accountOptionsAtom } from '@/atoms/dashboardAtoms';
import { extractFieldErrors } from '@/utils/errorUtils';

// Input atoms for new account
export const newAccountNameAtom = atom<string>('');
export const newAccountBalanceAtom = atom<string>('');

// Atom for storing field validation errors
export const accountValidationErrorsAtom = atom<Record<string, string[]>>({});

// Validation for the balance field
export const validateBalance = (balance: string): string[] => {
  const errors: string[] = [];
  
  // Check if empty
  if (!balance.trim()) {
    errors.push('Balance is required');
    return errors;
  }
  
  // Parse the number
  const numericValue = parseFloat(balance);
  
  // Check if it's a valid number
  if (isNaN(numericValue)) {
    errors.push('Balance must be a valid number');
    return errors;
  }
  
  // Check if it's positive
  if (numericValue < 0) {
    errors.push('Balance must be a positive number');
  }
  
  // Check decimal places (only if it has decimals)
  if (balance.includes('.')) {
    const decimalPlaces = balance.split('.')[1]?.length || 0;
    if (decimalPlaces > 2) {
      errors.push('Balance can have a maximum of 2 decimal places');
    }
  }
  
  return errors;
};

// Type for mutation parameters
interface CreateAccountParams {
  api: any;
  accountData: CreateAccountType;
}

// Create a properly typed mutation atom
export const createAccountMutationAtom = atomWithMutation<any, CreateAccountParams>(() => ({
  mutationKey: ['createAccount'],
  mutationFn: async ({ api, accountData }) => {
    return await createAccount(api, accountData);
  }
}));

// Atom to handle create account operation and update UI state
export const createAccountAtom = atom(
  null, // read function not used
  async (get, set, { api, accountData }: CreateAccountParams) => {
    try {
      // Reset validation errors on new submission
      set(accountValidationErrorsAtom, {});
      
      // Validate the balance field
      const balanceErrors = validateBalance(accountData.balance.toString());
      if (balanceErrors.length > 0) {
        set(accountValidationErrorsAtom, { balance: balanceErrors });
        throw new Error('Validation failed');
      }
      
      // Get the mutation from the atom
      const mutation = get(createAccountMutationAtom);
      
      // Call the mutation
      const newAccount = await mutation.mutateAsync({ api, accountData });
      
      // Update the account options atom with the new account
      const currentOptions = get(accountOptionsAtom);
      
      // Check if account already exists
      const accountExists = currentOptions.some(
        option => option.value === accountData.name
      );
      
      // Only add if it doesn't exist already
      if (!accountExists) {
        const updatedOptions = [
          ...currentOptions,
          {
            label: accountData.name,
            value: accountData.name,
            currency: accountData.balanceCurrency ?? "PHP",
          },
        ];
        set(accountOptionsAtom, updatedOptions);
      }
      
      // Reset the input atoms
      set(newAccountNameAtom, '');
      set(newAccountBalanceAtom, '');
      
      // Return the name of the new account for selection in the form
      return newAccount.name;
    } catch (error) {
      console.error('Error creating account:', error);
      
      // Extract field validation errors
      const fieldErrors = extractFieldErrors(error);
      
      // Store field errors in atom for display in UI
      if (Object.keys(fieldErrors).length > 0) {
        set(accountValidationErrorsAtom, fieldErrors);
      }
      
      throw error;
    }
  }
); 
