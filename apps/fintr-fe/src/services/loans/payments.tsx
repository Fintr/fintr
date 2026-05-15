import { AxiosInstance, AxiosError } from 'axios';

export interface LoanPayment {
  id: string;
  loanId: string;
  accountId: string;
  accountName: string;
  date: string;
  principalPayment: number;
  interestPayment: number;
  totalPayment: number;
  currency: string;
  notes?: string;
  adjustsAccountBalance?: boolean;
}

export interface CreateLoanPaymentType {
  loanId: string;
  accountName: string;
  date: string;
  totalPayment: number;
  principalPayment?: number;
  notes?: string;
  adjustsAccountBalance?: boolean;
}

/**
 * Fetch all loan payments for a specific loan
 * 
 * @param api - The authenticated API client
 * @param loanId - The loan ID
 * @returns List of loan payments
 */
export const fetchLoanPayments = async (
  api: AxiosInstance,
  loanId: string
): Promise<LoanPayment[]> => {
  try {
    const response = await api.get(`/transactions/loans/${loanId}/loan_payments`);
    return response.data?.data || [];
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    console.error('Error fetching loan payments:', error);
    throw new Error('Failed to fetch loan payments');
  }
};

/**
 * Create a new loan payment
 * 
 * @param api - The authenticated API client
 * @param loanId - The loan ID
 * @param paymentData - The payment data
 * @returns The created loan payment
 */
export const createLoanPayment = async (
  api: AxiosInstance,
  loanId: string,
  paymentData: Omit<CreateLoanPaymentType, 'loanId'>
) => {
  try {
    const backendData = {
      account_name: paymentData.accountName,
      date: paymentData.date,
      total_payment: paymentData.totalPayment,
      ...(paymentData.principalPayment !== undefined && { principal_payment: paymentData.principalPayment }),
      ...(paymentData.adjustsAccountBalance !== undefined && {
        adjusts_account_balance: paymentData.adjustsAccountBalance,
      }),
      ...(paymentData.notes && { notes: paymentData.notes })
    };

    const response = await api.post(`/transactions/loans/${loanId}/loan_payments`, backendData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    
    console.error('Error creating loan payment:', error);
    throw new Error('Failed to create loan payment');
  }
};

/**
 * Update a loan payment
 * 
 * @param api - The authenticated API client
 * @param loanId - The loan ID
 * @param paymentId - The payment ID
 * @param paymentData - The payment data to update
 * @returns The updated loan payment
 */
export const updateLoanPayment = async (
  api: AxiosInstance,
  loanId: string,
  paymentId: string,
  paymentData: Partial<Omit<CreateLoanPaymentType, 'loanId'>>
) => {
  try {
    const backendData: any = {};
    if (paymentData.accountName) backendData.account_name = paymentData.accountName;
    if (paymentData.date) backendData.date = paymentData.date;
    if (paymentData.totalPayment !== undefined) backendData.total_payment = paymentData.totalPayment;
    if (paymentData.principalPayment !== undefined) backendData.principal_payment = paymentData.principalPayment;
    if (paymentData.adjustsAccountBalance !== undefined) {
      backendData.adjusts_account_balance = paymentData.adjustsAccountBalance;
    }
    if (paymentData.notes !== undefined) backendData.notes = paymentData.notes;

    const response = await api.put(`/transactions/loans/${loanId}/loan_payments/${paymentId}`, backendData);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    
    console.error('Error updating loan payment:', error);
    throw new Error('Failed to update loan payment');
  }
};

/**
 * Delete a loan payment
 * 
 * @param api - The authenticated API client
 * @param loanId - The loan ID
 * @param paymentId - The payment ID to delete
 * @returns Success response
 */
export const deleteLoanPayment = async (
  api: AxiosInstance,
  loanId: string,
  paymentId: string
) => {
  try {
    const response = await api.delete(`/transactions/loans/${loanId}/loan_payments/${paymentId}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    
    console.error('Error deleting loan payment:', error);
    throw new Error('Failed to delete loan payment');
  }
};

