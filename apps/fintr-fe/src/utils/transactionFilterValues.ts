export const normalizeFilterValues = (values: string[]): string[] =>
  values.map((value) => value.trim()).filter(Boolean);

export const serializeFilterValues = (values: string[]): string =>
  JSON.stringify(normalizeFilterValues(values));

export const parseSerializedFilterValues = (raw: unknown): string[] => {
  if (typeof raw !== "string" || raw.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.map((value) => String(value)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

export const areFilterValuesEqual = (
  left: string[],
  right: string[],
): boolean => serializeFilterValues(left) === serializeFilterValues(right);

export const hasAppliedCategoryFilters = (
  categories: string[],
  defaultCategories: string[] = [],
): boolean => !areFilterValuesEqual(categories, defaultCategories);

export const hasAppliedAccountFilters = (accounts: string[]): boolean =>
  accounts.length > 0;

export const hasAppliedTagFilters = (tags: string[]): boolean =>
  tags.length > 0;
