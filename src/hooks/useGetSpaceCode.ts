"use client";
import { useQuery } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

export function useGetSpaceCode(api: AxiosInstance) {
  console.log('🏠 useGetSpaceCode hook called');
  console.log('🏠 Current spaceCode in localStorage:', localStorage?.getItem("spaceCode"));
  
  const _getSpaceCode = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      console.log('🏠 Fetching spaceCode from /auth/private...');
      const response = await api.get("/auth/private");
      console.log('🏠 SpaceCode response:', response.data);
      localStorage.setItem("spaceCode", response.data.data.spaceCode);
      return response.data;
    },
    enabled: localStorage && !!!localStorage.getItem("spaceCode"),
  });

  return _getSpaceCode.data?.data.spaceCode;
}
