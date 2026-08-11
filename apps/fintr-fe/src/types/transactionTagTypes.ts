export interface TransactionTag {
  id: string;
  name: string;
  color: string;
  isDefault?: boolean;
  styleImageUrl?: string;
}

export interface CreateTransactionTagType {
  name: string;
  color?: string;
}

export interface UpdateTransactionTagType {
  name: string;
  color?: string;
}
