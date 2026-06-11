/**
 * Date utility functions for working with dates in the application
 */

/**
 * Get the first day of a specific month and year
 * @param year - The year
 * @param month - The month (1-12)
 * @returns ISO string of the first day of the month (YYYY-MM-DD)
 */
export function getFirstDayOfMonth(year: number, month: number): string {
  // Month in JS Date is 0-indexed, so we subtract 1
  const date = new Date(year, month - 1, 1);
  // Use YYYY-MM-DD format without timezone issues
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Get the last day of a specific month and year
 * @param year - The year
 * @param month - The month (1-12)
 * @returns ISO string of the last day of the month (YYYY-MM-DD)
 */
export function getLastDayOfMonth(year: number, month: number): string {
  // To get the last day, we go to the first day of the next month and subtract one day
  // Month in JS Date is 0-indexed, so we use the actual month number for the next month
  const lastDay = new Date(year, month, 0).getDate();
  // Use YYYY-MM-DD format without timezone issues
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Creates a date range covering an entire month
 * @param year - The year
 * @param month - The month (1-12)
 * @returns Object with startDate and endDate strings in YYYY-MM-DD format
 */
export function getMonthDateRange(year: number, month: number): { startDate: string; endDate: string } {
  return {
    startDate: getFirstDayOfMonth(year, month),
    endDate: getLastDayOfMonth(year, month)
  };
} 

export const getCurrentMonthDates = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    firstDay: getFirstDayOfMonth(year, month),
    lastDay: getLastDayOfMonth(year, month),
  };
};

const TRANSACTION_DATE_LOCALE = "en-US";

/** Stable day bucket for grouping transactions (no weekday). */
export function getTransactionDayGroupKey(dateInput: Date | string): string {
  return new Date(dateInput).toLocaleDateString(TRANSACTION_DATE_LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Day divider label, e.g. "June 11, 2026 – Thursday". */
export function formatTransactionDayDividerDate(dateInput: Date | string): string {
  const date = new Date(dateInput);
  const datePart = date.toLocaleDateString(TRANSACTION_DATE_LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const dayPart = date.toLocaleDateString(TRANSACTION_DATE_LOCALE, {
    weekday: "long",
  });

  return `${datePart} – ${dayPart}`;
}

/** Compact row date, e.g. "6/11/2026 – Thursday". */
export function formatTransactionRowDate(dateInput: Date | string): string {
  const date = new Date(dateInput);
  const datePart = date.toLocaleDateString(TRANSACTION_DATE_LOCALE, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  const dayPart = date.toLocaleDateString(TRANSACTION_DATE_LOCALE, {
    weekday: "long",
  });

  return `${datePart} – ${dayPart}`;
}

/**
 * Wide range for account detail / history views (API requires start and end dates).
 */
export function getWideAccountHistoryDateRange(): {
  startDate: string;
  endDate: string;
} {
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 30);
  return {
    startDate: getFirstDayOfMonth(start.getFullYear(), start.getMonth() + 1),
    endDate: getLastDayOfMonth(end.getFullYear(), end.getMonth() + 1),
  };
}

export const monthNames = [
  { value: "january", label: "January" },
  { value: "february", label: "February" },
  { value: "march", label: "March" },
  { value: "april", label: "April" },
  { value: "may", label: "May" },
  { value: "june", label: "June" },
  { value: "july", label: "July" },
  { value: "august", label: "August" },
  { value: "september", label: "September" },
  { value: "october", label: "October" },
  { value: "november", label: "November" },
  { value: "december", label: "December" },
];

export const getYearOptions = () => {
  const thisYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => (thisYear - i).toString());
};

export const getMonthNumber = (monthName: string) => {
  const monthMap: { [key: string]: number } = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };
  return monthMap[monthName.toLowerCase()];
};

/**
 * Formats a date string to a human-readable format with full date, time, and meridian
 * 
 * @param dateString - ISO date string to format
 * @returns Formatted date string (e.g., "Dec 15, 2023 at 2:30 PM") or "Unknown date" if invalid
 * 
 * @example
 * ```tsx
 * formatDateTime("2023-12-15T14:30:00Z") // "Dec 15, 2023 at 2:30 PM"
 * formatDateTime(undefined) // "Unknown date"
 * ```
 */
export const formatDateTime = (dateString?: string): string => {
  if (!dateString) return 'Unknown date';
  
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('Invalid date string provided to formatDateTime:', dateString);
    return 'Invalid date';
  }
};

/**
 * Formats a date string to a simple date format without time
 * 
 * @param dateString - ISO date string to format
 * @returns Formatted date string (e.g., "Dec 15, 2023") or "Unknown date" if invalid
 * 
 * @example
 * ```tsx
 * formatDate("2023-12-15T14:30:00Z") // "Dec 15, 2023"
 * ```
 */
export const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Unknown date';
  
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.warn('Invalid date string provided to formatDate:', dateString);
    return 'Invalid date';
  }
};

/**
 * Formats a date string to show relative time (e.g., "2 hours ago", "3 days ago")
 * 
 * @param dateString - ISO date string to format
 * @returns Relative time string or formatted date if too old
 * 
 * @example
 * ```tsx
 * formatRelativeTime("2023-12-15T14:30:00Z") // "2 hours ago" or "Dec 15, 2023"
 * ```
 */
export const formatRelativeTime = (dateString?: string): string => {
  if (!dateString) return 'Unknown date';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    // If more than a week old, show formatted date
    return formatDate(dateString);
  } catch (error) {
    console.warn('Invalid date string provided to formatRelativeTime:', dateString);
    return 'Invalid date';
  }
};
