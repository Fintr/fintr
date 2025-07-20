import { AxiosInstance, AxiosError } from 'axios';

// Type for creating a new account
export interface CreateAccountType {
  name: string;
  balance: number;
  accountCategory: string;
}

// Type for updating an account
export interface UpdateAccountType {
  name: string;
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

/**
 * Update an account
 * 
 * @param api - The authenticated API client
 * @param accountId - The ID of the account to update
 * @param updateData - The data to update (name field)
 * @returns The updated account
 */
export const updateAccount = async (
  api: AxiosInstance,
  accountId: string,
  updateData: UpdateAccountType
) => {
  try {
    const response = await api.put(`/transactions/accounts/${accountId}`, updateData);
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response for field validation handling
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error updating account:', error);
    throw new Error('Failed to update account');
  }
};

/**
 * Delete an account
 * 
 * @param api - The authenticated API client
 * @param accountId - The ID of the account to delete
 * @returns Success response
 */
export const deleteAccount = async (
  api: AxiosInstance,
  accountId: string
) => {
  try {
    const response = await api.delete(`/transactions/accounts/${accountId}`);
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response for field validation handling
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error deleting account:', error);
    throw new Error('Failed to delete account');
  }
}; 
