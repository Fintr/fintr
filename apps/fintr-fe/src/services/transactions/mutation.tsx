import { AxiosInstance, AxiosError } from 'axios';
import { ScheduleTypeEnum, UpdateScopeEnum, DeleteScopeEnum } from '@/constants/transactionConstants';
import { formDataWithFile, isUploadableFile } from '@/utils/formUtils';

// Type for creating a new transaction
export interface CreateTransactionType {
  amount: number;
  description?: string;
  /** Explicit form type: "income" or "expense" */
  transactionType: "income" | "expense";
  categoryName: string;
  categoryId?: string;
  subcategoryId?: string;
  accountName: string;
  date: string;
  scheduleType: ScheduleTypeEnum;
  // Optional fields that depend on scheduleType
  repeatInterval?: string;
  installmentPeriod?: number;
  // File data
  file?: File;
  // Receipt draft ID for linking receipt processing to transaction creation
  draftId?: string;
  fileId?: string;
  // Multi-currency: when amount is in a different currency than account
  original_currency?: string;
  exchange_rate?: number;
  exchange_rate_source?: "auto" | "manual" | "recent";
}

// Type for updating a transaction
export interface UpdateTransactionType extends CreateTransactionType {
  id: string;
  updateScope?: UpdateScopeEnum;
}

// Type for deleting a transaction
export interface DeleteTransactionType {
  id: string;
  deleteScope: DeleteScopeEnum;
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
    const shouldUseMultipart = isUploadableFile(transactionData.file);

    // If there's a file, use FormData to handle the multipart/form-data request
    if (shouldUseMultipart) {
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
    const shouldUseMultipart = isUploadableFile(transactionData.file);

    // If there's a file, use FormData to handle the multipart/form-data request
    if (shouldUseMultipart) {
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

/**
 * Delete a transaction
 * 
 * @param api - The authenticated API client
 * @param deleteData - The delete data containing id and delete scope
 * @returns Success response
 */
export const deleteTransaction = async (
  api: AxiosInstance,
  deleteData: DeleteTransactionType
) => {
  try {
    const response = await api.delete(`/transactions/${deleteData.id}`, {
      data: {
        deleteScope: deleteData.deleteScope
      }
    });
    
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response for field validation handling
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error deleting transaction:', error);
    throw new Error('Failed to delete transaction');
  }
};
