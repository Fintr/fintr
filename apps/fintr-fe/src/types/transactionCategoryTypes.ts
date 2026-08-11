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
  parentId?: string | null;
  icon?: string;
  color?: string;
}

/**
 * Interface for transaction category data
 */
export interface TransactionCategory {
  id: string;
  name: string;
  categoryType: CategoryTypeEnum;
  parentId?: string | null;
  children?: TransactionCategory[];
  icon?: string;
  color?: string;
}
