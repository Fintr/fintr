import { AxiosInstance, AxiosError } from 'axios';
import { ScheduleTypeEnum, UpdateScopeEnum } from '@/constants/transactionConstants';
import { formDataWithFile } from '@/utils/formUtils';

// Type for creating a new transaction
export interface CreateTransactionType {
  amount: number;
  description?: string;
  categoryName: string;
  accountName: string;
  date: string;
  scheduleType: ScheduleTypeEnum;
  // Optional fields that depend on scheduleType
  repeatInterval?: string;
  installmentPeriod?: number;
  // File data
  file?: File;
}

// Type for updating a transaction
export interface UpdateTransactionType extends CreateTransactionType {
  id: string;
  updateScope?: UpdateScopeEnum;
}

/**
 * Create a new transaction
 * 
 * @param api - The authenticated API client
 * @param transactionData - The transaction data to create
 * @returns The created transaction
 */
export const createTransaction = async (
  api: AxiosInstance,
  transactionData: CreateTransactionType
) => {
  try {
    // If there's a file, use FormData to handle the multipart/form-data request
    if (transactionData.file) {
      const formData = formDataWithFile(transactionData);
      const response = await api.post('/transactions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } else {
      // Regular JSON request without file
      const response = await api.post('/transactions', transactionData);
      return response.data;
    }
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response for field validation handling
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error creating transaction:', error);
    throw new Error('Failed to create transaction');
  }
}; 
 
/**
 * Update a transaction
 * 
 * @param api - The authenticated API client
 * @param transactionData - The transaction data to create
 * @returns The created transaction
 */
export const updateTransaction = async (
  api: AxiosInstance,
  transactionData: UpdateTransactionType
) => {
  try {
    // If there's a file, use FormData to handle the multipart/form-data request
    if (transactionData.file) {
      const formData = formDataWithFile(transactionData);
      const response = await api.put(`/transactions/${transactionData.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } else {
      // Regular JSON request without file
      const response = await api.put(`/transactions/${transactionData.id}`, transactionData);
      return response.data;
    }
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response for field validation handling
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error creating transaction:', error);
    throw new Error('Failed to create transaction');
  }
}; 
