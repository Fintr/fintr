import { AxiosInstance } from 'axios';

export interface CompleteTutorialArgs {
  api: AxiosInstance;
  platform: 'desktop' | 'mobile';
}

/**
 * Marks the tutorial as completed for the specified platform.
 * @param {CompleteTutorialArgs} args - Arguments for completing tutorial.
 * @param {AxiosInstance} args.api - Authenticated Axios instance.
 * @param {'desktop' | 'mobile'} args.platform - The platform for which to mark tutorial complete.
 * @returns {Promise<any>} - The response data from the backend API.
 */
export const completeTutorial = async ({ api, platform }: CompleteTutorialArgs) => {
  const response = await api.post('/auth/tutorial/complete', { platform });
  return response.data;
};


