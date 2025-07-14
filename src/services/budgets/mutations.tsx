import { AxiosInstance } from 'axios';
import { CreateBudgetPayload } from '@/types/budgetTypes';

// Define the type for the update budget payload
export interface UpdateBudgetPayload {
  amount: number;
  // Add other fields here if they can be updated, e.g., category_id, period, etc.
}

/**
 * Creates a new budget entry.
 * 
 * @param api - The authenticated Axios instance.
 * @param data - The data for the new budget.
 * @returns A promise resolving to the created budget data.
 */
export const createBudget = async (
  api: AxiosInstance,
  data: CreateBudgetPayload
) => {
  try {
    const response = await api.post('/budgets', data);
    console.log('Budget created successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating budget:', error);
    throw error;
  }
};

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

/**
 * Deletes an existing budget entry.
 * 
 * @param api - The authenticated Axios instance.
 * @param budgetId - The ID of the budget to delete.
 * @returns A promise resolving on successful deletion.
 */
export const deleteBudget = async (
  api: AxiosInstance,
  budgetId: string
) => {
  try {
    const response = await api.delete(`/budgets/${budgetId}`);
    console.log('Budget deleted successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error(`Error deleting budget ${budgetId}:`, error);
    throw error;
  }
}; 
