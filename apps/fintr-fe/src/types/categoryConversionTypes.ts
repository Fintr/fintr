export type CategoryConversionType = "to_subcategory" | "to_parent";

export type CategoryConversionPreview = {
  conversionType: CategoryConversionType;
  categoryId: string;
  categoryName: string;
  newParentId?: string | null;
  newParentName?: string | null;
  transactionCount: number;
  incomeCount: number;
  expenseCount: number;
  incomeTotal: number;
  expenseTotal: number;
  budgetCount: number;
};

export type CategoryConversionResult = {
  id: string;
  name: string;
  parentId?: string | null;
  redirectParentId: string;
};
