"use client";

import dynamic from "next/dynamic";
import {
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type RefObject,
} from "react";

import BudgetsTab from "@/components/dashboard/tabs/budgets";
import HomeTab from "@/components/dashboard/tabs/home";
import InsightsTab from "@/components/dashboard/tabs/insights-tab";
import LoansTab from "@/components/dashboard/tabs/loans";
import RecurringTab from "@/components/dashboard/tabs/recurring";
import SpaceSettingsTab from "@/components/dashboard/tabs/space-settings-tab";
import TransactionsTab from "@/components/dashboard/tabs/transactions/index";
import { DetailPushPanel } from "@/components/dashboard/detail-push-transition";
import { nextCachedBottomNavTabs } from "@/lib/cached-bottom-nav-tabs";
import {
  dashboardTabShouldSlide,
  type DashboardBottomTab,
} from "@/lib/dashboard-nav-routes";
import { cn } from "@/lib/utils";

export type BottomNavScreenComponent = ComponentType<{ isActive?: boolean }>;

export type CachedBottomNavScreensMap = Record<
  DashboardBottomTab,
  BottomNavScreenComponent
>;

function InsightsScreen({ isActive }: { isActive?: boolean }) {
  return (
    <Suspense fallback={null}>
      <InsightsTab isActive={isActive} />
    </Suspense>
  );
}

const defaultScreens: CachedBottomNavScreensMap = {
  home: HomeTab,
  transactions: TransactionsTab,
  insights: InsightsScreen,
  menu: dynamic(() => import("@/app/(private)/dashboard/app_settings/page")),
  space_settings: SpaceSettingsTab,
  recurring: RecurringTab,
  budgets: BudgetsTab,
  loans: LoansTab,
};

const TAB_ORDER: DashboardBottomTab[] = [
  "home",
  "transactions",
  "insights",
  "menu",
  "space_settings",
  "recurring",
  "budgets",
  "loans",
];

export function CachedBottomNavScreens({
  activeTab,
  screens = defaultScreens,
  scrollContainerRef,
}: {
  activeTab: DashboardBottomTab | null;
  screens?: CachedBottomNavScreensMap;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}) {
  const [visited, setVisited] = useState<DashboardBottomTab[]>(
    () => (activeTab ? [activeTab] : []),
  );

  const nextVisited = nextCachedBottomNavTabs(visited, activeTab);
  if (
    nextVisited.length !== visited.length
    || nextVisited.some((tab, index) => tab !== visited[index])
  ) {
    setVisited(nextVisited);
  }

  const prevTabRef = useRef<DashboardBottomTab | null>(activeTab);
  const slideFromTabRef = useRef<DashboardBottomTab | null>(activeTab);
  const [slideEpoch, setSlideEpoch] = useState(0);
  const scrollByTabRef = useRef<Partial<Record<DashboardBottomTab, number>>>(
    {},
  );

  useLayoutEffect(() => {
    if (
      activeTab &&
      slideFromTabRef.current !== activeTab &&
      dashboardTabShouldSlide(activeTab)
    ) {
      setSlideEpoch((epoch) => epoch + 1);
    }

    slideFromTabRef.current = activeTab;
  }, [activeTab]);

  useLayoutEffect(() => {
    const container = scrollContainerRef?.current;
    const previousTab = prevTabRef.current;

    if (container && previousTab) {
      scrollByTabRef.current[previousTab] = container.scrollTop;
    }

    if (container && activeTab) {
      container.scrollTop = scrollByTabRef.current[activeTab] ?? 0;
    }

    prevTabRef.current = activeTab;
  }, [activeTab, scrollContainerRef]);

  return (
    <>
      {TAB_ORDER.map((tab) => {
        if (!visited.includes(tab)) {
          return null;
        }

        const Screen = screens[tab];
        const isActive = activeTab === tab;
        const screen = <Screen isActive={isActive} />;
        const slideIn =
          isActive &&
          slideEpoch > 0 &&
          dashboardTabShouldSlide(tab);

        return (
          <div
            key={tab}
            hidden={!isActive}
            aria-hidden={!isActive}
            className={cn(!isActive && "hidden")}
          >
            {slideIn ? (
              <DetailPushPanel key={slideEpoch}>
                {screen}
              </DetailPushPanel>
            ) : (
              screen
            )}
          </div>
        );
      })}
    </>
  );
}
