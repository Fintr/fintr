import { AxiosInstance } from "axios";
import { ActivitiesPage } from "@/types/transactionTypes";
import { normalizeFilterValues } from "@/utils/transactionFilterValues";

function omitUndefinedParams(
  record: Record<string, string | number | string[] | undefined>,
): Record<string, string | number | string[]> {
  return Object.fromEntries(
    Object.entries(record).filter(([, v]) => v !== undefined),
  ) as Record<string, string | number | string[]>;
}

export type FetchAccountActivitiesPageParams = {
  accountId: string;
  startDate: string;
  endDate: string;
  categoryFilters: string[];
  searchQuery: string;
  page: number;
  minAmount?: number;
  maxAmount?: number;
};

export const fetchAccountActivitiesPage = async (
  api: AxiosInstance,
  params: FetchAccountActivitiesPageParams,
): Promise<ActivitiesPage> => {
  const {
    accountId,
    startDate,
    endDate,
    categoryFilters,
    searchQuery,
    page,
    minAmount,
    maxAmount,
  } = params;

  const normalizedCategoryFilters = normalizeFilterValues(categoryFilters);

  const requestParams = omitUndefinedParams({
    startDate,
    endDate,
    searchQuery,
    page,
    ...(minAmount !== undefined ? { minAmount } : {}),
    ...(maxAmount !== undefined ? { maxAmount } : {}),
    ...(normalizedCategoryFilters.length > 0
      ? { categoryFilters: normalizedCategoryFilters }
      : {}),
  });

  const response = await api.get(`/transactions/accounts/${accountId}/activities`, {
    params: requestParams,
  });

  const activities = response?.data?.data?.activities || [];
  const totalPages = response?.data?.data?.pagination?.totalPages || 1;
  const totalCount = response?.data?.data?.pagination?.totalCount || 0;
  const totals = response?.data?.data?.totals || null;
  const currentPage = page;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;

  if (!Array.isArray(activities)) {
    console.error("Invalid activity data structure received:", response?.data);
    return {
      activities: [],
      nextPage: null,
      totalPages: null,
      totalCount: null,
      totals: null,
    };
  }

  return {
    activities,
    nextPage,
    totalPages,
    totalCount,
    totals,
  };
};
