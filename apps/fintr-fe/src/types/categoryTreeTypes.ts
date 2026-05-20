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

  if (!categoryId) {
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
