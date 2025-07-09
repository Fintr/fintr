import { AxiosInstance, AxiosError } from 'axios';
import { ScheduleTypeEnum, UpdateScopeEnum } from '@/constants/transactionConstants';

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
}

// Type for updating a transfer
export interface UpdateTransferType extends CreateTransferType {
  id: string;
  updateScope?: UpdateScopeEnum;
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
      const formData = new FormData();
      
      // Add all transfer data to FormData
      Object.entries(transferData).forEach(([key, value]) => {
        // Skip undefined values
        if (value === undefined) return;
        
        // Handle file separately
        if (key === 'file') {
          formData.append(key, value);
        } else {
          formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      });
      
      const response = await api.post('/transactions/transfers', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } else {
      // Regular JSON request without file
      const response = await api.post('/transactions/transfers', transferData);
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
      const formData = new FormData();
      
      // Add all transfer data to FormData
      Object.entries(transferData).forEach(([key, value]) => {
        // Skip undefined values
        if (value === undefined) return;
        
        // Handle file separately
        if (key === 'file') {
          formData.append(key, value);
        } else {
          formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      });
      
      const response = await api.put(`/transactions/transfers/${transferData.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } else {
      // Regular JSON request without file
      const response = await api.put(`/transactions/transfers/${transferData.id}`, transferData);
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
