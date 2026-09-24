import "fake-indexeddb/auto";

import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLocalDb,
  OUTBOX_COMMAND_CATEGORY_CONVERT,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { cacheTransactionCategoriesResponse } from "@/services/transactions/categories/local-cache";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import ConvertCategoryDialog from "./convert-category-dialog";

const convertCategoryHierarchy = vi.fn(() => new Promise(() => {}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => ["space-a", vi.fn()],
}));

vi.mock("@/services/transactions/categories/mutation", () => ({
  convertCategoryHierarchy: (...args: unknown[]) =>
    convertCategoryHierarchy(...args),
  previewCategoryConversion: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

const trees = {
  data: {
    expenseCategories: [
      {
        id: "cat-taxi",
        name: "Taxi",
        categoryType: CategoryTypeEnum.EXPENSE,
        parentId: "cat-transport",
        children: [],
      },
      {
        id: "cat-transport",
        name: "Transport",
        categoryType: CategoryTypeEnum.EXPENSE,
        parentId: null,
        children: [
          {
            id: "cat-taxi",
            name: "Taxi",
            categoryType: CategoryTypeEnum.EXPENSE,
            parentId: "cat-transport",
            children: [],
          },
        ],
      },
    ],
    incomeCategories: [],
  },
};

describe("ConvertCategoryDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("spaceCode", "space-a");
    onlineManager.setOnline(false);
    vi.spyOn(globalThis, "navigator", "get").mockReturnValue({
      onLine: false,
    } as Navigator);
  });

  afterEach(async () => {
    onlineManager.setOnline(true);
    localStorage.removeItem("spaceCode");
    await resetLocalDbForTests();
  });

  it("converts locally while offline without waiting for the API", async () => {
    await cacheTransactionCategoriesResponse("space-a", trees);
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const onConverted = vi.fn();
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <ConvertCategoryDialog
          open
          onOpenChange={vi.fn()}
          category={{ id: "cat-taxi", name: "Taxi" }}
          conversionType="to_parent"
          kind="expense"
          rootCategories={trees.data.expenseCategories}
          onConverted={onConverted}
        />
      </QueryClientProvider>,
    );

    const confirm = await screen.findByRole("button", { name: "Confirm" });
    await waitFor(() => {
      expect(confirm).toBeEnabled();
    });
    await user.click(confirm);

    await waitFor(() => {
      expect(onConverted).toHaveBeenCalledWith("cat-taxi");
    });
    expect(convertCategoryHierarchy).not.toHaveBeenCalled();
    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_CATEGORY_CONVERT);
    expect(queryClient.isMutating()).toBe(0);
  });
});
