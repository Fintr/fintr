import { AxiosInstance, AxiosError } from 'axios';
import { ScheduleTypeEnum, UpdateScopeEnum, DeleteScopeEnum } from '@/constants/transactionConstants';
import { formDataWithFile } from '@/utils/formUtils';

// Type for creating a new transfer
export interface CreateTransferType {
  amount: number;
  transactionCost: number;
  fromAccountName: string;
  toAccountName: string;
  description?: string;
  date: string;
  scheduleType: ScheduleTypeEnum;
  repeatInterval?: string;
  file?: File;
  // Multi-currency: when from/to account currencies differ
  exchange_rate?: number;
  exchange_rate_source?: "auto" | "manual" | "recent";
}

// Type for updating a transfer
export interface UpdateTransferType extends CreateTransferType {
  id: string;
  updateScope?: UpdateScopeEnum;
}

// Type for deleting a transfer
export interface DeleteTransferType {
  id: string;
  deleteScope: DeleteScopeEnum;
}

/**
 * Create a new transfer transaction
 * 
 * @param api - The authenticated API client
 * @param transferData - The transfer data to create
 * @returns The created transfer transaction
 */
export const createTransfer = async (
  api: AxiosInstance,
  transferData: CreateTransferType
) => {
  try {
    // If there's a file, use FormData to handle the multipart/form-data request
    if (transferData.file) {
      const formData = formDataWithFile(transferData);
      const response = await api.post('/transactions/transfers', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Defensive: handle null/undefined response
      if (!response) {
        throw new Error('Empty response from server');
      }
      return response.data;
    } else {
      // Regular JSON request without file
      const response = await api.post('/transactions/transfers', transferData);
      
      // Defensive: handle null/undefined response
      if (!response) {
        throw new Error('Empty response from server');
      }
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
    console.error('Error creating transfer:', error);
    throw new Error('Failed to create transfer');
  }
};

/**
 * Update a transfer transaction
 * 
 * @param api - The authenticated API client
 * @param transferData - The transfer data to update
 * @returns The updated transfer transaction
 */
export const updateTransfer = async (
  api: AxiosInstance,
  transferData: UpdateTransferType
) => {
  try {
    // If there's a file, use FormData to handle the multipart/form-data request
    if (transferData.file) {
      const formData = formDataWithFile(transferData);
      const response = await api.put(`/transactions/transfers/${transferData.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Defensive: handle null/undefined response
      if (!response) {
        throw new Error('Empty response from server');
      }
      return response.data;
    } else {
      // Regular JSON request without file
      const response = await api.put(`/transactions/transfers/${transferData.id}`, transferData);
      
      // Defensive: handle null/undefined response
      if (!response) {
        throw new Error('Empty response from server');
      }
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
    console.error('Error updating transfer:', error);
    throw new Error('Failed to update transfer');
  }
};

/**
 * Delete a transfer transaction
 * 
 * @param api - The authenticated API client
 * @param deleteData - The delete data containing id and delete scope
 * @returns Success response
 */
export const deleteTransfer = async (
  api: AxiosInstance,
  deleteData: DeleteTransferType
) => {
  try {
    const response = await api.delete(`/transactions/transfers/${deleteData.id}`, {
      data: {
        deleteScope: deleteData.deleteScope
      }
    });
    
    // Defensive: handle null/undefined response
    if (!response) {
      throw new Error('Empty response from server');
    }
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response for field validation handling
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error deleting transfer:', error);
    throw new Error('Failed to delete transfer');
  }
}; 
