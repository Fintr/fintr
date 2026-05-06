import { AxiosInstance } from 'axios';

/**
 * Fetches a single transfer by ID
 * 
 * @param api - The authenticated Axios instance
 * @param transferId - The ID of the transfer to fetch
 * @returns The transfer data
 */
export const fetchTransferById = async (
  api: AxiosInstance,
  transferId: string
) => {
  try {
    const response = await api.get(`/transactions/transfers/${transferId}`);
    return response.data.data;
  } catch (error) {
    console.error("Error fetching transfer by ID:", error);
    throw error;
  }
}; 
