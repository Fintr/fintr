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
  const [_key, spaceCode, categoryName, startDate, endDate, minAmount, maxAmount, searchQuery, accountName] = queryKey as [
    string,
    string,
    string,
    string,
    string,
    number,
    number,
    string,
    string?
  ];

  const input: Omit<TransactionIndexInputType, 'page'> & { page: number; accountName?: string } = {
    spaceCode,
    startDate,
    categoryName,
    endDate,
    minAmount,
    maxAmount,
    page: pageParam,
    searchQuery,
    ...(accountName && { accountName }),
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

/**
 * Generates and downloads a CSV file of transactions based on provided filters.
 *
 * @param api - The authenticated Axios instance.
 * @param filterData - An object containing filter parameters for the transactions.
 */
export const generateTransactionsCsv = async (
  api: AxiosInstance,
  filterData: Omit<TransactionIndexInputType, 'page'>
) => {
  try {
    const response = await api.get('/transactions/generate_csv', {
      params: filterData,
      responseType: 'blob', // Important for downloading files
    });
    console.log('Response:', response);

    const contentDisposition = response.headers['content-disposition'];
    let filename = 'transactions.csv'; // Default filename

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename); // Use the extracted filename
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
  } catch (error) {
    console.error("Error generating CSV:", error);
    throw error;
  }
};

/**
 * Fetches transaction drafts for the current user
 * 
 * @param api - The authenticated Axios instance
 * @returns Promise resolving to an array of draft transactions
 */
export const fetchTransactionDrafts = async (api: AxiosInstance) => {
  try {
    const response = await api.get('/transactions/drafts');
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching transaction drafts:", error);
    throw error;
  }
};

/**
 * Fetches note suggestions for a transaction based on category
 * 
 * @param api - The authenticated Axios instance
 * @param params - Parameters for filtering suggestions
 * @returns Promise resolving to an array of note suggestions
 */
export interface NoteSuggestionsParams {
  categoryName?: string;
  transactionType?: 'income' | 'expense';
  search?: string;
  limit?: number;
}

export const fetchNoteSuggestions = async (
  api: AxiosInstance,
  params: NoteSuggestionsParams
): Promise<string[]> => {
  try {
    const response = await api.get('/transactions/note_suggestions', {
      params: {
        category_name: params.categoryName,
        transaction_type: params.transactionType,
        search: params.search,
        limit: params.limit || 10,
      },
    });
    return response.data.data?.suggestions || [];
  } catch (error) {
    console.error("Error fetching note suggestions:", error);
    return [];
  }
};
