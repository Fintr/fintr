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
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  
  // Use the SSR-safe useLocalStorage hook
  const [spaceCode] = useLocalStorage("spaceCode", "");
  
  // Get atom setters
  const setAccountOptions = useSetAtom(accountOptionsAtom);
  const setExpenseCategoryOptions = useSetAtom(expenseCategoryOptionsAtom);
  const setIncomeCategoryOptions = useSetAtom(incomeCategoryOptionsAtom);
  const setCategoryOptions = useSetAtom(categoryOptionsAtom);
  
  const { data, error, isLoading, isError, isSuccess } = useQuery({
    queryKey: ["dashboard", spaceCode],
    queryFn: () => fetchDashboardData(api),
    enabled: !!spaceCode,
  });

  // Automatically populate atoms when data is successfully fetched
  useEffect(() => {
    if (isSuccess && data) {
      // Update atoms with the fetched data
      setAccountOptions(data.accountOptions || []);
      setExpenseCategoryOptions(data.expenseCategoryOptions || []);
      setIncomeCategoryOptions(data.incomeCategoryOptions || []);
      setCategoryOptions(data.categoryOptions || []);
    }
  }, [isSuccess, data, setAccountOptions, setExpenseCategoryOptions, setIncomeCategoryOptions, setCategoryOptions]);

  return { data, error, isLoading, isError, isSuccess };
};
