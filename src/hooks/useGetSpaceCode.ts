"use client";
import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

export function useGetSpaceCode(api: AxiosInstance) {
  // SSR-safe check for localStorage
  const isClient = typeof window !== 'undefined';
  const hasSpaceCode = isClient ? !!localStorage.getItem("spaceCode") : false;
  
  const _getSpaceCode = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const response = await api.get("/auth/private");
      if (isClient) {
        localStorage.setItem("spaceCode", response.data.data.spaceCode);
      }
      return response.data;
    },
    enabled: isClient && !hasSpaceCode,
  });

  return _getSpaceCode.data?.data.spaceCode;
}
