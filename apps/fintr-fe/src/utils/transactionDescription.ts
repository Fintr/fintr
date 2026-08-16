export const transactionEntityLabel = (
  entityName?: string | null,
): string => {
  return entityName?.trim() ?? "";
};

export const transactionRowTitle = ({
  description,
  fallback = "",
}: {
  description?: string | null;
  fallback?: string;
}): string => {
  return description?.trim() || fallback.trim();
};

/** Merchant (or payer) on its own; category only when the title is already a description. */
export const transactionSecondaryLine = ({
  description,
  entityName,
  categoryName,
}: {
  description?: string | null;
  entityName?: string | null;
  categoryName?: string | null;
}): string => {
  const merchant = transactionEntityLabel(entityName);
  const hasDescription = Boolean(description?.trim());
  const category = categoryName?.trim() ?? "";

  return [merchant, hasDescription ? category : ""]
    .filter(Boolean)
    .join(" · ");
};
