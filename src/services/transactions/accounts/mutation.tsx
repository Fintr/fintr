import { AxiosInstance, AxiosError } from 'axios';
import { AccountCategory } from '@/types/accountTypes';

// Type for creating a new account
export interface CreateAccountType {
  name: string;
  balance: number;
  accountCategory: AccountCategory;
}

/**
 * Create a new account
 * 
 * @param api - The authenticated API client
 * @param accountData - The account data to create
 * @returns The created account
 */
export const createAccount = async (
  api: AxiosInstance,
  accountData: CreateAccountType
) => {
  try {
    const response = await api.post('/transactions/accounts', accountData);
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response for field validation handling
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error creating account:', error);
    throw new Error('Failed to create account');
  }
}; 
