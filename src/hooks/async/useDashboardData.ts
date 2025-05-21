import { fetchDashboardData } from "@/services/spaces/queries";
import { useQuery } from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";

export const useDashboardData = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const { data, error, isLoading, isError, isSuccess } = useQuery({
    queryKey: ["dashboard", localStorage.getItem("spaceCode")],
    queryFn: () => fetchDashboardData(api),
    enabled: !!localStorage.getItem("spaceCode"),
  });
  return { data, error, isLoading, isError, isSuccess };
};
