import { AxiosInstance } from 'axios';
import { getColor, getColorByIndex } from '@/lib/utils';

/**
 * START: Raw API Response Interfaces
 * These interfaces match the exact structure of the API response.
 */
interface ApiSummaryStructure {
  totalIncome: string;
  totalExpenses: string;
  netSavings: string;
}

interface ApiHealthScores {
  savingsPercentage: {
    percentage: string;
    score: number;
  };
  debtToIncomeRatio: string;
  budgetUsage: {
    percentage: string;
    score: number;
  };
  financialHealthScore: string;
}

interface ApiExpenseBreakdownItem {
  categoryName: string;
  amount: string;
  percentage: string;
  currency: string;
}

interface ApiWeeklySpendingItem {
  date: string;
  amount: string;
  percentage: string;
  currency: string;
}

interface ApiMonthlySpendingItem {
  month_year: string;
  total_income: number;
  total_expense: number;
  net_amount: number;
  amount_currency: string;
  id: string | null;
}

interface ApiInsightsResponse {
  summaryStructure: ApiSummaryStructure;
  healthScores: ApiHealthScores;
  expenseBreakdown: ApiExpenseBreakdownItem[];
  weeklySpending: ApiWeeklySpendingItem[];
  monthlySpending: ApiMonthlySpendingItem[];
}
/** END: Raw API Response Interfaces */


/**
 * START: Frontend Data Interfaces
 * These interfaces represent the transformed data structure used by the components.
 */
export interface InsightsSummary {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
}

export interface FinancialHealthScore {
  score: number;
  rating: string;
  description: string;
  savingsPercentage: {
    percentage: string;
    score: number;
  };
  debtToIncomeRatio: number;
  budgetUsage: {
    percentage: string;
    score: number;
  };
}

export interface ExpenseBreakdown {
  name: string;
  value: number;
  color: string;
  percentage: string;
}

export interface WeeklySpending {
  day: string;
  amount: number;
}

export interface MonthlySpending {
  month: string;
  income: number;
  expenses: number;
  savings: number;
}

export interface InsightsData {
  summary: InsightsSummary;
  healthScores: FinancialHealthScore;
  expenseBreakdown: ExpenseBreakdown[];
  weeklySpending: WeeklySpending[];
  monthlySpending: MonthlySpending[];
}
/** END: Frontend Data Interfaces */

/**
 * Converts month name to month number (1-12)
 */
const getMonthNumber = (monthName: string): string => {
  const months = {
    'january': '01',
    'february': '02', 
    'march': '03',
    'april': '04',
    'may': '05',
    'june': '06',
    'july': '07',
    'august': '08',
    'september': '09',
    'october': '10',
    'november': '11',
    'december': '12'
  };
  return months[monthName.toLowerCase() as keyof typeof months] || '01';
};

/**
 * Formats date to YYYY-MM-DD format for API
 */
const formatDateForAPI = (year: string, month: string, day: string = '01'): string => {
  const monthNum = getMonthNumber(month);
  return `${year}-${monthNum}-${day.padStart(2, '0')}`;
};

/**
 * Gets the last day of a month
 */
const getLastDayOfMonth = (year: string, month: string): string => {
  const monthNum = parseInt(getMonthNumber(month));
  const date = new Date(parseInt(year), monthNum, 0);
  return date.getDate().toString().padStart(2, '0');
};

/**
 * Aggregates weekly spending data by day.
 * The API can return multiple entries for the same day, so we sum them up.
 * Orders days so that today is the last day shown.
 */
const aggregateWeeklySpending = (spending: ApiWeeklySpendingItem[] | undefined): WeeklySpending[] => {
  if (!spending) return [];

  const aggregation: { [key: string]: number } = {};
  
  spending.forEach(item => {
    const day = item.date.slice(0, 3); // "Tue" -> "Tue"
    const amount = parseFloat(item.amount);
    if (aggregation[day]) {
      aggregation[day] += amount;
    } else {
      aggregation[day] = amount;
    }
  });

  // Get current day of the week
  const today = new Date();
  const currentDayIndex = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // All days in standard order
  const allDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  // Create ordered days array with current day last
  // If today is Wednesday (index 3), we want: Thu, Fri, Sat, Sun, Mon, Tue, Wed
  const orderedDays: string[] = [];
  
  // Start from tomorrow and go through 6 days, then add today last
  for (let i = 1; i < 7; i++) {
    const dayIndex = (currentDayIndex + i) % 7;
    orderedDays.push(allDays[dayIndex]);
  }
  // Add current day as the last item
  orderedDays.push(allDays[currentDayIndex]);

  return orderedDays.map(day => ({
    day: day,
    amount: aggregation[day] || 0,
  }));
};

/**
 * Fetches and transforms insights data from the API.
 * 
 * @param api - The authenticated Axios instance.
 * @param params - Query parameters object
 * @returns A promise resolving to InsightsData
 */
export const fetchInsights = async (
  api: AxiosInstance,
  params?: {
    filterType?: string;
    selectedMonth?: string;
    selectedYear?: string;
    startMonth?: string;
    startYear?: string;
    endMonth?: string;
    endYear?: string;
    selectedCategory?: string;
  }
): Promise<InsightsData> => {
  try {
    // Format parameters for the backend API
    let startDate: string;
    let endDate: string;
    let categoryName: string;

    // Handle date formatting based on filter type
    if (params?.filterType === 'range') {
      // Date range mode
      startDate = formatDateForAPI(
        params.startYear || new Date().getFullYear().toString(),
        params.startMonth || 'january'
      );
      endDate = formatDateForAPI(
        params.endYear || new Date().getFullYear().toString(),
        params.endMonth || 'december',
        getLastDayOfMonth(
          params.endYear || new Date().getFullYear().toString(),
          params.endMonth || 'december'
        )
      );
    } else {
      // Single month mode (default)
      const year = params?.selectedYear || new Date().getFullYear().toString();
      const month = params?.selectedMonth || new Date().toLocaleString('default', { month: 'long' }).toLowerCase();
      
      startDate = formatDateForAPI(year, month);
      endDate = formatDateForAPI(year, month, getLastDayOfMonth(year, month));
    }

    // Handle category
    categoryName = params?.selectedCategory === 'all' || !params?.selectedCategory 
      ? '' 
      : params.selectedCategory;

    const apiParams = {
      startDate,
      endDate,
      categoryName,
    };

    console.log('Sending insights API request with params:', apiParams);

    const response = await api.get('/insights', {
      params: apiParams,
    });
    
    // Raw data from the API
    const apiData: ApiInsightsResponse = response?.data?.data || {};
    
    // Helper to parse percentage strings (e.g., "28.05%") to numbers
    const parsePercentage = (value: string | undefined): number => {
      if (!value) return 0;
      return parseFloat(value.replace('%', ''));
    };

    // Transform the raw API data into the structure the frontend needs
    const transformedData: InsightsData = {
      summary: {
        totalIncome: parseFloat(apiData.summaryStructure?.totalIncome || '0'),
        totalExpenses: parseFloat(apiData.summaryStructure?.totalExpenses || '0'),
        netSavings: parseFloat(apiData.summaryStructure?.netSavings || '0'),
      },
      healthScores: {
        savingsPercentage: {
          percentage: apiData.healthScores?.savingsPercentage?.percentage || "0%",
          score: apiData.healthScores?.savingsPercentage?.score || 0,
        },
        debtToIncomeRatio: parseFloat(apiData.healthScores?.debtToIncomeRatio || '0'),
        budgetUsage: {
          percentage: apiData.healthScores?.budgetUsage?.percentage || "0%",
          score: apiData.healthScores?.budgetUsage?.score || 0,
        },
        score: parsePercentage(apiData.healthScores?.financialHealthScore),
        rating: "", // Will be set below
        description: "", // Will be set below
      },
      expenseBreakdown: apiData.expenseBreakdown?.map((item, index) => ({
        name: item.categoryName,
        value: parseFloat(item.amount),
        color: getColorByIndex(index), // Use unique color based on category name
        percentage: item.percentage, // Assign as string directly
      })) || [],
      weeklySpending: aggregateWeeklySpending(apiData.weeklySpending),
      monthlySpending: apiData.monthlySpending?.map(item => ({
        month: new Date(item.month_year).toLocaleString('default', { month: 'short' }),
        income: item.total_income,
        expenses: item.total_expense, // Keep expenses as positive values
        savings: item.net_amount,
      })) || [],
    };

    // Calculate overall financial health score and rating
    // The score is now directly from the API, so we just set rating/description
    const financialHealthScore = transformedData.healthScores.score;

    if (financialHealthScore >= 80) {
      transformedData.healthScores.rating = "Excellent";
      transformedData.healthScores.description = "Outstanding financial health! Keep up the great work.";
    } else if (financialHealthScore >= 60) {
      transformedData.healthScores.rating = "Good";
      transformedData.healthScores.description = "You're on track to meet your financial goals.";
    } else if (financialHealthScore >= 40) {
      transformedData.healthScores.rating = "Fair";
      transformedData.healthScores.description = "There's room for improvement, but you're making progress.";
    } else {
      transformedData.healthScores.rating = "Poor";
      transformedData.healthScores.description = "Consider reviewing your spending and savings habits.";
    }

    console.log('Transformed insights data:', transformedData);
    
    return transformedData;
  } catch (error) {
    console.error("Error fetching insights data:", error);
    throw error;
  }
}; 
