/**
 * Enum representing transaction category types
 */
import { CategoryTypeEnum } from "./categoryTypes";
/**
 * Interface for creating a new transaction category
 */
export interface CreateTransactionCategoryType {
  name: string;
  categoryType: CategoryTypeEnum;
}

/**
 * Interface for transaction category data
 */
export interface TransactionCategory {
  id: string;
  name: string;
  categoryType: CategoryTypeEnum;
  color?: string; // Optional color property for UI
}
