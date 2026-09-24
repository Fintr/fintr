import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { useEffect, type ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/dashboard/tabs/budgets", () => ({
  default: () => null,
}));
vi.mock("@/components/dashboard/tabs/loans", () => ({
  default: () => null,
}));
vi.mock("@/components/dashboard/tabs/insights-tab", () => ({
  default: () => null,
}));
vi.mock("@/components/dashboard/tabs/recurring", () => ({
  default: () => null,
}));
vi.mock("@/components/dashboard/tabs/home", () => ({
  default: () => null,
}));
vi.mock("@/components/dashboard/tabs/transactions/index", () => ({
  default: () => null,
}));
vi.mock("@/components/dashboard/tabs/space-settings-tab", () => ({
  default: () => null,
}));

import { CachedBottomNavScreens } from "./cached-bottom-nav-screens";
import type { DashboardBottomTab } from "@/lib/dashboard-nav-routes";

const emptyScreens = {
  home: () => null,
  transactions: () => null,
  insights: () => null,
  menu: () => null,
  space_settings: () => null,
  recurring: () => null,
  budgets: () => null,
  loans: () => null,
};

const createCountingScreen = (label: string, mounts: { count: number }) => {
  const Screen: ComponentType<{ isActive?: boolean }> = () => {
    useEffect(() => {
      mounts.count += 1;
    }, []);

    return <div>{label}</div>;
  };

  return Screen;
};

describe("CachedBottomNavScreens", () => {
  it("keeps a visited tab mounted after switching away and back", () => {
    const homeMounts = { count: 0 };
    const transactionMounts = { count: 0 };
    const screens = {
      ...emptyScreens,
      home: createCountingScreen("Home screen", homeMounts),
      transactions: createCountingScreen(
        "Transactions screen",
        transactionMounts,
      ),
    };

    const { rerender } = render(
      <CachedBottomNavScreens activeTab="home" screens={screens} />,
    );

    expect(screen.getByText("Home screen")).toBeVisible();
    expect(homeMounts.count).toBe(1);

    rerender(
      <CachedBottomNavScreens activeTab="transactions" screens={screens} />,
    );

    expect(screen.getByText("Home screen")).not.toBeVisible();
    expect(screen.getByText("Transactions screen")).toBeVisible();
    expect(homeMounts.count).toBe(1);
    expect(transactionMounts.count).toBe(1);

    rerender(
      <CachedBottomNavScreens activeTab="home" screens={screens} />,
    );

    expect(screen.getByText("Home screen")).toBeVisible();
    expect(homeMounts.count).toBe(1);
  });

  it("keeps visited tabs mounted while showing a nested dashboard route", () => {
    const homeMounts = { count: 0 };
    const screens = {
      ...emptyScreens,
      home: createCountingScreen("Home screen", homeMounts),
    };

    const { rerender } = render(
      <CachedBottomNavScreens activeTab="home" screens={screens} />,
    );

    rerender(
      <CachedBottomNavScreens activeTab={null} screens={screens} />,
    );

    expect(screen.getByText("Home screen")).not.toBeVisible();
    expect(homeMounts.count).toBe(1);
  });

  it("hides Home and shows Settings when the desktop Settings tab is pending", () => {
    const screens = {
      ...emptyScreens,
      home: () => <div>Home screen</div>,
      space_settings: () => <div>Space settings content</div>,
    };

    const { rerender } = render(
      <CachedBottomNavScreens activeTab="home" screens={screens} />,
    );

    expect(screen.getByText("Home screen")).toBeVisible();

    rerender(
      <CachedBottomNavScreens
        activeTab="space_settings"
        screens={screens}
      />,
    );

    expect(screen.getByText("Home screen")).not.toBeVisible();
    expect(screen.getByText("Space settings content")).toBeVisible();
  });

  it("hides Home and shows Recurring when the desktop Recurring tab is pending", () => {
    const screens = {
      ...emptyScreens,
      home: () => <div>Home screen</div>,
      recurring: () => <div>Recurring content</div>,
    };

    const { rerender } = render(
      <CachedBottomNavScreens activeTab="home" screens={screens} />,
    );

    expect(screen.getByText("Home screen")).toBeVisible();

    rerender(
      <CachedBottomNavScreens activeTab="recurring" screens={screens} />,
    );

    expect(screen.getByText("Home screen")).not.toBeVisible();
    expect(screen.getByText("Recurring content")).toBeVisible();
  });

  it.each([
    ["budgets", "Budgets content"],
    ["loans", "Loans content"],
    ["insights", "Insights content"],
  ] as const)(
    "hides Home and shows %s when that desktop tab is pending",
    (tab, label) => {
      const screens = {
        ...emptyScreens,
        home: () => <div>Home screen</div>,
        [tab]: () => <div>{label}</div>,
      };

      const { rerender } = render(
        <CachedBottomNavScreens activeTab="home" screens={screens} />,
      );

      expect(screen.getByText("Home screen")).toBeVisible();

      rerender(
        <CachedBottomNavScreens activeTab={tab} screens={screens} />,
      );

      expect(screen.getByText("Home screen")).not.toBeVisible();
      expect(screen.getByText(label)).toBeVisible();
    },
  );

  it("statically imports Recurring so the first click does not wait on a chunk", () => {
    const source = readFileSync(
      path.resolve(__dirname, "./cached-bottom-nav-screens.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'import RecurringTab from "@/components/dashboard/tabs/recurring"',
    );
    expect(source).not.toContain(
      'recurring: dynamic(() => import("@/components/dashboard/tabs/recurring"))',
    );
  });

  it("statically imports Budgets, Loans, and Dashboard so tab clicks do not wait on chunks", () => {
    const source = readFileSync(
      path.resolve(__dirname, "./cached-bottom-nav-screens.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'import BudgetsTab from "@/components/dashboard/tabs/budgets"',
    );
    expect(source).toContain(
      'import LoansTab from "@/components/dashboard/tabs/loans"',
    );
    expect(source).toContain(
      'import InsightsTab from "@/components/dashboard/tabs/insights-tab"',
    );
    expect(source).not.toContain(
      'insights: dynamic(() => import("@/components/dashboard/tabs/insights-tab"))',
    );
    expect(source).not.toContain(
      'budgets: dynamic(() => import("@/components/dashboard/tabs/budgets"))',
    );
    expect(source).not.toContain(
      'loans: dynamic(() => import("@/components/dashboard/tabs/loans"))',
    );
    expect(source).toContain(
      'import HomeTab from "@/components/dashboard/tabs/home"',
    );
    expect(source).toContain(
      'import TransactionsTab from "@/components/dashboard/tabs/transactions/index"',
    );
    expect(source).toContain(
      'import SpaceSettingsTab from "@/components/dashboard/tabs/space-settings-tab"',
    );
    expect(source).not.toContain(
      'home: dynamic(() => import("@/components/dashboard/tabs/home"))',
    );
    expect(source).not.toContain(
      'transactions: dynamic(',
    );
  });

  it("unmounts the oldest tab after more than four screens have been visited", () => {
    const homeMounts = { count: 0 };
    const screens = {
      ...emptyScreens,
      home: createCountingScreen("Home screen", homeMounts),
      transactions: () => <div>Transactions screen</div>,
      insights: () => <div>Insights screen</div>,
      menu: () => <div>Menu screen</div>,
      budgets: () => <div>Budgets screen</div>,
    };

    const { rerender } = render(
      <CachedBottomNavScreens activeTab="home" screens={screens} />,
    );

    rerender(
      <CachedBottomNavScreens activeTab="transactions" screens={screens} />,
    );
    rerender(
      <CachedBottomNavScreens activeTab="insights" screens={screens} />,
    );
    rerender(
      <CachedBottomNavScreens activeTab="menu" screens={screens} />,
    );

    expect(screen.getByText("Home screen")).toBeInTheDocument();
    expect(homeMounts.count).toBe(1);

    rerender(
      <CachedBottomNavScreens activeTab="budgets" screens={screens} />,
    );

    expect(screen.queryByText("Home screen")).not.toBeInTheDocument();
    expect(screen.getByText("Budgets screen")).toBeVisible();
  });

  it("slides Recurring and Loans in with the detail-push panel", () => {
    const screens = {
      ...emptyScreens,
      transactions: () => <div>Transactions screen</div>,
      loans: () => <div>Loans screen</div>,
      recurring: () => <div>Recurring screen</div>,
    };

    const { rerender } = render(
      <CachedBottomNavScreens activeTab="transactions" screens={screens} />,
    );

    expect(screen.queryByTestId("detail-push-panel")).not.toBeInTheDocument();

    rerender(
      <CachedBottomNavScreens activeTab="loans" screens={screens} />,
    );

    expect(screen.getByTestId("detail-push-panel")).toHaveAttribute(
      "data-detail-push",
      "enter",
    );
    expect(screen.getByText("Loans screen")).toBeVisible();

    rerender(
      <CachedBottomNavScreens activeTab="recurring" screens={screens} />,
    );

    expect(screen.getByTestId("detail-push-panel")).toHaveAttribute(
      "data-detail-push",
      "enter",
    );
    expect(screen.getByText("Recurring screen")).toBeVisible();
  });

  it("restores a tab's scroll position when returning to it", () => {
    const screens: Record<
      DashboardBottomTab,
      ComponentType<{ isActive?: boolean }>
    > = {
      ...emptyScreens,
      home: () => <div>Home screen</div>,
      transactions: () => <div>Transactions screen</div>,
    };
    const scrollContainer = document.createElement("div");
    const scrollContainerRef = { current: scrollContainer };

    const { rerender } = render(
      <CachedBottomNavScreens
        activeTab="home"
        screens={screens}
        scrollContainerRef={scrollContainerRef}
      />,
    );

    scrollContainer.scrollTop = 240;

    rerender(
      <CachedBottomNavScreens
        activeTab="transactions"
        screens={screens}
        scrollContainerRef={scrollContainerRef}
      />,
    );

    expect(scrollContainer.scrollTop).toBe(0);

    rerender(
      <CachedBottomNavScreens
        activeTab="home"
        screens={screens}
        scrollContainerRef={scrollContainerRef}
      />,
    );

    expect(scrollContainer.scrollTop).toBe(240);
  });
});
