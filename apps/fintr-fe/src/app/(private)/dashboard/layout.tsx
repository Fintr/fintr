"use client";
import { TabsWrapper } from "@/components/tabs-wrapper";
import MobileStickyHeader from "@/components/dashboard/mobile-sticky-header";
import BottomNavigation from "@/components/dashboard/bottom-navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useDashboardData } from "@/hooks/async/useDashboardData";
import { useGetSpaceCode } from "@/hooks/useGetSpaceCode";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useTransactionsRealtime } from "@/hooks/useTransactionsRealtime";
import { useSpaceSettingsRealtime } from "@/hooks/useSpaceSettingsRealtime";
import { useOpenTransactionRequest } from "@/hooks/useOpenTransactionRequest";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { cn, shouldShowV2Features, formatCurrency } from "@/lib/utils";
import { periodNetLabel } from "@/utils/periodNetLabel";
import { Suspense, useEffect, useRef, useState } from "react";
import { useScrollToTopOnNavigate } from "@/hooks/scroll-to-top-on-navigate";
import { useAtomValue, useSetAtom } from "jotai";
import { dashboardShellReadyAtom } from "@/atoms/dashboardAtoms";
import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import {
  dateFilterEndDateAtom,
  dateFilterStartDateAtom,
} from "@/atoms/dateFilterAtoms";
import { Edit, ArrowRight } from "lucide-react";
import ExpandableTextarea from "@/components/ui/expandable-textarea";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateFinancialFreedomDescription,
  UpdateFinancialFreedomDescriptionType,
} from "@/services/goals/mutations";
import { toast } from "sonner";
import { prefetchRecurringSeries } from "@/hooks/async/useRecurringSeries";
import { usePrefetchDashboardNavRoutes } from "@/hooks/usePrefetchDashboardNavRoutes";
import { useBrowserOnline } from "@/hooks/useOfflineReadMode";
import { warmBadgeImages } from "@/lib/badges/warm-badge-images";
import { warmInsightProfileImages } from "@/lib/insights/warm-insight-profile-images";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import {
  calculateBottomPadding,
  calculateHeaderSpacerHeight,
} from "@/lib/platform-detection";
import { resolveDashboardShellPresentation } from "@/lib/dashboard-shell-route";
import { DetailPushNavigationProvider, DashboardPushChildren } from "@/components/dashboard/detail-push-transition";
import { shouldShowImmediateBackButton } from "@/lib/dashboard-back-button-routes";
import { CachedBottomNavScreens } from "@/components/dashboard/cached-bottom-nav-screens";
import { usePendingDashboardBottomTab } from "@/hooks/usePendingDashboardBottomTab";
import {
  commitDashboardClientNavigation,
  interceptDashboardTabClick,
  resolveDashboardClientNavigation,
  syncDashboardCommittedPathnameFromLocation,
} from "@/lib/dashboard-nav-routes";
import { rememberDetailHref } from "@/utils/detailSearchParam";
import { DashboardClientRoute } from "@/components/dashboard/dashboard-client-route";

const DashboardScrollToTop = ({
  scrollContainerRef,
}: {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) => {
  useScrollToTopOnNavigate(scrollContainerRef);
  return null;
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const mainScrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    isAndroidNative,
    isIOSNative,
    safeAreaInsetBottom,
    safeAreaInsetTop,
    hasAndroid3ButtonNav,
  } = usePlatformDetection();

  const bottomPadding = calculateBottomPadding(
    isAndroidNative,
    isIOSNative,
    safeAreaInsetBottom,
    hasAndroid3ButtonNav
  );

  const headerSpacerHeight = calculateHeaderSpacerHeight(
    isAndroidNative,
    isIOSNative,
    safeAreaInsetTop
  );
  
  const { pendingTab, setPendingTab, pathname } = usePendingDashboardBottomTab();
  // Skip dashboard layout elements for standalone subscription create page
  const isStandalonePage = pathname.startsWith('/dashboard/subscriptions/create');
  const onTabClick = (href: string) => (event: React.MouseEvent) => {
    if (!interceptDashboardTabClick(event)) {
      return;
    }

    commitDashboardClientNavigation(href);
  };

  useEffect(() => {
    const onPopState = () => {
      syncDashboardCommittedPathnameFromLocation();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a");
      if (!anchor) {
        return;
      }

      const navigation = resolveDashboardClientNavigation({
        href: anchor.getAttribute("href"),
        origin: window.location.origin,
        target: anchor.getAttribute("target"),
        download: anchor.hasAttribute("download"),
        event,
      });
      if (!navigation) {
        return;
      }

      if (navigation.tab) {
        setPendingTab(navigation.tab);
      } else {
        setPendingTab(null);
      }

      rememberDetailHref(navigation.href);
      commitDashboardClientNavigation(navigation.href);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [setPendingTab]);
  const {
    visibleTab,
    usesEmbeddedHeroHeader,
    isLightDashboardRoute,
    showRouteChildren,
  } = resolveDashboardShellPresentation({
    pathname,
    pendingTab,
  });
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  
  const { spaceCode } = useGetSpaceCode(api, isAuthenticated);
  useTransactionsRealtime({ spaceId: spaceCode ?? "" });
  useSpaceSettingsRealtime({ spaceId: spaceCode ?? "" });
  useOpenTransactionRequest();
  const startDate = useAtomValue(dateFilterStartDateAtom);
  const endDate = useAtomValue(dateFilterEndDateAtom);
  const { data, isLoading: isLoadingDashboardData } =
    useDashboardData(startDate, endDate, { shellOnly: isLightDashboardRoute });
  const offlineSyncReady = useAtomValue(offlineSyncReadyAtom);
  const isOnline = useBrowserOnline();
  usePrefetchDashboardNavRoutes();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!spaceCode) {
      return;
    }

    void prefetchRecurringSeries(queryClient, spaceCode);
  }, [offlineSyncReady, queryClient, spaceCode]);
  const setDashboardShellReady = useSetAtom(dashboardShellReadyAtom);
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";

  const showV2Features = shouldShowV2Features();

  const [isEditingGoalDescription, setIsEditingGoalDescription] = useState(false);
  const [goalDescription, setGoalDescription] = useState(data?.goalDescription || "Set your own financial freedom goal, whatever milestone or lifestyle you’re aiming for.");

  // spaceCode is already in useDashboardData query keys — no manual refetch loop.

  useEffect(() => {
    if (data?.goalDescription) {
      setGoalDescription(data.goalDescription);
    }
  }, [data?.goalDescription]);

  useEffect(() => {
    void warmInsightProfileImages();
    void warmBadgeImages();
  }, []);

  useEffect(() => {
    const ready =
      !isStandalonePage &&
      Boolean(spaceCode) &&
      (
        isLightDashboardRoute ||
        !isLoadingDashboardData ||
        !isOnline ||
        offlineSyncReady
      );

    setDashboardShellReady(ready);

    return () => {
      setDashboardShellReady(false);
    };
  }, [
    isStandalonePage,
    spaceCode,
    isLightDashboardRoute,
    isLoadingDashboardData,
    isOnline,
    offlineSyncReady,
    setDashboardShellReady,
  ]);

  const { mutate: updateDefinition, isPending: isUpdatePending } = useMutation<
    any,
    Error,
    UpdateFinancialFreedomDescriptionType
  >({
    mutationFn: async (data) => {
      const result = await updateFinancialFreedomDescription(api, data);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Definition Updated", {
        description: "Your financial freedom definition has been updated.",
      });
      return result;
    },
  });

  // For standalone pages, just return children without dashboard layout
  if (isStandalonePage) {
    return <>{children}</>;
  }

  return (
    <DetailPushNavigationProvider>
    <div
      className={cn(
        "flex min-h-screen flex-col",
        usesEmbeddedHeroHeader &&
          "max-md:h-dvh max-md:max-h-dvh max-md:overflow-hidden",
      )}
    >
      {!usesEmbeddedHeroHeader ? (
        <>
          {/* Mobile Sticky Header */}
          <MobileStickyHeader />

          {/* Spacer for fixed header on mobile (includes safe area for status bar) */}
          <div
            className="mobile-header-spacer md:hidden"
            style={{ height: headerSpacerHeight }}
          />
        </>
      ) : null}

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
                          updateDefinition(
                            { description: goalDescription },
                            {
                              onSuccess: () => {
                                setIsEditingGoalDescription(false);
                              },
                              onError: (error) => {
                                toast.error("Update Failed", {
                                  description:
                                    error.message ||
                                    "Failed to update financial freedom definition.",
                                });
                              },
                            },
                          );
                        }}
                        disabled={isUpdatePending}
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
                
                {data?.financialSummary && (
                  <div className="mt-2">
                    <span className="text-md text-primary/70">
                      {periodNetLabel(parseFloat(data.financialSummary.netSavings))}:{" "}
                    </span>
                    <span className={`text-md font-bold ${
                      parseFloat(data.financialSummary.netSavings) >= 0
                        ? "text-teal-600 dark:text-teal-500"
                        : "text-red-900 dark:text-red-700"
                    }`}>
                      {formatCurrency(parseFloat(data.financialSummary.netSavings), spaceCurrency)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div
            className={cn(
              usesEmbeddedHeroHeader &&
                "max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col",
            )}
          >
            <TabsWrapper
              className={
                usesEmbeddedHeroHeader
                  ? "max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col"
                  : undefined
              }
            >
              <div className="w-full">
                {/* Desktop Horizontal Layout */}
                <TabsList className="hidden md:flex w-full min-w-0 flex-nowrap overflow-x-auto bg-white dark:bg-card dark:shadow-sm">
                  <TabsTrigger asChild value="transactions">
                    <Link
                      href="/dashboard/"
                      scroll={false}
                      onPointerDown={() => setPendingTab("transactions")}
                      onClick={onTabClick("/dashboard/")}
                    >
                      Transactions
                    </Link>
                  </TabsTrigger>
                  <TabsTrigger asChild value="recurring">
                    <Link
                      href="/dashboard/recurring"
                      scroll={false}
                      onPointerDown={() => setPendingTab("recurring")}
                      onClick={onTabClick("/dashboard/recurring")}
                    >
                      Recurring
                    </Link>
                  </TabsTrigger>
                  <TabsTrigger asChild value="budgets">
                    <Link
                      href="/dashboard/budgets"
                      scroll={false}
                      onPointerDown={() => setPendingTab("budgets")}
                      onClick={onTabClick("/dashboard/budgets")}
                    >
                      Budgets
                    </Link>
                  </TabsTrigger>
                  <TabsTrigger asChild value="loans">
                    <Link
                      href="/dashboard/loans"
                      scroll={false}
                      onPointerDown={() => setPendingTab("loans")}
                      onClick={onTabClick("/dashboard/loans")}
                      data-tutorial-target="dashboard-loan-tab"
                    >
                      Loans
                    </Link>
                  </TabsTrigger>
                  {showV2Features && (
                    <>
                      <TabsTrigger asChild value="goals">
                        <Link href="/dashboard/goals">Goals</Link>
                      </TabsTrigger>
                      <TabsTrigger asChild value="investments">
                        <Link href="/dashboard/investments">Investments</Link>
                      </TabsTrigger>
                    </>
                  )}
                  <TabsTrigger asChild value="insights">
                    {/* Insights -> Dashboard */}
                    <Link
                      href="/dashboard/insights"
                      scroll={false}
                      onPointerDown={() => setPendingTab("insights")}
                      onClick={onTabClick("/dashboard/insights")}
                      data-tutorial-target="dashboard-tab"
                    >
                      Dashboard
                    </Link>
                  </TabsTrigger>
                  <TabsTrigger asChild value="space_settings">
                    <Link
                      href="/dashboard/space_settings"
                      scroll={false}
                      onPointerDown={() => setPendingTab("space_settings")}
                      onClick={onTabClick("/dashboard/space_settings")}
                    >
                      Settings
                    </Link>
                  </TabsTrigger>
                </TabsList>
              </div>
              <div
                ref={mainScrollContainerRef}
                className={cn(
                  "pt-0 md:pt-2 flex-1 overflow-y-auto md:pb-0",
                  shouldShowImmediateBackButton(pathname) && "overflow-x-hidden",
                  usesEmbeddedHeroHeader &&
                    "max-md:min-h-0 max-md:bg-background max-md:overscroll-y-auto md:bg-transparent",
                )}
                style={{
                  paddingBottom: usesEmbeddedHeroHeader ? undefined : bottomPadding,
                }}
              >
                <CachedBottomNavScreens
                  activeTab={visibleTab}
                  scrollContainerRef={mainScrollContainerRef}
                />
                <Suspense fallback={null}>
                  <DashboardScrollToTop
                    scrollContainerRef={mainScrollContainerRef}
                  />
                  {showRouteChildren ? (
                    <DashboardPushChildren
                      pathname={pathname}
                      search={
                        typeof window === "undefined"
                          ? undefined
                          : window.location.search.replace(/^\?/, "")
                      }
                    >
                      <DashboardClientRoute
                        pathname={pathname}
                        fallback={children}
                      />
                    </DashboardPushChildren>
                  ) : null}
                </Suspense>
              </div>
            </TabsWrapper>
          </div>
      {/* Bottom Navigation for Mobile */}
      <BottomNavigation />
    </div>
    </DetailPushNavigationProvider>
  );
}
