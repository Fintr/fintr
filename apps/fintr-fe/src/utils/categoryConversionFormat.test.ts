import { describe, expect, it } from "vitest";
import { CategoryConversionPreview } from "@/types/categoryConversionTypes";

export const formatConversionSummary = (preview: CategoryConversionPreview) => {
  const parts: string[] = [];

  if (preview.incomeCount > 0) {
    parts.push(`income:${preview.incomeCount}:${preview.incomeTotal}`);
  }

  if (preview.expenseCount > 0) {
    parts.push(`expense:${preview.expenseCount}:${preview.expenseTotal}`);
  }

  return {
    transactionCount: preview.transactionCount,
    budgetCount: preview.budgetCount,
    summary: parts.join("|"),
  };
};

describe("formatConversionSummary", () => {
  it("summarizes income and expense transfer counts", () => {
    const result = formatConversionSummary({
      conversionType: "to_subcategory",
      categoryId: "c1",
      categoryName: "Church",
      transactionCount: 3,
      incomeCount: 1,
      expenseCount: 2,
      incomeTotal: 100,
      expenseTotal: 250,
      budgetCount: 1,
    });

    expect(result.transactionCount).toBe(3);
    expect(result.budgetCount).toBe(1);
    expect(result.summary).toBe("income:1:100|expense:2:250");
  });
});
