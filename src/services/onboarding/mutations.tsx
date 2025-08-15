import { AxiosInstance } from 'axios';

export interface BudgetCategory {
  name: string;
  amount: string;
  percentage: number;
}

export interface BudgetCategoryInput {
  name: string;
  amount: string;
}

export interface AccountDataInput {
  name: string;
  accountCategory: string;
  balance: number;
}

export interface SaveStep1DataArgs {
  api: AxiosInstance;
  step: string;
  salaryIncome?: number;
  businessIncome?: number;
}

export interface SaveStep2DataArgs {
  api: AxiosInstance;
  step: string;
  budgetCategories: BudgetCategoryInput[];
}

export interface SaveStep3DataArgs {
  api: AxiosInstance;
  step: string;
  accounts: AccountDataInput[];
}

/**
 * Saves step 1 onboarding data (income information).
 * @param {SaveStep1DataArgs} args - Arguments for saving step 1 data.
 * @param {AxiosInstance} args.api - Authenticated Axios instance.
 * @param {string} args.step - The current onboarding step.
 * @param {number} [args.salaryIncome] - User's salary income.
 * @param {number} [args.businessIncome] - User's business income.
 * @returns {Promise<any>} - The response data from the backend API.
 */
export const saveStep1Data = async ({ api, step, salaryIncome, businessIncome }: SaveStep1DataArgs) => {
  const response = await api.post('/onboardings', {
    step,
    salaryIncome,
    businessIncome,
  });
  return response.data;
};

/**
 * Saves step 2 onboarding data (budget categories).
 * @param {SaveStep2DataArgs} args - Arguments for saving step 2 data.
 * @param {AxiosInstance} args.api - Authenticated Axios instance.
 * @param {string} args.step - The current onboarding step.
 * @param {BudgetCategoryInput[]} args.budgetCategories - Array of budget categories.
 * @returns {Promise<any>} - The response data from the backend API.
 */
export const saveStep2Data = async ({ api, step, budgetCategories }: SaveStep2DataArgs) => {
  const response = await api.post('/onboardings', {
    step,
    budgetCategories,
  });
  return response.data;
};

/**
 * Saves step 3 onboarding data (accounts data).
 * @param {SaveStep3DataArgs} args - Arguments for saving step 3 data.
 * @param {AxiosInstance} args.api - Authenticated Axios instance.
 * @param {string} args.step - The current onboarding step.
 * @param {AccountDataInput[]} args.accountsData - Array of account data.
 * @returns {Promise<any>} - The response data from the backend API.
 */
export const saveStep3Data = async ({ api, step, accounts }: SaveStep3DataArgs) => {
  const response = await api.post('/onboardings', {
    step,
    accounts,
  });
  return response.data;
};
