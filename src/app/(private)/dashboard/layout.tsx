"use client";
import { TabsWrapper } from "@/components/tabs-wrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useDashboardData } from "@/hooks/async/useDashboardData";
import { useGetSpaceCode } from "@/hooks/useGetSpaceCode";
import { useAuthApi } from "@/hooks/useAuthApi";
import { shouldShowV2Features } from "@/lib/utils";
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

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  
  const { spaceCode } = useGetSpaceCode(api);
  const { data, isLoading, isError, refetch } = useDashboardData();
  
  const showV2Features = shouldShowV2Features();

  const [isEditingGoalDescription, setIsEditingGoalDescription] = useState(false);
  const [goalDescription, setGoalDescription] = useState(data?.goalDescription || "Having enough passive income to cover my expenses and being able to travel 3 months a year.");
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

  // Only show loading spinner if spaceCode is not available OR dashboard data is loading
  if (!spaceCode || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <Image 
          src="https://raw.githubusercontent.com/paoloparaiso/Fintr/c273332c59168c59539d499b2ee119186af8f88a/Fintr_Logo.png" 
          alt="Fintr Logo" 
          width={100} 
          height={100} 
          className="animate-pulse"
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:px-4 md:px-8 min-h-screen flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6 gap-2 md:gap-0">
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
                <Link prefetch href="/dashboard/insights">Insights</Link>
              </TabsTrigger>
              <TabsTrigger asChild value="database">
                <Link prefetch href="/dashboard/database">Database</Link>
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="pt-2 flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</div>
        </TabsWrapper>
      </div>
    </div>
  );
}
