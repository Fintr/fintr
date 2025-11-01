import { fetchDashboardData } from "@/services/spaces/queries";
import { useQuery } from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { useSetAtom } from "jotai";
import {
  accountOptionsAtom,
  expenseCategoryOptionsAtom,
  incomeCategoryOptionsAtom,
  categoryOptionsAtom
} from "@/atoms/dashboardAtoms";
import { useEffect } from "react";

export const useDashboardData = () => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const [spaceCode] = useLocalStorage("spaceCode", "");

  // Get atom setters
  const setAccountOptions = useSetAtom(accountOptionsAtom);
  const setExpenseCategoryOptions = useSetAtom(expenseCategoryOptionsAtom);
  const setIncomeCategoryOptions = useSetAtom(incomeCategoryOptionsAtom);
  const setCategoryOptions = useSetAtom(categoryOptionsAtom);

  const { data, error, isLoading, isError, isSuccess, refetch } = useQuery({
    queryKey: ["dashboard", spaceCode],
    queryFn: async () => {
      const response = await fetchDashboardData(api);
      return response;
    },
    enabled: !!spaceCode && isAuthenticated, // Only run this query if spaceCode is available and user is authenticated
  });

  // Automatically populate atoms when data is successfully fetched
  useEffect(() => {
    if (isSuccess && data) {
      setAccountOptions(data.accountOptions || []);
      setExpenseCategoryOptions(data.expenseCategoryOptions || []);
      setIncomeCategoryOptions(data.incomeCategoryOptions || []);
      setCategoryOptions(data.categoryOptions || []);
    }
  }, [isSuccess, data, setAccountOptions, setExpenseCategoryOptions, setIncomeCategoryOptions, setCategoryOptions]);

  return { data, error, isLoading, isError, isSuccess, refetch };
};
