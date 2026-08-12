export interface CategoryTreeOption {
  id: string;
  label: string;
  value: string;
  name: string;
  parentId: string | null;
  icon?: string;
  color?: string;
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

export const normalizeCategoryMatchKey = (
  value: string | null | undefined,
): string => {
  if (value == null) {
    return "";
  }

  return value
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

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

export const findCategoryTreeOptionForTransaction = (
  input: {
    categoryName: string;
    subcategoryName?: string | null;
  },
  expenseOptions: CategoryTreeOption[],
  incomeOptions: CategoryTreeOption[],
): CategoryTreeOption | null => {
  const findInTree = (options: CategoryTreeOption[]): CategoryTreeOption | null => {
    const categoryKey = normalizeCategoryMatchKey(input.categoryName);
    const subcategoryKey = input.subcategoryName?.trim()
      ? normalizeCategoryMatchKey(input.subcategoryName)
      : null;

    for (const parent of options) {
      if (subcategoryKey) {
        for (const child of parent.children ?? []) {
          if (
            normalizeCategoryMatchKey(child.name) === subcategoryKey
            || normalizeCategoryMatchKey(child.label) === subcategoryKey
          ) {
            return child;
          }
        }
      }

      for (const child of parent.children ?? []) {
        if (
          normalizeCategoryMatchKey(child.name) === categoryKey
          || normalizeCategoryMatchKey(child.label) === categoryKey
        ) {
          return child;
        }
      }

      if (
        normalizeCategoryMatchKey(parent.name) === categoryKey
        || normalizeCategoryMatchKey(parent.label) === categoryKey
      ) {
        return parent;
      }
    }

    return null;
  };

  return findInTree(expenseOptions) ?? findInTree(incomeOptions);
};

export const resolveTransactionCategoryAssignment = (
  input: {
    categoryId?: string | null;
    subcategoryId?: string | null;
    categoryName?: string;
    subcategoryName?: string | null;
  },
  expenseOptions: CategoryTreeOption[],
  incomeOptions: CategoryTreeOption[],
): CategoryAssignment | null => {
  const categoryId = input.categoryId?.trim();
  const subcategoryId = input.subcategoryId?.trim() || null;
  const trees = [expenseOptions, incomeOptions];

  if (categoryId) {
    for (const options of trees) {
      for (const parent of options) {
        if (parent.id === categoryId) {
          return {
            categoryId,
            subcategoryId,
          };
        }

        for (const child of parent.children ?? []) {
          if (child.id === categoryId) {
            return {
              categoryId: parent.id,
              subcategoryId: child.id,
            };
          }
        }
      }
    }

    return {
      categoryId,
      subcategoryId,
    };
  }

  const categoryName = input.categoryName?.trim();

  if (!categoryName) {
    return null;
  }

  const matched = findCategoryTreeOptionForTransaction(
    {
      categoryName,
      subcategoryName: input.subcategoryName,
    },
    expenseOptions,
    incomeOptions,
  );

  if (!matched) {
    return null;
  }

  if (matched.parentId) {
    return {
      categoryId: matched.parentId,
      subcategoryId: matched.id,
    };
  }

  return {
    categoryId: matched.id,
    subcategoryId: null,
  };
};

/** Maps a display name from insights/API to a transactions filter value (id or name). */
export const resolveCategoryFilterFromDisplayName = (
  categoryName: string,
  expenseOptions: CategoryTreeOption[],
  incomeOptions: CategoryTreeOption[],
): string => {
  const trimmed = categoryName.trim();

  if (!trimmed) {
    return "";
  }

  for (const options of [expenseOptions, incomeOptions]) {
    const value = categoryPickerValueFromName(trimmed, options);

    if (isCategoryPickerId(value)) {
      return value;
    }
  }

  return trimmed;
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

export const getCategoryAppearanceForPickerValue = (
  value: string,
  options: CategoryTreeOption[],
): { icon?: string; color?: string } | null => {
  const assignment = parseCategoryPickerValue(value);

  if (!assignment) {
    const resolved = categoryPickerValueFromName(value, options);

    if (resolved && isCategoryPickerId(resolved)) {
      return getCategoryAppearanceForPickerValue(resolved, options);
    }

    return null;
  }

  const parent = options.find((option) => option.id === assignment.categoryId);

  if (!parent) {
    return null;
  }

  if (assignment.subcategoryId) {
    const subcategory = parent.children?.find(
      (child) => child.id === assignment.subcategoryId,
    );

    if (subcategory) {
      return {
        icon: subcategory.icon,
        color: subcategory.color,
      };
    }
  }

  return {
    icon: parent.icon,
    color: parent.color,
  };
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
  expenseOptions: CategoryTreeOption[],
  incomeOptions: CategoryTreeOption[] = [],
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

  const parent =
    expenseOptions.find((option) => option.id === assignment.categoryId)
    ?? incomeOptions.find((option) => option.id === assignment.categoryId);

  if (!parent) {
    return {
      categoryId: assignment.categoryId,
      ...(assignment.subcategoryId
        ? { subcategoryId: assignment.subcategoryId }
        : {}),
      categoryName: "",
    };
  }

  if (assignment.subcategoryId) {
    const subcategory = parent.children?.find(
      (child) => child.id === assignment.subcategoryId,
    );

    if (subcategory) {
      return {
        categoryName: subcategory.name || subcategory.label,
        categoryId: assignment.categoryId,
        subcategoryId: assignment.subcategoryId,
      };
    }
  }

  return {
    categoryName: parent.name || parent.label,
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
