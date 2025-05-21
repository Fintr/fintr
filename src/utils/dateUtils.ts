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