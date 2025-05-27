import { atom } from 'jotai';
import { atomWithMutation } from 'jotai-tanstack-query';
import { CreateTransactionCategoryType, TransactionCategory } from '@/types/transactionCategoryTypes';
import { createTransactionCategory } from '@/services/transactions/categories/mutation';
import { 
  expenseCategoryOptionsAtom,
  incomeCategoryOptionsAtom 
} from '@/atoms/dashboardAtoms';
import { extractFieldErrors } from '@/utils/errorUtils';
import { TransactionTypeEnum } from '@/constants/transactionConstants';
import { AxiosError, AxiosInstance } from 'axios';

// Input atom for new category name
export const newCategoryNameAtom = atom<string>('');

// Atom for storing field validation errors
export const categoryValidationErrorsAtom = atom<Record<string, string[]>>({});

// Interface for category data
interface CategoryData {
  name: string;
  category_type: TransactionTypeEnum;
}

// Interface for createCategory parameters
interface CreateCategoryParams {
  api: AxiosInstance;
  categoryData: CategoryData;
}

// Create a properly typed mutation atom
export const createCategoryMutationAtom = atomWithMutation<TransactionCategory, CreateCategoryParams>(() => ({
  mutationKey: ['createTransactionCategory'],
  mutationFn: async ({ api, categoryData }) => {
    return await createTransactionCategory(api, categoryData);
  }
}));

// Atom to handle the create category operation and update UI state
export const createCategoryAtom = atom(
  null, // read function not used
  async (get, set, { api, categoryData }: CreateCategoryParams) => {
    try {
      // Reset validation errors on new submission
      set(categoryValidationErrorsAtom, {});
      
      // Get the mutation from the atom
      const mutation = get(createCategoryMutationAtom);
      
      // Call the mutation
      const newCategory = await mutation.mutateAsync({ api, categoryData });
      
      // Determine which atom to update based on category type
      if (categoryData.category_type === TransactionTypeEnum.EXPENSE) {
        // Update the expense category options atom with the new category
        const currentOptions = get(expenseCategoryOptionsAtom);
        
        // Check if category already exists in options
        const categoryExists = currentOptions.some(
          option => option.value === categoryData.name
        );
        
        // Only add if it doesn't exist already
        if (!categoryExists) {
          const updatedOptions = [
            ...currentOptions,
            {
              label: categoryData.name,
              value: categoryData.name
            }
          ];
          set(expenseCategoryOptionsAtom, updatedOptions);
        }
      } else if (categoryData.category_type === TransactionTypeEnum.INCOME) {
        // Update the income category options atom with the new category
        const currentOptions = get(incomeCategoryOptionsAtom);
        
        // Check if category already exists in options
        const categoryExists = currentOptions.some(
          option => option.value === newCategory.name
        );
        
        // Only add if it doesn't exist already
        if (!categoryExists) {
          const updatedOptions = [
            ...currentOptions,
            {
              label: categoryData.name,
              value: categoryData.name
            }
          ];
          set(incomeCategoryOptionsAtom, updatedOptions);
        }
      }
      
      // Reset the category name input
      set(newCategoryNameAtom, '');
      
      // Return the name of the new category for selection in the form
      return categoryData.name;
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        console.error('Error creating category:', error.response?.data);
      } else {
        console.error('Error creating category:', error);
      }
      
      // Extract field validation errors
      const fieldErrors = extractFieldErrors(error);
      
      // Store field errors in atom for display in UI
      set(categoryValidationErrorsAtom, fieldErrors);
      
      throw error;
    }
  }
);

// Atom for fetching transaction categories
export const fetchTransactionCategoriesAtom = atom(
  null,
  async (get, set, { api, type }: { api: AxiosInstance; type: TransactionTypeEnum }) => {
    try {
      // Fetch categories by type
      const response = await api.get(`/transaction-categories/?category_type=${type}`);
      
      // Format the response for select options directly
      const formattedOptions = response.data.map((item: { id: string | number; name: string }) => ({
        label: item.name,
        value: item.name
      }));
      
      // Update the appropriate category options atom
      if (type === TransactionTypeEnum.EXPENSE) {
        set(expenseCategoryOptionsAtom, formattedOptions);
      } else if (type === TransactionTypeEnum.INCOME) {
        set(incomeCategoryOptionsAtom, formattedOptions);
      }
      
      return formattedOptions;
    } catch (error) {
      console.error(`Error fetching ${type} categories:`, error);
      throw error;
    }
  }
); 
 