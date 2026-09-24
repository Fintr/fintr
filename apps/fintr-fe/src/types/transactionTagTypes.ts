export interface TransactionTag {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
  styleImageUrl?: string;
  stylePresetKey?: string;
}

export interface CreateTransactionTagType {
  name: string;
  color?: string;
  stylePresetKey?: string;
}

export interface UpdateTransactionTagType {
  name: string;
  color?: string;
}
