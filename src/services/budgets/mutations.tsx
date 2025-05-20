import { AxiosInstance } from 'axios';

// Define the type for the update budget payload
export interface UpdateBudgetPayload {
  amount: number;
  // Add other fields here if they can be updated, e.g., category_id, period, etc.
}

/**
 * Updates an existing budget entry.
 * 
 * @param api - The authenticated Axios instance.
 * @param budgetId - The ID of the budget to update.
 * @param data - The data to update for the budget.
 * @returns A promise resolving to the updated budget data.
 */
export const updateBudget = async (
  api: AxiosInstance,
  budgetId: string,
  data: UpdateBudgetPayload
) => {
  try {
    const response = await api.put(`/budgets/${budgetId}`, data);
    console.log('Budget updated successfully:', response.data);
    return response.data; // Assuming the API returns the updated budget object
  } catch (error) {
    console.error(`Error updating budget ${budgetId}:`, error);
    throw error;
  }
}; 
