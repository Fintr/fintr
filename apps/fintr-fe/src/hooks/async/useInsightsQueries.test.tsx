import "fake-indexeddb/auto";

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";

import { resetLocalDbForTests } from "@/lib/local-db";
import {
  cacheDashboardShell,
  cacheMonthlyFinancialSummaries,
} from "@/services/monthly-financial-summaries/local-cache";
import * as loadLocalSources from "@/services/insights/load-local-sources";
import { currentSpaceAtom } from "@/atoms/spaceAtoms";

import { useInsightsQueries } from "./useInsightsQueries";

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => ["space-dashboard-aug", vi.fn()],
}));

vi.mock("@/hooks/useOfflineReadMode", () => ({
  useBrowserOnline: () => true,
}));

vi.mock("@/services/insights/offline-narratives", () => ({
  buildOfflineNarratives: vi.fn().mockResolvedValue({
    headline: { text: "", sentiment: "neutral" },
    metrics: [],
    insights: [],
    dataQuality: {
      transactionCount: 0,
      categorizedPercent: "0%",
      completenessTier: "sparse",
    },
  }),
}));

const SPACE = "space-dashboard-aug";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <JotaiProvider
      initialValues={[
        [
          currentSpaceAtom,
          {
            code: SPACE,
            currency: "PHP",
            isOrganization: false,
          },
        ],
      ]}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </JotaiProvider>
  );
};

describe("useInsightsQueries", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (key === "spaceCode" ? SPACE : null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    await cacheDashboardShell(SPACE, {
      id: "dash-1",
      categoryOptions: [],
      accountOptions: [],
      expenseCategoryOptions: [],
      incomeCategoryOptions: [],
      goalDescription: "",
    });
    await cacheMonthlyFinancialSummaries(SPACE, [
      {
        id: "sum-2026-08",
        year: 2026,
        month: 8,
        currency: "PHP",
        fxBased: true,
        calculatedAt: new Date().toISOString(),
        totalIncome: 1_641_483.57,
        totalExpenses: 1_810_920.05,
        netSavings: -169_436.48,
        savingsPercentage: -10,
        monthStartDate: "2026-08-01",
        monthEndDate: "2026-08-31",
      },
    ]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await resetLocalDbForTests();
  });

  it("returns August 2026 unfiltered totals from IndexedDB", async () => {
    const { result } = renderHook(
      () =>
        useInsightsQueries({
          startDate: "2026-08-01",
          endDate: "2026-08-31",
          selectedCategory: "all",
          selectedTagIds: [],
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.summary?.totalIncome).toBeGreaterThan(0);
    });

    expect(result.current.summary?.totalIncome).toBeCloseTo(1_641_483.57);
    expect(result.current.summary?.totalExpenses).toBeCloseTo(1_810_920.05);
    expect(result.current.summary?.netSavings).toBeCloseTo(-169_436.48);
  });

  it("loads August bucket totals while the browser reports offline", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      onLine: false,
    });

    const { result } = renderHook(
      () =>
        useInsightsQueries({
          startDate: "2026-08-01",
          endDate: "2026-08-31",
          selectedCategory: "all",
          selectedTagIds: [],
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.summary?.totalIncome).toBeCloseTo(1_641_483.57);
    });

    expect(result.current.queries.bucketSummary.fetchStatus).not.toBe("paused");
  });

  it("shows August bucket totals even when transaction load hangs", async () => {
    vi.spyOn(loadLocalSources, "loadInsightsLocalSources").mockImplementation(
      () => new Promise(() => {}),
    );

    const { result } = renderHook(
      () =>
        useInsightsQueries({
          startDate: "2026-08-01",
          endDate: "2026-08-31",
          selectedCategory: "all",
          selectedTagIds: [],
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.summary?.totalIncome).toBeCloseTo(1_641_483.57);
    });

    expect(result.current.summary?.totalExpenses).toBeCloseTo(1_810_920.05);
    expect(result.current.isChartsLoading).toBe(true);
  });

  it("shows bundle totals before slow narratives finish", async () => {
    const { buildOfflineNarratives } = await import(
      "@/services/insights/offline-narratives"
    );

    let resolveNarratives: (value: unknown) => void = () => {};
    vi.mocked(buildOfflineNarratives).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNarratives = resolve;
        }),
    );

    const { result } = renderHook(
      () =>
        useInsightsQueries({
          startDate: "2026-08-01",
          endDate: "2026-08-31",
          selectedCategory: "all",
          selectedTagIds: [],
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.summary?.totalIncome).toBeGreaterThan(0);
    });

    expect(result.current.isNarrativesLoading).toBe(true);
    expect(result.current.narratives).toBeUndefined();

    resolveNarratives({
      headline: { text: "", sentiment: "neutral" },
      metrics: [{ key: "savings", label: "Savings", value: "10%" }],
      insights: [],
      dataQuality: {
        transactionCount: 1,
        categorizedPercent: "100%",
        completenessTier: "complete",
      },
    });

    await waitFor(() => {
      expect(result.current.isNarrativesLoading).toBe(false);
      expect(result.current.narratives?.metrics).toHaveLength(1);
    });
  });
});
