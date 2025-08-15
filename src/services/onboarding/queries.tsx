import { AxiosInstance } from 'axios';

export interface GetOnboardingDataArgs {
  api: AxiosInstance;
  step: string;
}

/**
 * Fetches current onboarding data for the user at a specific step.
 * @param {GetOnboardingDataArgs} args - Arguments for fetching onboarding data.
 * @param {AxiosInstance} args.api - Authenticated Axios instance.
 * @param {string} args.step - The current onboarding step (income, budgets, accounts).
 * @returns {Promise<any>} - The onboarding data from the backend API.
 */
export const getOnboardingData = async ({ api, step }: GetOnboardingDataArgs) => {
  const response = await api.get(`/onboardings?step=${step}`);
  return response.data;
};
