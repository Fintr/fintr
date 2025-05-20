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
