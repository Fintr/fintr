import { AxiosInstance, AxiosError } from 'axios';

export interface LoanPayment {
  id: string;
  date: string;
  principalPayment: number;
  interestPayment: number;
  totalPayment: number;
  currency: string;
}

export interface AmortizationScheduleItem {
  paymentDate: string;
  beginningBalance: number;
  paymentAmount: number;
  principalPayment: number;
  interestPayment: number;
  endingBalance: number;
  isActual: boolean;
}

export interface Loan {
  id: string;
  date: string;
  description: string | null;
  loanType: 'borrowed' | 'lent';
  loanTermMonths: number;
  maturityDate: string;
  status: 'active' | 'paid_off' | 'defaulted';
  paidOffDate: string | null;
  interestRate: number;
  entityName: string;
  accountName: string;
  principalAmount: number;
  principalAmountCurrency: string;
  outstandingBalance: number;
  outstandingBalanceCurrency: string;
  value: number;
  income: number;
  expense: number;
  files: Array<{
    id: string;
    filename: string;
    content_type: string;
    url: string;
    created_at: string;
  }>;
  loanPayments?: LoanPayment[];
  amortizationSchedule?: AmortizationScheduleItem[];
}

export interface LoansPage {
  loans: Loan[];
  nextPage: number | null;
  totalPages: number | null;
  totalCount: number | null;
}

/**
 * Fetch all loans for the current space (non-paginated, for backward compatibility)
 * 
 * @param api - The authenticated API client
 * @returns List of loans
 */
export const fetchLoans = async (api: AxiosInstance): Promise<Loan[]> => {
  try {
    const response = await api.get('/transactions/loans');
    return response.data?.data || [];
  } catch (error) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    
    console.error('Error fetching loans:', error);
    throw new Error('Failed to fetch loans');
  }
};

/**
 * Fetch a single page of loans for infinite scrolling
 * 
 * @param api - The authenticated API client
 * @param pageParam - The page number to fetch
 * @returns A promise that resolves to a LoansPage object
 */
export const fetchLoansPage = async (
  api: AxiosInstance,
  { pageParam = 1 }: { pageParam?: number }
): Promise<LoansPage> => {
  try {
    const response = await api.get('/transactions/loans', {
      params: {
        page: pageParam,
        per_page: 10
      }
    });
    
    const loans = response?.data?.data?.loans || [];
    const pagination = response?.data?.data?.pagination || {};
    const totalPages = pagination.totalPages || pagination.total_pages || 1;
    const currentPage = pagination.currentPage || pagination.current_page || pageParam;
    const nextPage = currentPage < totalPages ? currentPage + 1 : null;
    
    return {
      loans,
      nextPage,
      totalPages: pagination.totalPages || pagination.total_pages || null,
      totalCount: pagination.totalCount || pagination.total_count || null
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      throw axiosError.response.data;
    }
    
    console.error('Error fetching loans page:', error);
    throw new Error('Failed to fetch loans');
  }
};

