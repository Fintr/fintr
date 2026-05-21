export interface CategoryTreeOption {
  id: string;
  label: string;
  value: string;
  name: string;
  parentId: string | null;
  children?: CategoryTreeOption[];
}

export interface CategoryAssignment {
  categoryId: string;
  subcategoryId: string | null;
}

const CATEGORY_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isCategoryPickerId = (value: string): boolean =>
  CATEGORY_ID_PATTERN.test(value.trim());

export const formatCategoryPickerValue = (
  assignment: CategoryAssignment,
): string => {
  if (assignment.subcategoryId) {
    return `${assignment.categoryId}:${assignment.subcategoryId}`;
  }

  return assignment.categoryId;
};

export const parseCategoryPickerValue = (
  value: string,
): CategoryAssignment | null => {
  if (!value) {
    return null;
  }

  const [categoryId, subcategoryId] = value.split(":");

  if (!categoryId || !isCategoryPickerId(categoryId)) {
    return null;
  }

  if (subcategoryId && !isCategoryPickerId(subcategoryId)) {
    return null;
  }

  return {
    categoryId,
    subcategoryId: subcategoryId || null,
  };
};

export type CategoryTriggerDisplay = {
  primary: string;
  secondary: string | null;
};

export const normalizeCategoryMatchKey = (value: string): string =>
  value
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const categoryPickerValueFromName = (
  categoryName: string,
  options: CategoryTreeOption[],
): string => {
  const key = normalizeCategoryMatchKey(categoryName);

  if (!key) {
    return "";
  }

  for (const parent of options) {
    if (
      normalizeCategoryMatchKey(parent.name) === key
      || normalizeCategoryMatchKey(parent.label) === key
    ) {
      return parent.id;
    }

    for (const child of parent.children ?? []) {
      if (
        normalizeCategoryMatchKey(child.name) === key
        || normalizeCategoryMatchKey(child.label) === key
      ) {
        return formatCategoryPickerValue({
          categoryId: parent.id,
          subcategoryId: child.id,
        });
      }
    }
  }

  return categoryName.trim();
};

export const categoryPickerValueFromTransaction = (input: {
  categoryId?: string | null;
  subcategoryId?: string | null;
  categoryName?: string;
}): string => {
  const categoryId = input.categoryId?.trim();

  if (categoryId) {
    return formatCategoryPickerValue({
      categoryId,
      subcategoryId: input.subcategoryId?.trim() || null,
    });
  }

  return input.categoryName?.trim() ?? "";
};

export const categoryPickerValueFromReceiptOrTransaction = (
  input: {
    categoryId?: string | null;
    subcategoryId?: string | null;
    categoryName?: string;
  },
  options: CategoryTreeOption[],
): string => {
  if (input.categoryId?.trim()) {
    return categoryPickerValueFromTransaction(input);
  }

  if (input.categoryName?.trim()) {
    return categoryPickerValueFromName(input.categoryName, options);
  }

  return "";
};

export const getCategoryTriggerDisplay = (
  value: string,
  options: CategoryTreeOption[],
): CategoryTriggerDisplay => {
  const assignment = parseCategoryPickerValue(value);

  if (!assignment) {
    return {
      primary: value,
      secondary: null,
    };
  }

  const parent = options.find((option) => option.id === assignment.categoryId);

  if (!parent) {
    return {
      primary: value,
      secondary: null,
    };
  }

  if (!assignment.subcategoryId) {
    return {
      primary: parent.label,
      secondary: null,
    };
  }

  const sub = parent.children?.find(
    (child) => child.id === assignment.subcategoryId,
  );

  return {
    primary: parent.label,
    secondary: sub?.label ?? null,
  };
};

/** Category `name` for APIs that resolve by name (receipts, legacy payloads). */
export const getCategoryNameForApi = (
  value: string,
  options: CategoryTreeOption[],
): string => {
  const assignment = parseCategoryPickerValue(value);

  if (!assignment) {
    return value.trim();
  }

  const parent = options.find((option) => option.id === assignment.categoryId);

  if (!parent) {
    return value.trim();
  }

  if (assignment.subcategoryId) {
    const sub = parent.children?.find(
      (child) => child.id === assignment.subcategoryId,
    );

    if (sub) {
      return sub.name;
    }
  }

  return parent.name;
};

export const buildTransactionCategoryFields = (
  pickerValue: string,
  options: CategoryTreeOption[],
): {
  categoryName: string;
  categoryId?: string;
  subcategoryId?: string;
} => {
  const assignment = parseCategoryPickerValue(pickerValue);

  if (!assignment) {
    return {
      categoryName: pickerValue.trim(),
    };
  }

  return {
    categoryName: getCategoryNameForApi(pickerValue, options),
    categoryId: assignment.categoryId,
    ...(assignment.subcategoryId
      ? { subcategoryId: assignment.subcategoryId }
      : {}),
  };
};

export const getCategoryDisplayLabel = (
  value: string,
  options: CategoryTreeOption[],
): string => {
  const assignment = parseCategoryPickerValue(value);
  if (!assignment) {
    return "";
  }

  const parent = options.find((option) => option.id === assignment.categoryId);
  if (!parent) {
    return value;
  }

  if (!assignment.subcategoryId) {
    return parent.label;
  }

  const sub = parent.children?.find(
    (child) => child.id === assignment.subcategoryId,
  );

  if (!sub) {
    return parent.label;
  }

  return `${parent.label} › ${sub.label}`;
};

export const flattenCategoryTreeToParents = (
  options: CategoryTreeOption[],
): CategoryTreeOption[] => {
  return options.map((parent) => ({
    ...parent,
    children: parent.children ?? [],
  }));
};
