import { atom } from 'jotai';
import { getCurrentMonthDates, getMonthNumber, getMonthDateRange } from '@/utils/dateUtils';

// Helper function to check if date range spans more than 1 month
export function isMultiMonthRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check if they're in different months or years
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();
  
  // If different years, definitely multi-month
  if (startYear !== endYear) return true;
  
  // If different months, multi-month
  if (startMonth !== endMonth) return true;
  
  // Same month, check if it spans from first day to last day (single month)
  const firstDay = start.getDate();
  const lastDay = end.getDate();
  const daysInMonth = new Date(startYear, startMonth + 1, 0).getDate();
  
  // If it's the full month (first day to last day), it's single month
  if (firstDay === 1 && lastDay === daysInMonth) return false;
  
  // Otherwise, if it's within the same month but not the full month, it's still single month
  return false;
}

// Helper function to convert date range to month/year format
export function dateRangeToMonthYear(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startYear = start.getFullYear();
  const startMonthNum = start.getMonth() + 1;
  const endYear = end.getFullYear();
  const endMonthNum = end.getMonth() + 1;
  
  // Convert month number to month name
  const monthNames = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];
  
  const startMonth = monthNames[startMonthNum - 1];
  const endMonth = monthNames[endMonthNum - 1];
  
  return {
    selectedMonth: startMonth,
    selectedYear: startYear.toString(),
    startMonth: startMonth,
    startYear: startYear.toString(),
    endMonth: endMonth,
    endYear: endYear.toString(),
  };
}

// Helper function to convert month/year to date range
export function monthYearToDateRange(
  startMonth: string,
  startYear: string,
  endMonth: string,
  endYear: string
): { startDate: string; endDate: string } {
  const startMonthNumber = getMonthNumber(startMonth);
  const startYearNum = parseInt(startYear);
  const endMonthNumber = getMonthNumber(endMonth);
  const endYearNum = parseInt(endYear);
  
  const startDateRange = getMonthDateRange(startYearNum, startMonthNumber);
  const endDateRange = getMonthDateRange(endYearNum, endMonthNumber);
  
  return {
    startDate: startDateRange.startDate,
    endDate: endDateRange.endDate,
  };
}

// Base atoms for date filter state
const { firstDay, lastDay } = getCurrentMonthDates();

// Primary date range atoms (the source of truth)
export const dateFilterStartDateAtom = atom<string>(firstDay);
export const dateFilterEndDateAtom = atom<string>(lastDay);

// Derived atom to check if it's a multi-month range
export const isMultiMonthFilterAtom = atom((get) => {
  const startDate = get(dateFilterStartDateAtom);
  const endDate = get(dateFilterEndDateAtom);
  return isMultiMonthRange(startDate, endDate);
});

// Derived atom to get filter type (single or range)
export const dateFilterTypeAtom = atom((get) => {
  const isMultiMonth = get(isMultiMonthFilterAtom);
  return isMultiMonth ? "range" : "single";
});

// Derived atoms for month/year values (for UI)
export const dateFilterMonthYearAtom = atom((get) => {
  const startDate = get(dateFilterStartDateAtom);
  const endDate = get(dateFilterEndDateAtom);
  return dateRangeToMonthYear(startDate, endDate);
});

