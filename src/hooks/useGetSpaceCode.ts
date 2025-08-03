"use client";
import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";
import { useLocalStorage } from "./useLocalStorage";
import { useAtomValue, useSetAtom } from "jotai";
import { isWhitelistedAtom, isAdminAtom } from "@/atoms/dashboardAtoms";

export function useGetSpaceCode(api: AxiosInstance) {
  const isClient = typeof window !== 'undefined';
  const [spaceCode, setSpaceCode] = useLocalStorage("spaceCode", "");
  const setIsAdmin = useSetAtom(isAdminAtom);
  const isAdmin = useAtomValue(isAdminAtom);
  const setIsWhitelisted = useSetAtom(isWhitelistedAtom);
  const isWhitelisted = useAtomValue(isWhitelistedAtom);

  const _getSpaceCode = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const response = await api.get("/auth/private");
      const fetchedSpaceCode = response.data?.data?.spaceCode;
      const fetchedIsAdmin = response.data?.data?.isAdmin;
      const fetchedIsWhitelisted = response.data?.data?.isWhitelisted;
      if (isClient) {
        if (fetchedSpaceCode) {
          setSpaceCode(fetchedSpaceCode);
        }
        if (fetchedIsAdmin !== undefined) {
          setIsAdmin(fetchedIsAdmin);
        }
        if (fetchedIsWhitelisted !== undefined) {
          setIsWhitelisted(fetchedIsWhitelisted);
        }
      }
      return response.data;
    },
    enabled: isClient && (
      !spaceCode || 
      isAdmin === null || 
      isWhitelisted === null
    ), // Only run if on client and spaceCode is not already set in local storage state
    staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
    cacheTime: 10 * 60 * 1000, // Data stays in cache for 10 minutes
  });

  // Return the spaceCode and isAdmin from localStorage, which are reactive
  return { spaceCode };
}
