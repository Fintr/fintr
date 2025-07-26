"use client";
import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import { useLocalStorage } from "./useLocalStorage";

export function useGetSpaceCode(api: AxiosInstance) {
  const isClient = typeof window !== 'undefined';
  const [spaceCode, setSpaceCode] = useLocalStorage("spaceCode", "");

  const _getSpaceCode = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const response = await api.get("/auth/private");
      const fetchedSpaceCode = response.data?.data?.spaceCode;
      if (isClient && fetchedSpaceCode) {
        setSpaceCode(fetchedSpaceCode);
      }
      return response.data;
    },
    enabled: isClient && !spaceCode, // Only run if on client and spaceCode is not already set in local storage state
    staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
    cacheTime: 10 * 60 * 1000, // Data stays in cache for 10 minutes
  });

  // Return the spaceCode from localStorage, which is reactive
  return spaceCode;
}
