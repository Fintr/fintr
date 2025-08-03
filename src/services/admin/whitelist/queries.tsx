import { AxiosInstance } from 'axios';
import { WhitelistEntry } from '@/types/adminTypes';

export const fetchWhitelists = async (api: AxiosInstance): Promise<WhitelistEntry[]> => {
  try {
    const response = await api.get('/beta/whitelist');
    return response.data.data; // Adjusted to directly return the array under data.data
  } catch (error) {
    console.error('Error fetching whitelists:', error);
    throw error;
  }
}; 
