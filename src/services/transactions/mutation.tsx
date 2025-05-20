import { AxiosInstance, AxiosError } from 'axios';
import { ScheduleTypeEnum } from '@/constants/transactionConstants';

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
      const formData = new FormData();
      
      // Add all transaction data to FormData
      Object.entries(transactionData).forEach(([key, value]) => {
        // Skip undefined values
        if (value === undefined) return;
        
        // Handle file separately
        if (key === 'file') {
          formData.append(key, value);
        } else {
          formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      });
      
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
 