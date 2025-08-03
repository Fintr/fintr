import { AxiosInstance } from 'axios';
import { CreateWhitelistPayload, UpdateWhitelistPayload, DeleteWhitelistPayload, WhitelistEntry } from '@/types/adminTypes';

export const createWhitelist = async (
  api: AxiosInstance,
  payload: CreateWhitelistPayload
): Promise<WhitelistEntry> => {
  try {
    const response = await api.post('/beta/whitelist', payload);
    return response.data.data.whitelist; // Assuming API returns { data: { whitelist: {...} } }
  } catch (error) {
    console.error('Error creating whitelist:', error);
    throw error;
  }
};

export const updateWhitelist = async (
  api: AxiosInstance,
  payload: UpdateWhitelistPayload
): Promise<WhitelistEntry> => {
  try {
    const response = await api.put('/beta/whitelist', payload);
    return response.data.data.whitelist; // Assuming API returns { data: { whitelist: {...} } }
  } catch (error) {
    console.error(`Error updating whitelist:`, error);
    throw error;
  }
};

export const deleteWhitelist = async (
  api: AxiosInstance,
  payload: DeleteWhitelistPayload
): Promise<void> => {
  try {
    await api.delete('/beta/whitelist', { data: payload }); // Pass payload in data for DELETE requests with body
  } catch (error) {
    console.error(`Error deleting whitelist:`, error);
    throw error;
  }
}; 
