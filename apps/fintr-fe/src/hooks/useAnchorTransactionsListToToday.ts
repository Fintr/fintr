"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import {
  findTransactionsListAnchorDayKey,
  isAnchorDayFullyLoaded,
  isoDayKeyInInclusiveRange,
} from "@/services/transactions/list-anchor-day";
import { getLocalIsoDateKey } from "@/utils/dateUtils";

const TRANSACTION_DAY_ATTR = "data-transaction-day";
const MAX_ANCHOR_PAGE_FETCHES = 40;

export const transactionDaySelector = (dayKey: string): string =>
  `[${TRANSACTION_DAY_ATTR}="${dayKey}"]`;

export const TRANSACTION_DAY_DATA_ATTR = TRANSACTION_DAY_ATTR;

type UseAnchorTransactionsListToTodayParams = {
  enabled?: boolean;
  /** Inclusive filter range (YYYY-MM-DD). Anchoring only runs when today is in range. */
  startDate: string;
  endDate: string;
  /** Distinct day keys (YYYY-MM-DD) in newest-first list order. */
  dayKeysNewestFirst: string[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage?: () => void;
  /** Reset when the list identity changes (space / filters). */
  resetKey: string;
};

const scrollToAnchorDay = (dayKey: string): boolean => {
  const el = document.querySelector(transactionDaySelector(dayKey));
  if (!(el instanceof HTMLElement)) return false;
  el.scrollIntoView({ block: "start", behavior: "auto" });
  return true;
};

/**
 * On reload / filter change, land the newest-first list on today (or the newest
 * past day). Future month rows stay above — scroll up to see them.
 *
 * Keeps fetching until that day's section is fully loaded (an older day appears,
 * or pages are exhausted), so the anchor day is not split across unloaded pages.
 */
export const useAnchorTransactionsListToToday = (
  params: UseAnchorTransactionsListToTodayParams,
): void => {
  const {
    enabled = true,
    startDate,
    endDate,
    dayKeysNewestFirst,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    resetKey,
  } = params;

  const anchoredForKeyRef = useRef<string | null>(null);
  const pageFetchesRef = useRef(0);
  const fetchNextPageRef = useRef(fetchNextPage);
  fetchNextPageRef.current = fetchNextPage;

  const dayKeysSignature = dayKeysNewestFirst.join("|");

  useEffect(() => {
    anchoredForKeyRef.current = null;
    pageFetchesRef.current = 0;
  }, [resetKey]);

  useLayoutEffect(() => {
    if (!enabled || !startDate || !endDate) return;
    if (anchoredForKeyRef.current === resetKey) return;

    const todayKey = getLocalIsoDateKey(new Date());
    if (
      !isoDayKeyInInclusiveRange({
        dayKey: todayKey,
        startDate,
        endDate,
      })
    ) {
      anchoredForKeyRef.current = resetKey;
      return;
    }

    const anchorDayKey = findTransactionsListAnchorDayKey({
      dayKeysNewestFirst,
      todayKey,
    });

    if (!anchorDayKey) {
      if (
        hasNextPage &&
        !isFetchingNextPage &&
        fetchNextPageRef.current &&
        pageFetchesRef.current < MAX_ANCHOR_PAGE_FETCHES
      ) {
        pageFetchesRef.current += 1;
        fetchNextPageRef.current();
        return;
      }

      anchoredForKeyRef.current = resetKey;
      return;
    }

    // Keep today in view while we fill in the rest of that day from later pages.
    scrollToAnchorDay(anchorDayKey);

    const dayComplete = isAnchorDayFullyLoaded({
      dayKeysNewestFirst,
      anchorDayKey,
      hasNextPage,
    });

    if (
      !dayComplete &&
      hasNextPage &&
      !isFetchingNextPage &&
      fetchNextPageRef.current &&
      pageFetchesRef.current < MAX_ANCHOR_PAGE_FETCHES
    ) {
      pageFetchesRef.current += 1;
      fetchNextPageRef.current();
      return;
    }

    if (dayComplete || !hasNextPage) {
      scrollToAnchorDay(anchorDayKey);
      anchoredForKeyRef.current = resetKey;
    }
  }, [
    enabled,
    startDate,
    endDate,
    dayKeysSignature,
    dayKeysNewestFirst,
    hasNextPage,
    isFetchingNextPage,
    resetKey,
  ]);
};
