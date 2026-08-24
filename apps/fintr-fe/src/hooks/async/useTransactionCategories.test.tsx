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
import {
  getLocalDb,
  OUTBOX_COMMAND_CATEGORY_CREATE,
  OUTBOX_COMMAND_CATEGORY_DELETE,
  OUTBOX_COMMAND_CATEGORY_UPDATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { cacheTransactionCategoriesResponse } from "@/services/transactions/categories/local-cache";
import { CategoryTypeEnum } from "@/types/categoryTypes";

const { fetchTransactionCategories, createTransactionCategory } = vi.hoisted(
  () => ({
    fetchTransactionCategories: vi.fn(),
    createTransactionCategory: vi.fn(() => new Promise(() => {})),
  }),
);

vi.mock("@/hooks/useAuthApi", () => ({
  default: () => ({
    api: { post: vi.fn() },
    isAuthenticated: true,
  }),
}));

vi.mock("@/services/transactions/categories/mutation", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/transactions/categories/mutation")
  >("@/services/transactions/categories/mutation");

  return {
    ...actual,
    fetchTransactionCategories: (...args: unknown[]) =>
      fetchTransactionCategories(...args),
    createTransactionCategory: (...args: unknown[]) =>
      createTransactionCategory(...args),
    convertCategoryHierarchy: vi.fn(),
  };
});

vi.mock("@/services/local-sync/drain-outbox", () => ({
  scheduleOutboxDrain: vi.fn(),
}));

import { useTransactionCategories } from "./useTransactionCategories";

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

describe("useTransactionCategories", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(async () => {
    fetchTransactionCategories.mockReset();
    createTransactionCategory.mockReset();
    createTransactionCategory.mockImplementation(() => new Promise(() => {}));
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

  it("creates a category locally while offline and updates the list without waiting for the API", async () => {
    await cacheTransactionCategoriesResponse("space-a", {
      data: {
        expenseCategories: [
          {
            id: "cat-1",
            name: "Food",
            categoryType: CategoryTypeEnum.EXPENSE,
            parentId: null,
            children: [],
          },
        ],
        incomeCategories: [],
      },
    });

    const { result } = renderHook(() => useTransactionCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.expenseCategories.map((row) => row.name)).toEqual([
        "Food",
      ]);
    });

    let recorded: { data: { id: string }; pendingSync: boolean } | undefined;

    await act(async () => {
      recorded = await result.current.createCategoryMutation.mutateAsync({
        name: "Church",
        categoryType: CategoryTypeEnum.EXPENSE,
        parentId: null,
        icon: "church",
        color: "#112233",
      });
    });

    expect(recorded?.pendingSync).toBe(true);
    expect(recorded?.data.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    await waitFor(() => {
      expect(result.current.createCategoryMutation.isPending).toBe(false);
      expect(
        result.current.expenseCategories.map((row) => row.name),
      ).toEqual(["Food", "Church"]);
      expect(
        result.current.expenseCategoryOptions.map((row) => row.name),
      ).toEqual(["Food", "Church"]);
    });
    expect(fetchTransactionCategories).not.toHaveBeenCalled();
    expect(createTransactionCategory).not.toHaveBeenCalled();

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_CATEGORY_CREATE);
  });

  it("converts a parent into a subcategory and shows it under the receiving parent", async () => {
    await cacheTransactionCategoriesResponse("space-a", {
      data: {
        expenseCategories: [
          {
            id: "cat-sss",
            name: "SSS contributions",
            categoryType: CategoryTypeEnum.EXPENSE,
            parentId: null,
            children: [],
          },
          {
            id: "cat-benefits",
            name: "Benefits",
            categoryType: CategoryTypeEnum.EXPENSE,
            parentId: null,
            children: [],
          },
        ],
        incomeCategories: [],
      },
    });

    const { result } = renderHook(() => useTransactionCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.expenseCategories.map((row) => row.name).sort()).toEqual([
        "Benefits",
        "SSS contributions",
      ]);
    });

    await act(async () => {
      await result.current.convertCategoryMutation.mutateAsync({
        categoryId: "cat-sss",
        conversionType: "to_subcategory",
        newParentId: "cat-benefits",
      });
    });

    await waitFor(() => {
      const benefits = result.current.expenseCategories.find(
        (row) => row.id === "cat-benefits",
      );
      expect(benefits?.children?.map((child) => child.name)).toEqual([
        "SSS contributions",
      ]);
      expect(
        result.current.expenseCategories.find((row) => row.id === "cat-sss"),
      ).toBeUndefined();
    });
  });

  it("deletes a category locally while offline and removes it from the list immediately", async () => {
    await cacheTransactionCategoriesResponse("space-a", {
      data: {
        expenseCategories: [
          {
            id: "cat-1",
            name: "Food",
            categoryType: CategoryTypeEnum.EXPENSE,
            parentId: null,
            children: [],
          },
          {
            id: "cat-2",
            name: "Transport",
            categoryType: CategoryTypeEnum.EXPENSE,
            parentId: null,
            children: [],
          },
        ],
        incomeCategories: [],
      },
    });

    const { result } = renderHook(() => useTransactionCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.expenseCategories.map((row) => row.name).sort()).toEqual([
        "Food",
        "Transport",
      ]);
    });

    let recorded: { success: boolean; pendingSync?: boolean } | undefined;

    await act(async () => {
      recorded = await result.current.deleteCategoryMutation.mutateAsync("cat-1");
    });

    expect(recorded?.success).toBe(true);
    expect(recorded?.pendingSync).toBe(true);

    await waitFor(() => {
      expect(result.current.expenseCategories.map((row) => row.name)).toEqual([
        "Transport",
      ]);
    });
    expect(fetchTransactionCategories).not.toHaveBeenCalled();

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_CATEGORY_DELETE);
  });

  it("updates a category locally while offline and reflects the new name immediately", async () => {
    await cacheTransactionCategoriesResponse("space-a", {
      data: {
        expenseCategories: [
          {
            id: "cat-1",
            name: "A1",
            categoryType: CategoryTypeEnum.EXPENSE,
            parentId: null,
            children: [],
          },
        ],
        incomeCategories: [],
      },
    });

    const { result } = renderHook(() => useTransactionCategories(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.expenseCategories.map((row) => row.name)).toEqual([
        "A1",
      ]);
    });

    let recorded: { pendingSync: boolean; localCategory: { name: string } } | undefined;

    await act(async () => {
      recorded = await result.current.updateCategoryMutation.mutateAsync({
        categoryId: "cat-1",
        updateData: {
          name: "A12",
          icon: "utensils",
          color: "#000000",
        },
      });
    });

    expect(recorded?.pendingSync).toBe(true);
    expect(recorded?.localCategory.name).toBe("A12");

    await waitFor(() => {
      expect(result.current.expenseCategories.map((row) => row.name)).toEqual([
        "A12",
      ]);
      expect(
        result.current.expenseCategoryOptions.map((row) => row.name),
      ).toEqual(["A12"]);
    });
    expect(fetchTransactionCategories).not.toHaveBeenCalled();

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_CATEGORY_UPDATE);
  });
});
