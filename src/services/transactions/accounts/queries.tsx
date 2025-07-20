import { AxiosInstance, AxiosError } from 'axios';

/**
 * Fetch all accounts for the current user along with account category options
 * 
 * @param api - The authenticated API client
 * @returns List of user accounts and account category options
 */
export const fetchAccounts = async (api: AxiosInstance) => {
  try {
    const response = await api.get('/transactions/accounts');
    return response.data;
  } catch (error) {
    // Handle different error structures
    const axiosError = error as AxiosError;
    
    if (axiosError.response?.data) {
      // Pass through the structured error response
      throw axiosError.response.data;
    }
    
    // Log and rethrow generic errors
    console.error('Error fetching accounts:', error);
    throw new Error('Failed to fetch accounts');
  }
}; 
