import "fake-indexeddb/auto";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import { resetLocalDbForTests } from "@/lib/local-db";
import { putSpaceTransactions } from "@/lib/local-db/transactions";
import {
  cacheEntitiesResponse,
  normalizeEntityRecords,
} from "@/services/entities/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

const fetchEntityDetail = vi.fn();

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({
    api: { get: vi.fn() },
    isAuthenticated: true,
  }),
}));

vi.mock("@/services/entities/mutation", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/entities/mutation")
  >("@/services/entities/mutation");

  return {
    ...actual,
    fetchEntityDetail: (...args: unknown[]) => fetchEntityDetail(...args),
  };
});

import { useEntityDetail } from "./useEntityDetail";

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

describe("useEntityDetail", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(async () => {
    fetchEntityDetail.mockReset();
    fetchEntityDetail.mockImplementation(
      () => new Promise(() => undefined),
    );
    localStorage.setItem("spaceCode", "SPACE_1");
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: false,
    });
    await resetLocalDbForTests();
  });

  afterEach(async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: originalOnLine,
    });
    localStorage.removeItem("spaceCode");
    await resetLocalDbForTests();
  });

  it("reads cached entity detail while offline without waiting for the API", async () => {
    await cacheEntitiesResponse(
      "SPACE_1",
      normalizeEntityRecords([
        {
          id: "merchant-1",
          full_name: "Jollibee",
          entity_type: "transaction",
        },
      ]),
    );
    await putSpaceTransactions("SPACE_1", [
      {
        id: "tx-1",
        date: "2026-08-12",
        description: "Chickenjoy",
        amount: 199,
        categoryName: "Food",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
        entityName: "Jollibee",
      },
    ]);

    const { result } = renderHook(() => useEntityDetail("merchant-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.entity.fullName).toBe("Jollibee");
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(fetchEntityDetail).not.toHaveBeenCalled();
  });
});
