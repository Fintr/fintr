import { atom } from 'jotai';
import { atomWithMutation } from 'jotai-tanstack-query';
import { createTransfer, CreateTransferType } from '@/services/transactions/transfers/mutation';
import { accountOptionsAtom } from '@/atoms/dashboardAtoms';
import { extractFieldErrors } from '@/utils/errorUtils';
import { AxiosInstance } from 'axios';
import { ScheduleTypeEnum } from '@/constants/transactionConstants';

// Input atoms for transfer form
export const transferAmountAtom = atom('');
export const transferTransactionCostAtom = atom('');
export const transferDescriptionAtom = atom('');
export const transferFromAccountNameAtom = atom('');
export const transferToAccountNameAtom = atom('');
export const transferScheduleTypeAtom = atom<ScheduleTypeEnum>(ScheduleTypeEnum.ONE_TIME);
export const transferRepeatIntervalAtom = atom('');

// Atom for storing field validation errors
export const transferValidationErrorsAtom = atom<Record<string, string[]>>({});

// Validate number fields
const validateAmount = (amount: string): string[] => {
  const errors: string[] = [];
  if (!amount || amount.trim() === '') {
    errors.push('Amount is required');
    return errors;
  }
  
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    errors.push('Amount must be a number');
  } else if (numAmount <= 0) {
    errors.push('Amount must be greater than zero');
  }
  
  return errors;
};

// Validate transaction cost
const validateTransactionCost = (cost: string): string[] => {
  const errors: string[] = [];
  if (!cost || cost.trim() === '') {
    errors.push('Transaction cost is required');
    return errors;
  }
  
  const numCost = parseFloat(cost);
  if (isNaN(numCost)) {
    errors.push('Transaction cost must be a number');
  } else if (numCost < 0) {
    errors.push('Transaction cost cannot be negative');
  }
  
  return errors;
};

// Type for mutation parameters
interface CreateTransferParams {
  api: AxiosInstance;
  transferData: CreateTransferType;
}

// Create a properly typed mutation atom
export const createTransferMutationAtom = atomWithMutation<any, CreateTransferParams>(() => ({
  mutationKey: ['createTransfer'],
  mutationFn: async ({ api, transferData }) => {
    return await createTransfer(api, transferData);
  }
}));

// Atom to handle create transfer operation and update UI state
export const createTransferAtom = atom(
  null, // read function not used
  async (get, set, { api, transferData }: CreateTransferParams) => {
    try {
      // Reset validation errors on new submission
      set(transferValidationErrorsAtom, {});
      
      // Validate the amount field
      const amountErrors = validateAmount(transferData.amount.toString());
      if (amountErrors.length > 0) {
        set(transferValidationErrorsAtom, { amount: amountErrors });
        throw new Error('Validation failed');
      }
      
      // Validate the transaction cost field
      const costErrors = validateTransactionCost(transferData.transactionCost.toString());
      if (costErrors.length > 0) {
        set(transferValidationErrorsAtom, { transactionCost: costErrors });
        throw new Error('Validation failed');
      }

      // Validate from and to accounts
      if (!transferData.fromAccountName) {
        set(transferValidationErrorsAtom, { 
          fromAccountName: ['From account is required'] 
        });
        throw new Error('Validation failed');
      }
      
      if (!transferData.toAccountName) {
        set(transferValidationErrorsAtom, { 
          toAccountName: ['To account is required'] 
        });
        throw new Error('Validation failed');
      }
      
      if (transferData.fromAccountName === transferData.toAccountName) {
        set(transferValidationErrorsAtom, { 
          toAccountName: ['From and To accounts must be different'] 
        });
        throw new Error('Validation failed');
      }
      
      // Get the mutation from the atom
      const mutation = get(createTransferMutationAtom);
      
      // Call the mutation
      const newTransfer = await mutation.mutateAsync({ api, transferData });
      
      // Reset the input atoms
      set(transferAmountAtom, '');
      set(transferTransactionCostAtom, '0');
      set(transferDescriptionAtom, '');
      set(transferFromAccountNameAtom, '');
      set(transferToAccountNameAtom, '');
      set(transferScheduleTypeAtom, ScheduleTypeEnum.ONE_TIME);
      set(transferRepeatIntervalAtom, '');
      
      return newTransfer;
    } catch (error) {
      console.error('Error creating transfer:', error);
      
      // Extract field validation errors
      const fieldErrors = extractFieldErrors(error);
      
      // Store field errors in atom for display in UI
      if (Object.keys(fieldErrors).length > 0) {
        set(transferValidationErrorsAtom, fieldErrors);
      }
      
      throw error;
    }
  }
); 
