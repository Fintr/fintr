import { CategoryTreeOption } from "@/types/categoryTreeTypes";
import { TransactionCategory } from "@/types/transactionCategoryTypes";
import { OptionType } from "@/types/generalTypes";

/**
 * API category trees should be arrays, but Blueprinter or legacy payloads may
 * return a single object or empty object — normalize before .flatMap / .map.
 */
export const normalizeCategoryTreeNodes = (
  nodes: unknown,
): TransactionCategory[] => {
  if (nodes == null) {
    return [];
  }

  // Dry::Monads Success serialized as { value: [...] } when call returned Success(...) twice
  if (
    typeof nodes === "object" &&
    !Array.isArray(nodes) &&
    "value" in nodes &&
    Array.isArray((nodes as { value: unknown }).value)
  ) {
    return normalizeCategoryTreeNodes((nodes as { value: unknown }).value);
  }

  if (Array.isArray(nodes)) {
    return nodes.map(normalizeCategoryNode);
  }

  if (typeof nodes === "object") {
    const record = nodes as Record<string, unknown>;

    if ("id" in record && ("name" in record || "label" in record)) {
      return [normalizeCategoryNode(record)];
    }

    const values = Object.values(record);
    if (values.length === 0) {
      return [];
    }

    return values
      .filter((value) => value != null && typeof value === "object")
      .map((value) => normalizeCategoryNode(value as Record<string, unknown>));
  }

  return [];
};

const normalizeCategoryNode = (
  node: Record<string, unknown>,
): TransactionCategory => {
  const rawChildren = node.children;
  const children = Array.isArray(rawChildren)
    ? rawChildren.map((child) =>
        normalizeCategoryNode(child as Record<string, unknown>),
      )
    : [];

  return {
    id: String(node.id ?? ""),
    name: String(node.name ?? node.label ?? ""),
    categoryType: (node.categoryType ?? node.category_type ?? "expense") as TransactionCategory["categoryType"],
    parentId: (node.parentId ?? node.parent_id ?? null) as string | null,
    children,
  };
};

export const mapApiCategoryTree = (
  nodes: unknown,
): CategoryTreeOption[] => {
  const list = normalizeCategoryTreeNodes(nodes);

  if (!list.length) {
    return [];
  }

  return list.map((node) => ({
    id: node.id,
    label: node.name,
    value: node.id,
    name: node.name,
    parentId: node.parentId ?? null,
    children: (node.children ?? []).map((child) => ({
      id: child.id,
      label: child.name,
      value: child.id,
      name: child.name,
      parentId: child.parentId ?? node.id,
    })),
  }));
};

export const legacyOptionsToCategoryTree = (
  options: OptionType[],
): CategoryTreeOption[] => {
  return options.map((option) => ({
    id: option.value,
    label: option.label,
    value: option.value,
    name: option.label,
    parentId: null,
    children: [],
  }));
};

export const isCategoryTree = (
  options: OptionType[] | CategoryTreeOption[],
): options is CategoryTreeOption[] => {
  return options.some(
    (option) => "children" in option && Array.isArray(option.children),
  );
};
