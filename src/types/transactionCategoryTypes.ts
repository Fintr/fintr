/**
 * Enum representing transaction category types
 */
import { TransactionTypeEnum } from "./transactionTypes";
/**
 * Interface for creating a new transaction category
 */
export interface CreateTransactionCategoryType {
  name: string;
  categoryType: TransactionTypeEnum;
}

/**
 * Interface for transaction category data
 */
export interface TransactionCategory {
  id: string;
  name: string;
  categoryType: TransactionTypeEnum;
  color?: string; // Optional color property for UI
}
