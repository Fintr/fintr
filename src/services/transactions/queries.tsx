import { AxiosInstance } from 'axios';
import { TransactionIndexInputType, TransactionsPage } from '@/types/transactionTypes'; // Use path alias

/**
 * Fetches a single page of transactions for infinite scrolling.
 * 
 * @param api - The authenticated Axios instance.
 * @param pageParam - The page number to fetch (provided by useInfiniteQuery).
 * @param queryKey - The query key array, containing other parameters like spaceCode, startDate, endDate.
 * @returns A promise that resolves to a TransactionsPage object.
 */
export const fetchTransactionsPage = async (
  api: AxiosInstance,
  {
    pageParam = 1, // Default to page 1
    queryKey,
  }: {
    pageParam?: number;
    queryKey: readonly unknown[];
  }
): Promise<TransactionsPage> => {
  // Extract other parameters from the queryKey
  const [_key, spaceCode, categoryName, startDate, endDate, minAmount, maxAmount, searchQuery] = queryKey as [
    string,
    string,
    string,
    string,
    string,
    number,
    number,
    string
  ];

  const input: Omit<TransactionIndexInputType, 'page'> & { page: number } = {
    spaceCode,
    startDate,
    categoryName,
    endDate,
    minAmount,
    maxAmount,
    page: pageParam,
    searchQuery,
  };
  console.log('Fetching transactions page:', input);

  try {
    const response = await api.get('/transactions', {
      params: input,
    });
    
    // Adapt this based on your actual API response structure
    const transactions = response?.data?.data?.transactions || [];
    const totalPages = response?.data?.data?.pagination?.totalPages || 1;
    const totalCount = response?.data?.data?.pagination?.totalCount || 0;
    const currentPage = input.page;

    // Determine the next page number
    const nextPage = currentPage < totalPages ? currentPage + 1 : null;

    if (!Array.isArray(transactions)) {
      console.error('Invalid transaction data structure received:', response?.data);
      return { transactions: [], nextPage: null, totalPages: null, totalCount: null }; // Return structure expected by useInfiniteQuery
    }

    console.log('Transactions page fetched:', { transactions, nextPage });
    return { transactions, nextPage, totalPages, totalCount };
  } catch (error) {
    console.error("Error fetching transactions page:", error);
    throw error; // Re-throw for React Query error handling
  }
};

/**
 * Fetches a single transaction by ID
 * 
 * @param api - The authenticated Axios instance
 * @param transactionId - The ID of the transaction to fetch
 * @returns The transaction data
 */
export const fetchTransactionById = async (
  api: AxiosInstance,
  transactionId: string
) => {
  try {
    const response = await api.get(`/transactions/${transactionId}`);
    return response.data.data;
  } catch (error) {
    console.error("Error fetching transaction by ID:", error);
    throw error;
  }
}; 
