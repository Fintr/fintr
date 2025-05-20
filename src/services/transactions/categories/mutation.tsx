import { AxiosInstance, AxiosError } from 'axios';
import { CreateTransactionCategoryType } from '@/types/transactionCategoryTypes';

/**
 * Create a new transaction category
 * 
 * @param api - The authenticated API client
 * @param categoryData - The category data to create
 * @returns The created category
 */
export const createTransactionCategory = async (
  api: AxiosInstance,
  categoryData: CreateTransactionCategoryType
) => {
  try {
    const response = await api.post('/transactions/categories', categoryData);
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response for field validation handling
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error creating transaction category:', error);
    throw new Error('Failed to create category');
  }
};

/**
 * Fetch transaction categories
 * 
 * @param api - The authenticated API client
 * @returns List of transaction categories
 */
export const fetchTransactionCategories = async (api: AxiosInstance) => {
  try {
    const response = await api.get('/transactions/categories');
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error fetching transaction categories:', error);
    throw new Error('Failed to fetch categories');
  }
}; 
