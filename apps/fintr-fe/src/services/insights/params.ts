import { AxiosInstance } from "axios";

export interface InsightsQueryParams {
  filterType?: string;
  selectedMonth?: string;
  selectedYear?: string;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  /** Resolved query range (presets, custom, single month). Preferred over month/year reconstruction. */
  startDate?: string;
  endDate?: string;
  selectedCategory?: string;
  selectedCategoryId?: string | null;
  selectedSubcategoryId?: string | null;
  /** Canonical category name from buildTransactionCategoryFields (primary offline filter key). */
  selectedCategoryName?: string;
  selectedTagIds?: string[];
}

const getMonthNumber = (monthName: string): string => {
  const months: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  return months[monthName.toLowerCase()] ?? "01";
};

const formatDateForAPI = (year: string, month: string, day = "01"): string => {
  const monthNum = getMonthNumber(month);
  return `${year}-${monthNum}-${day.padStart(2, "0")}`;
};

const getLastDayOfMonth = (year: string, month: string): string => {
  const monthNum = parseInt(getMonthNumber(month), 10);
  const date = new Date(parseInt(year, 10), monthNum, 0);
  return date.getDate().toString().padStart(2, "0");
};

export const buildInsightsApiParams = (params?: InsightsQueryParams) => {
  let startDate: string;
  let endDate: string;
  let categoryName: string;
  let categoryId: string | undefined;
  let subcategoryId: string | undefined;

  if (params?.startDate && params?.endDate) {
    startDate = params.startDate;
    endDate = params.endDate;
  } else if (params?.filterType === "range") {
    startDate = formatDateForAPI(
      params.startYear || new Date().getFullYear().toString(),
      params.startMonth || "january",
    );
    endDate = formatDateForAPI(
      params.endYear || new Date().getFullYear().toString(),
      params.endMonth || "december",
      getLastDayOfMonth(
        params.endYear || new Date().getFullYear().toString(),
        params.endMonth || "december",
      ),
    );
  } else {
    const year =
      params?.selectedYear || new Date().getFullYear().toString();
    const month =
      params?.selectedMonth ||
      new Date().toLocaleString("default", { month: "long" }).toLowerCase();

    startDate = formatDateForAPI(year, month);
    endDate = formatDateForAPI(year, month, getLastDayOfMonth(year, month));
  }

  if (params?.selectedCategoryId || params?.selectedCategoryName) {
    categoryId = params.selectedCategoryId ?? undefined;
    subcategoryId = params.selectedSubcategoryId ?? undefined;
    categoryName = params.selectedCategoryName?.trim() ?? "";
  } else {
    categoryName =
      params?.selectedCategory === "all" || !params?.selectedCategory
        ? ""
        : params.selectedCategory;
  }

  return {
    startDate,
    endDate,
    categoryName,
    categoryId,
    subcategoryId,
    ...(params?.selectedTagIds?.length
      ? { tagIds: params.selectedTagIds }
      : {}),
  };
};

export const fetchInsightSection = async <T>(
  api: AxiosInstance,
  section: string,
  params?: InsightsQueryParams,
): Promise<T> => {
  const apiParams = buildInsightsApiParams(params);
  const response = await api.get(`/insights/${section}`, { params: apiParams });
  return response?.data?.data as T;
};
