export const periodNetLabel = (netAmount: number): string => {
  return netAmount < 0 ? "Net Deficit" : "Net Income";
};
