export const parsePercentageString = (value: string): number => {
  const parsed = parseFloat(value.replace("%", "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatUsageCaption = (
  usagePercentage: number,
  overAmountLabel?: string,
): string => {
  const display = usagePercentage.toFixed(1);

  if (usagePercentage > 100) {
    const overSuffix = overAmountLabel
      ? ` · ${overAmountLabel} over`
      : " · over budget";
    return `${display}% of budget used${overSuffix}`;
  }

  return `${display}% of budget used`;
};
