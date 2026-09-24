import "fake-indexeddb/auto";

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import { listSpaceAccounts, resetLocalDbForTests } from "@/lib/local-db";
import {
  cacheAccountsResponse,
  loadCachedAccountsResponse,
} from "@/services/transactions/accounts/local-cache";

vi.mock("@/hooks/useAuthApi", () => ({
  default: () => ({
    api: { get: vi.fn(), post: vi.fn() },
    isAuthenticated: true,
  }),
}));

vi.mock("@/services/transactions/accounts/mutation", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/transactions/accounts/mutation")
  >("@/services/transactions/accounts/mutation");

  return {
    ...actual,
    createAccount: vi.fn(() => new Promise(() => {})),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useAccounts } from "./useAccounts";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const store = createStore();
  store.set(offlineSyncReadyAtom, true);

  return ({ children }: { children: ReactNode }) =>
    createElement(
      JotaiProvider,
      { store },
      createElement(QueryClientProvider, { client: queryClient }, children),
    );
};

const seedPhpAccounts = async () => {
  await cacheAccountsResponse("space-a", {
    data: {
      accounts: [
        {
          id: "acc-cash",
          name: "Cash",
          balance: "1000",
          balanceCurrency: "PHP",
          accountCategory: "cash",
        },
      ],
      balanceTotals: {
        total: 1000,
        cashTotal: 1000,
        payableTotal: 0,
        currency: "PHP",
      },
      accountCategoryOptions: [{ label: "Cash", value: "cash" }],
    },
  });
};

describe("useAccounts", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(async () => {
    localStorage.setItem("spaceCode", "space-a");
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: false,
    });
    onlineManager.setOnline(false);
    await resetLocalDbForTests();
  });

  afterEach(async () => {
    onlineManager.setOnline(true);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: originalOnLine,
    });
    localStorage.removeItem("spaceCode");
    await resetLocalDbForTests();
  });

  it("saves a foreign-currency account to IndexedDB without switching the space currency", async () => {
    await seedPhpAccounts();

    const { result } = renderHook(() => useAccounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.accounts.map((account) => account.name)).toEqual([
        "Cash",
      ]);
    });

    await act(async () => {
      await result.current.createAccount({
        name: "USD Wallet",
        balance: 50,
        accountCategory: "cash",
        balanceCurrency: "USD",
      });
    });

    await waitFor(() => {
      expect(result.current.isCreating).toBe(false);
      expect(result.current.accounts.map((account) => account.name)).toEqual([
        "Cash",
        "USD Wallet",
      ]);
    });

    const stored = await listSpaceAccounts("space-a");
    expect(stored.find((account) => account.name === "USD Wallet")).toMatchObject({
      balance: "50",
      balanceCurrency: "USD",
    });

    const cached = await loadCachedAccountsResponse("space-a");
    const totals = (
      cached as {
        data: { balanceTotals: { total: number; currency: string } };
      }
    ).data.balanceTotals;
    expect(totals.currency).toBe("PHP");
    expect(totals.total).toBe(1000);
  });
});
