"use client";
import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

export function useGetSpaceCode(api: AxiosInstance) {
  const _getSpaceCode = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const response = await api.get("/auth/private");
      localStorage.setItem("spaceCode", response.data.data.spaceCode);
      return response.data;
    },
    enabled: localStorage && !!!localStorage.getItem("spaceCode"),
  });

  return _getSpaceCode.data?.data.spaceCode;
}
