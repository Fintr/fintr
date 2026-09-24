import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOnboarding } from "./useOnboarding";

const api = { post: vi.fn() };
const cacheWorkspaceSetupInIndexedDb = vi.fn();

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({
    api,
    isAuthenticated: true,
  }),
}));

vi.mock("@/services/onboarding/mutations", () => ({
  saveCurrencyStepData: vi.fn(async () => ({})),
  saveStep1Data: vi.fn(async () => ({ data: { budgetsData: [] } })),
  saveStep2Data: vi.fn(async () => ({
    data: {
      accountsData: [],
      accountCategories: [],
    },
  })),
  saveStep3Data: vi.fn(async () => ({})),
  skipOnboardingSetup: vi.fn(async () => ({})),
}));

vi.mock("@/services/onboarding/queries", () => ({
  getOnboardingData: vi.fn(),
}));

vi.mock("@/services/onboarding/cache-workspace-setup", () => ({
  cacheWorkspaceSetupInIndexedDb: (...args: unknown[]) =>
    cacheWorkspaceSetupInIndexedDb(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useOnboarding IndexedDB import", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheWorkspaceSetupInIndexedDb.mockResolvedValue(undefined);
    window.localStorage.setItem("spaceCode", "setup-space");
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      JotaiProvider,
      null,
      createElement(QueryClientProvider, { client: queryClient }, children),
    );

  it("caches currency, accounts, and skip into IndexedDB", async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await act(async () => {
      await result.current.saveCurrencyStepData({
        step: "currency",
        currency: "usd",
      });
      await result.current.saveStep3Data({
        step: "accounts",
        accounts: [],
      });
      await result.current.skipOnboarding();
    });

    expect(cacheWorkspaceSetupInIndexedDb).toHaveBeenCalledTimes(3);

    expect(cacheWorkspaceSetupInIndexedDb).toHaveBeenCalledWith({
      api,
      queryClient,
      spaceCode: "setup-space",
    });
  });

  it("does not cache income or budget drafts", async () => {
    const { result } = renderHook(() => useOnboarding(), { wrapper });

    await act(async () => {
      await result.current.saveStep1Data({
        step: "income",
        income: 50000,
      });
      await result.current.saveStep2Data({
        step: "budgets",
        budgetCategories: [{ name: "Home", amount: "1000" }],
      });
    });

    expect(cacheWorkspaceSetupInIndexedDb).not.toHaveBeenCalled();
  });
});
