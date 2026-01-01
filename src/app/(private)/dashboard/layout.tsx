"use client";
import { TabsWrapper } from "@/components/tabs-wrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useDashboardData } from "@/hooks/async/useDashboardData";
import { useGetSpaceCode } from "@/hooks/useGetSpaceCode";
import { useAuthApi } from "@/hooks/useAuthApi";
import { shouldShowV2Features, formatCurrency } from "@/lib/utils";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Edit, ArrowRight } from "lucide-react";
import ExpandableTextarea from "@/components/ui/expandable-textarea";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateFinancialFreedomDescription,
  UpdateFinancialFreedomDescriptionType,
} from "@/services/goals/mutations";
import { toast } from "sonner";
import LoadingScreen from "@/components/ui/loading-screen";
import { usePathname } from "next/navigation";
import BottomNavigation from "@/components/dashboard/bottom-navigation";
import MobileStickyHeader from "@/components/dashboard/mobile-sticky-header";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Skip dashboard layout elements for standalone subscription create page
  const isStandalonePage = pathname.startsWith('/dashboard/subscriptions/create');
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  
  const { spaceCode } = useGetSpaceCode(api, isAuthenticated);
  const { data, isLoading: isLoadingDashboardData, isError, refetch } = useDashboardData();
  
  const showV2Features = shouldShowV2Features();

  const [isEditingGoalDescription, setIsEditingGoalDescription] = useState(false);
  const [goalDescription, setGoalDescription] = useState(data?.goalDescription || "Set your own financial freedom goal, whatever milestone or lifestyle you’re aiming for.");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (spaceCode) {
      refetch();
    }
  }, [spaceCode, refetch]);

  useEffect(() => {
    if (data?.goalDescription) {
      setGoalDescription(data.goalDescription);
    }
  }, [data?.goalDescription]);

  const { mutate: updateDefinition, status: updateStatus } = useMutation<any, Error, UpdateFinancialFreedomDescriptionType>({
    mutationFn: (data) => updateFinancialFreedomDescription(api, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Definition Updated", {
        description: "Your financial freedom definition has been updated.",
      });
      setIsEditingGoalDescription(false);
    },
    onError: (error) => {
      toast.error("Update Failed", {
        description: error.message || "Failed to update financial freedom definition.",
      });
    },
  });

  // For standalone pages, just return children without dashboard layout
  if (isStandalonePage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Only show loading spinner if spaceCode is not available OR dashboard data is loading */}
      {(!spaceCode || isLoadingDashboardData) ? (
        <div className="flex-1">
          <LoadingScreen />
        </div>
      ) : (
        <>
          {/* Mobile Sticky Header */}
          <MobileStickyHeader />
          
          {/* Spacer for fixed header on mobile */}
          <div className="h-[44px] md:h-0" />
      
          <div className="p-0 md:p-4 md:px-8 flex flex-col">
            <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6 gap-2 md:gap-0">
              <div className="w-full">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary leading-tight">
                  My Goal to Financial Freedom
                </h1>
                <div className="flex items-center gap-2 w-full">
                  {!isEditingGoalDescription ? (
                    <p className="text-primary/70 text-sm md:text-base">
                      {goalDescription}
                    </p>
                  ) : (
                    <div className="relative w-full">
                      <ExpandableTextarea
                        id="financialFreedomDefinition"
                        value={goalDescription}
                        onChange={(e) => setGoalDescription(e.target.value)}
                        className="w-full min-h-[60px] p-3 pr-12 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-primary/70 md:text-base"
                        placeholder="Describe what financial freedom means to you personally"
                        rows={2}
                      />  
                      <Button
                        className="absolute right-3 bottom-3 bg-primary hover:bg-primary/80 rounded-full p-2 h-8 w-8"
                        size="icon"
                        onClick={() => {
                          updateDefinition({ description: goalDescription });
                        }}
                        disabled={updateStatus === 'loading'}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {!isEditingGoalDescription && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsEditingGoalDescription(true)}
                      className="h-6 w-6 text-primary hover:bg-gray-100 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {/* Current Savings Display */}
                {data?.financialSummary && (
                  <div className="mt-2">
                    <span className="text-md text-primary/70">Savings: </span>
                    <span className={`text-md font-bold ${
                      parseFloat(data.financialSummary.netSavings) >= 0 
                        ? 'text-teal-600' 
                        : 'text-red-900'
                    }`}>
                      {formatCurrency(parseFloat(data.financialSummary.netSavings))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <TabsWrapper>
              <div className="w-full">
                {/* Desktop Horizontal Layout */}
                <TabsList className="hidden md:flex w-full min-w-0 bg-white border flex-nowrap overflow-x-auto">
                  <TabsTrigger asChild value="transactions">
                    <Link prefetch href="/dashboard/">Transactions</Link>
                  </TabsTrigger>
                  <TabsTrigger asChild value="budgets">
                    <Link prefetch href="/dashboard/budgets">Budgets</Link>
                  </TabsTrigger>
                  <TabsTrigger asChild value="loans">
                    <Link prefetch href="/dashboard/loans" data-tutorial-target="dashboard-loan-tab">Loans</Link>
                  </TabsTrigger>
                  {showV2Features && (
                    <>
                      <TabsTrigger asChild value="goals">
                        <Link prefetch href="/dashboard/goals">Goals</Link>
                      </TabsTrigger>
                      <TabsTrigger asChild value="investments">
                        <Link prefetch href="/dashboard/investments">Investments</Link>
                      </TabsTrigger>
                    </>
                  )}
                  <TabsTrigger asChild value="insights">
                    {/* Insights -> Dashboard */}
                    <Link prefetch href="/dashboard/insights" data-tutorial-target="dashboard-tab">Dashboard</Link>
                  </TabsTrigger>
                  <TabsTrigger asChild value="space_settings">
                    <Link prefetch href="/dashboard/space_settings">Settings</Link>
                  </TabsTrigger>
                </TabsList>
              </div>
              <div className="pt-0 md:pt-2 flex-1 overflow-y-auto pb-20 md:pb-0">{children}</div>
            </TabsWrapper>
          </div>
        </>
      )}
      {/* Bottom Navigation for Mobile - Always show so users can access logout even during loading */}
      <BottomNavigation />
    </div>
  );
}
