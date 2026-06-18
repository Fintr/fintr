import { AxiosInstance } from "axios";
import { parseCategoryPickerValue } from "@/types/categoryTreeTypes";
import { ActivitiesPage } from "@/types/transactionTypes";

function omitUndefinedParams(
  record: Record<string, string | number | undefined>,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(record).filter(([, v]) => v !== undefined),
  ) as Record<string, string | number>;
}

export type FetchAccountActivitiesPageParams = {
  accountId: string;
  startDate: string;
  endDate: string;
  categoryFilter: string;
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
    categoryFilter,
    searchQuery,
    page,
    minAmount,
    maxAmount,
  } = params;

  const categoryAssignment = parseCategoryPickerValue(
    categoryFilter && categoryFilter !== "all" ? categoryFilter : "",
  );

  const requestParams = omitUndefinedParams({
    startDate,
    endDate,
    searchQuery,
    page,
    ...(minAmount !== undefined ? { minAmount } : {}),
    ...(maxAmount !== undefined ? { maxAmount } : {}),
    ...(categoryAssignment?.categoryId
      ? { categoryId: categoryAssignment.categoryId }
      : {}),
    ...(categoryAssignment?.subcategoryId
      ? { subcategoryId: categoryAssignment.subcategoryId }
      : {}),
    ...(!categoryAssignment?.categoryId &&
    categoryFilter &&
    categoryFilter !== "all"
      ? { categoryName: categoryFilter }
      : {}),
  });

  const response = await api.get(`/transactions/accounts/${accountId}/activities`, {
    params: requestParams,
  });

  const activities = response?.data?.data?.activities || [];
  const totalPages = response?.data?.data?.pagination?.totalPages || 1;
  const totalCount = response?.data?.data?.pagination?.totalCount || 0;
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
    totals: null,
  };
};
