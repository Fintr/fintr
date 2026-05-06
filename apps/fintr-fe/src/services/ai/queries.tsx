import { AxiosInstance } from 'axios';

export interface AIUsageData {
  used: number;
  limit: number;
  remaining: number;
  usagePeriod: string;
}

export const fetchAIUsage = async (api: AxiosInstance): Promise<AIUsageData> => {
  try {
    const response = await api.get('/ai/usage');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching AI usage:', error);
    throw error;
  }
};
