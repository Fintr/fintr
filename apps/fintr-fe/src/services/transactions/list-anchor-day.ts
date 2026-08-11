/**
 * Pick the day section to land on for a newest-first transaction list:
 * the newest day that is today or in the past (so future days stay above).
 */
export const findTransactionsListAnchorDayKey = (params: {
  dayKeysNewestFirst: string[];
  todayKey: string;
}): string | null => {
  const todayKey = params.todayKey.trim();
  if (!todayKey) return null;

  for (const dayKey of params.dayKeysNewestFirst) {
    if (dayKey && dayKey <= todayKey) {
      return dayKey;
    }
  }

  return null;
};

/** Whether an ISO day key falls inside an inclusive YYYY-MM-DD range. */
export const isoDayKeyInInclusiveRange = (params: {
  dayKey: string;
  startDate: string;
  endDate: string;
}): boolean => {
  const dayKey = params.dayKey.slice(0, 10);
  const startDate = params.startDate.slice(0, 10);
  const endDate = params.endDate.slice(0, 10);
  if (!dayKey || !startDate || !endDate) return false;
  return dayKey >= startDate && dayKey <= endDate;
};

/**
 * Newest-first pages often split a day across page boundaries. The anchor day
 * is fully loaded once an older day appears, or there are no further pages.
 */
export const isAnchorDayFullyLoaded = (params: {
  dayKeysNewestFirst: string[];
  anchorDayKey: string;
  hasNextPage: boolean;
}): boolean => {
  const anchorDayKey = params.anchorDayKey.trim();
  if (!anchorDayKey) return true;
  if (!params.hasNextPage) return true;

  return params.dayKeysNewestFirst.some(
    (dayKey) => Boolean(dayKey) && dayKey < anchorDayKey,
  );
};
