import { AxiosInstance, AxiosError } from 'axios';
import { formDataWithFile } from '@/utils/formUtils';

// Type for creating a new loan
export interface CreateLoanType {
  principalAmount: number;
  interestRate: number;
  date: string;
  loanType: 'borrowed' | 'lent';
  entityName: string;
  accountName: string;
  loanTermMonths: number;
  description?: string;
  file?: File;
  fileId?: string;
}

// Type for updating a loan
export interface UpdateLoanType extends CreateLoanType {
  id: string;
}

/**
 * Create a new loan
 * 
 * @param api - The authenticated API client
 * @param loanData - The loan data to create
 * @returns The created loan
 */
export const createLoan = async (
  api: AxiosInstance,
  loanData: CreateLoanType
) => {
  try {
    // Transform frontend data to backend format
    const backendData = {
      principal_amount: loanData.principalAmount,
      interest_rate: loanData.interestRate,
      date: loanData.date,
      loan_type: loanData.loanType,
      entity_name: loanData.entityName,
      account_name: loanData.accountName,
      loan_term_months: loanData.loanTermMonths,
      description: loanData.description || '',
      ...(loanData.fileId && { file_id: loanData.fileId }),
      ...(loanData.file && { file: loanData.file })
    };

    // If there's a file, use FormData to handle the multipart/form-data request
    if (loanData.file) {
      const formData = formDataWithFile(backendData);
      const response = await api.post('/transactions/loans', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } else {
      // Regular JSON request without file
      const response = await api.post('/transactions/loans', backendData);
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
    console.error('Error creating loan:', error);
    throw new Error('Failed to create loan');
  }
};

/**
 * Update a loan
 * 
 * @param api - The authenticated API client
 * @param loanData - The loan data to update
 * @returns The updated loan
 */
export const updateLoan = async (
  api: AxiosInstance,
  loanData: UpdateLoanType
) => {
  try {
    // Transform frontend data to backend format
    const backendData = {
      principal_amount: loanData.principalAmount,
      interest_rate: loanData.interestRate,
      date: loanData.date,
      loan_type: loanData.loanType,
      entity_name: loanData.entityName,
      loan_term_months: loanData.loanTermMonths,
      description: loanData.description || '',
      ...(loanData.file && { file: loanData.file })
    };

    // If there's a file, use FormData to handle the multipart/form-data request
    if (loanData.file) {
      const formData = formDataWithFile(backendData);
      const response = await api.put(`/transactions/loans/${loanData.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } else {
      // Regular JSON request without file
      const response = await api.put(`/transactions/loans/${loanData.id}`, backendData);
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
    console.error('Error updating loan:', error);
    throw new Error('Failed to update loan');
  }
};

/**
 * Delete a loan
 * 
 * @param api - The authenticated API client
 * @param loanId - The loan ID to delete
 * @returns Success response
 */
export const deleteLoan = async (
  api: AxiosInstance,
  loanId: string
) => {
  try {
    const response = await api.delete(`/transactions/loans/${loanId}`);
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response for field validation handling
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error deleting loan:', error);
    throw new Error('Failed to delete loan');
  }
};
