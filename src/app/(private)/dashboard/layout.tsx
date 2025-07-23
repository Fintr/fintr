"use client";
import { TabsWrapper } from "@/components/tabs-wrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useDashboardData } from "@/hooks/async/useDashboardData";
import { useGetSpaceCode } from "@/hooks/useGetSpaceCode";
import { useAuthApi } from "@/hooks/useAuthApi";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize API client for authentication
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  
  // Fetch spaceCode first (this will trigger the /auth/private call)
  // Only call this on the client side to avoid SSR issues
  const spaceCode = useGetSpaceCode(api);
  
  // Load dashboard data (accounts and categories) for all dashboard routes
  const { data, isLoading, isError } = useDashboardData();

  return (
    <div className="px-0 sm:px-4 md:px-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6 gap-2 md:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary leading-tight">
            My Goal to Financial Freedom
          </h1>
          <p className="text-primary/70 text-sm md:text-base">
            Having enough passive income to cover my expenses and being able to
            travel 3 months a year.
          </p>
        </div>
      </div>
      <div>
        <TabsWrapper>
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            <TabsList className="w-full min-w-[600px] sm:min-w-0 bg-white border flex-nowrap overflow-x-auto">
              <TabsTrigger asChild value="transactions">
                <Link prefetch href="/dashboard/">Transactions</Link>
              </TabsTrigger>
              <TabsTrigger asChild value="budgets">
                <Link prefetch href="/dashboard/budgets">Budgets</Link>
              </TabsTrigger>
              <TabsTrigger asChild value="goals">
                <Link prefetch href="/dashboard/goals">Goals</Link>
              </TabsTrigger>
              <TabsTrigger asChild value="investments">
                <Link prefetch href="/dashboard/investments">Investments</Link>
              </TabsTrigger>
              <TabsTrigger asChild value="insights">
                <Link prefetch href="/dashboard/insights">Insights</Link>
              </TabsTrigger>
              <TabsTrigger asChild value="database">
                <Link prefetch href="/dashboard/database">Database</Link>
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="pt-2">{children}</div>
        </TabsWrapper>
      </div>
    </div>
  );
}
