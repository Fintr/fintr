import { AxiosInstance } from 'axios';
import { downloadBlobAsFile } from '@/lib/download-blob';
import { getUserFacingExportErrorMessage } from '@/lib/user-facing-export-error';
import { parseCategoryPickerValue } from '@/types/categoryTreeTypes';
import { TransactionsPage, TransactionIndexInputType } from '@/types/transactionTypes'; // Use path alias

/** Only include min/max in the request when the client intends a bound (backend skips both if absent). */
function optionalAmountQueryParam(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw === 'string' && raw.trim() === '') {
    return undefined;
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (Number.isNaN(n)) {
    return undefined;
  }
  return n;
}

function omitUndefinedParams(
  record: Record<string, string | number | undefined>,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(record).filter(([, v]) => v !== undefined),
  ) as Record<string, string | number>;
}

export type FetchAccountTransactionsPageParams = {
  spaceCode: string;
  accountId?: string;
  accountName: string;
  startDate: string;
  endDate: string;
  categoryFilter: string;
  searchQuery: string;
  page: number;
  minAmount?: number;
  maxAmount?: number;
};

export const fetchAccountTransactionsPage = async (
  api: AxiosInstance,
  params: FetchAccountTransactionsPageParams,
): Promise<TransactionsPage> => {
  const {
    spaceCode,
    accountId,
    accountName,
    startDate,
    endDate,
    categoryFilter,
    searchQuery,
    page,
    minAmount,
    maxAmount,
  } = params;

  const categoryAssignment = parseCategoryPickerValue(
    categoryFilter && categoryFilter !== "all" ? categoryFilter : "",
  );

  const requestParams = omitUndefinedParams({
    spaceCode,
    accountName,
    ...(accountId ? { accountId } : {}),
    startDate,
    endDate,
    searchQuery,
    page,
    ...(minAmount !== undefined ? { minAmount } : {}),
    ...(maxAmount !== undefined ? { maxAmount } : {}),
    ...(categoryAssignment?.categoryId
      ? { categoryId: categoryAssignment.categoryId }
      : {}),
    ...(categoryAssignment?.subcategoryId
      ? { subcategoryId: categoryAssignment.subcategoryId }
      : {}),
    ...(!categoryAssignment?.categoryId &&
    categoryFilter &&
    categoryFilter !== "all"
      ? { categoryName: categoryFilter }
      : {}),
  });

  try {
    const response = await api.get('/transactions', {
      params: requestParams,
    });

    const transactions = response?.data?.data?.transactions || [];
    const totalPages = response?.data?.data?.pagination?.totalPages || 1;
    const totalCount = response?.data?.data?.pagination?.totalCount || 0;
    const totals = response?.data?.data?.totals || null;
    const currentPage = page;
    const nextPage = currentPage < totalPages ? currentPage + 1 : null;

    if (!Array.isArray(transactions)) {
      console.error('Invalid transaction data structure received:', response?.data);
      return { transactions: [], nextPage: null, totalPages: null, totalCount: null, totals: null };
    }

    return { transactions, nextPage, totalPages, totalCount, totals };
  } catch (error) {
    console.error('Error fetching account transactions page:', error);
    throw error;
  }
};

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
  const [_key, spaceCode, categoryFilter, startDate, endDate, minAmount, maxAmount, searchQuery, accountName] = queryKey as [
    string,
    string,
    string,
    string,
    string,
    unknown,
    unknown,
    string,
    string?,
  ];

  const minIncluded = optionalAmountQueryParam(minAmount);
  const maxIncluded = optionalAmountQueryParam(maxAmount);

  const categoryAssignment = parseCategoryPickerValue(
    categoryFilter && categoryFilter !== "all" ? categoryFilter : "",
  );

  const requestParams = omitUndefinedParams({
    spaceCode,
    startDate,
    endDate,
    page: pageParam,
    searchQuery,
    ...(accountName ? { accountName } : {}),
    ...(minIncluded !== undefined ? { minAmount: minIncluded } : {}),
    ...(maxIncluded !== undefined ? { maxAmount: maxIncluded } : {}),
    ...(categoryAssignment?.categoryId
      ? { categoryId: categoryAssignment.categoryId }
      : {}),
    ...(categoryAssignment?.subcategoryId
      ? { subcategoryId: categoryAssignment.subcategoryId }
      : {}),
    ...(!categoryAssignment?.categoryId &&
    categoryFilter &&
    categoryFilter !== "all"
      ? { categoryName: categoryFilter }
      : {}),
  });

  console.log('Fetching transactions page:', requestParams);

  try {
    const response = await api.get('/transactions', {
      params: requestParams,
    });
    
    // Adapt this based on your actual API response structure
    const transactions = response?.data?.data?.transactions || [];
    const totalPages = response?.data?.data?.pagination?.totalPages || 1;
    const totalCount = response?.data?.data?.pagination?.totalCount || 0;
    const totals = response?.data?.data?.totals || null;
    const currentPage = pageParam;

    // Determine the next page number
    const nextPage = currentPage < totalPages ? currentPage + 1 : null;

    if (!Array.isArray(transactions)) {
      console.error('Invalid transaction data structure received:', response?.data);
      return { transactions: [], nextPage: null, totalPages: null, totalCount: null, totals: null }; // Return structure expected by useInfiniteQuery
    }

    console.log('Transactions page fetched:', { transactions, nextPage, totals });
    return { transactions, nextPage, totalPages, totalCount, totals };
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

    const blob =
      response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'text/csv;charset=utf-8' });

    await downloadBlobAsFile(blob, filename);
  } catch (error) {
    console.error("Error generating CSV:", error);
    const message = await getUserFacingExportErrorMessage(error);
    throw new Error(message);
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
