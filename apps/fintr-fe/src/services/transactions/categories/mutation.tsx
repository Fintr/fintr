import { AxiosInstance, AxiosError } from 'axios';
import { CreateTransactionCategoryType } from '@/types/transactionCategoryTypes';
import {
  CategoryConversionPreview,
  CategoryConversionResult,
  CategoryConversionType,
} from '@/types/categoryConversionTypes';


/**
 * Create a new transaction category
 * 
 * @param api - The authenticated API client
 * @param categoryData - The category data to create
 * @returns The created category
 */
export const createTransactionCategory = async (
  api: AxiosInstance,
  categoryData: CreateTransactionCategoryType
) => {
  try {
    const response = await api.post('/transactions/categories', categoryData);
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response for field validation handling
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error creating transaction category:', error);
    throw new Error('Failed to create category');
  }
};

/**
 * Update a transaction category
 * 
 * @param api - The authenticated API client
 * @param categoryId - The ID of the category to update
 * @param updateData - The data to update (only name field)
 * @returns The updated category
 */
export const updateTransactionCategory = async (
  api: AxiosInstance,
  categoryId: string,
  updateData: { name: string }
) => {
  try {
    const response = await api.put(`/transactions/categories/${categoryId}`, updateData);
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response for field validation handling
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error updating transaction category:', error);
    throw new Error('Failed to update category');
  }
};

/**
 * Delete a transaction category
 * 
 * @param api - The authenticated API client
 * @param categoryId - The ID of the category to delete
 * @returns The deletion response
 */
export const deleteTransactionCategory = async (
  api: AxiosInstance,
  categoryId: string
) => {
  try {
    const response = await api.delete(`/transactions/categories/${categoryId}`);
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    return axiosError.response?.data;
  }
};

/**
 * Fetch transaction categories
 * 
 * @param api - The authenticated API client
 * @returns List of transaction categories with { expenseCategories, incomeCategories }
 */
export const previewCategoryConversion = async (
  api: AxiosInstance,
  categoryId: string,
  payload: {
    conversionType: CategoryConversionType;
    newParentId?: string | null;
  },
) => {
  const response = await api.post(
    `/transactions/categories/${categoryId}/preview_conversion`,
    {
      conversionType: payload.conversionType,
      newParentId: payload.newParentId ?? null,
    },
  );
  return response.data?.data as CategoryConversionPreview;
};

export const convertCategoryHierarchy = async (
  api: AxiosInstance,
  categoryId: string,
  payload: {
    conversionType: CategoryConversionType;
    newParentId?: string | null;
  },
) => {
  const response = await api.post(
    `/transactions/categories/${categoryId}/convert`,
    {
      conversionType: payload.conversionType,
      newParentId: payload.newParentId ?? null,
    },
  );
  return response.data?.data as CategoryConversionResult;
};

export const fetchTransactionCategories = async (api: AxiosInstance) => {
  try {
    const response = await api.get('/transactions/categories');
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error fetching transaction categories:', error);
    throw new Error('Failed to fetch categories');
  }
}; 
